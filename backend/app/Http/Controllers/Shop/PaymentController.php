<?php

namespace App\Http\Controllers\Shop;

use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Models\Payment;
use App\Payments\MockLedger;
use App\Payments\PaymentGateway;
use App\Payments\SettlesPayments;
use App\Payments\WebhookEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Payment initiation, verification and the provider webhook.
 *
 * The flow is NOT a redirect handshake. Xendify mints a dedicated virtual account
 * per order; the customer transfers to it from their own banking app, possibly
 * hours later, and a webhook tells us when the money lands.
 */
class PaymentController extends Controller
{
    public function __construct(
        private readonly PaymentGateway $gateway,
        private readonly SettlesPayments $settler,
    ) {}

    /**
     * POST /api/shop/payments/initialize  { reference }
     *
     * Asks the provider for a virtual account and hands it back for the storefront
     * to display. Re-initialising an order returns the SAME account rather than
     * minting another — a customer who reloads the pay page must not end up with
     * two account numbers and no idea which one to send money to.
     */
    public function initialize(Request $request): JsonResponse
    {
        $order = $this->orderFrom($request);

        if ($order->status !== Order::PENDING_PAYMENT) {
            return response()->json([
                'data' => [
                    'status' => $order->status,
                    'message' => 'This order has already been settled.',
                ],
            ]);
        }

        $existing = $order->payments()
            ->where('status', 'pending')
            ->whereNotNull('account_number')
            // An expired account still accepts nothing, so a dead one must not be
            // handed back. A null expiry means the account does not expire.
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->first();

        if ($existing) {
            return response()->json(['data' => $this->instructionPayload($order, $existing)]);
        }

        try {
            $instruction = $this->gateway->initialize($order);
        } catch (RuntimeException $e) {
            Log::error('Payment initialisation failed.', [
                'order' => $order->reference,
                'provider' => $this->gateway->name(),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'We could not set up your payment just now. Please try again in a moment.',
            ], 502);
        }

        $payment = $order->payments()->create([
            'provider' => $this->gateway->name(),
            'provider_reference' => $instruction->reference,
            'status' => 'pending',
            'amount' => $order->total,
            'currency' => $order->currency,
            'account_number' => $instruction->accountNumber,
            'account_name' => $instruction->accountName,
            'bank_name' => $instruction->bankName,
            'expires_at' => $instruction->expiresAt,
            'authorization_url' => $instruction->authorizationUrl,
            'raw_response' => $instruction->raw,
        ]);

        return response()->json(['data' => $this->instructionPayload($order, $payment)]);
    }

    /**
     * POST /api/shop/payments/verify  { reference }
     *
     * What the storefront polls while the customer waits for their transfer. It
     * asks the PROVIDER directly, so it is authoritative — the browser is never
     * trusted to report its own payment.
     *
     * With Xendify this poll cannot settle an order *before* the collection
     * webhook arrives: `/transaction_verify` answers only to a `trx`, and the
     * webhook is where that id comes from. Until then the gateway honestly
     * returns pending. So this endpoint is how the customer's page LEARNS the
     * order flipped, not what flips it.
     */
    public function verify(Request $request): JsonResponse
    {
        $order = $this->orderFrom($request);

        if ($order->status !== Order::PENDING_PAYMENT) {
            return response()->json([
                'data' => [
                    'status' => $order->status,
                    'order' => new OrderResource($order->load(['items', 'address.zone'])),
                ],
            ]);
        }

        $payment = $order->payments()->where('status', 'pending')->latest('id')->first();

        if (! $payment) {
            return response()->json(['data' => ['status' => $order->status]]);
        }

        $this->settler->settle($payment, $this->gateway->verify($payment));

        $order->refresh();

        return response()->json([
            'data' => [
                'status' => $order->status,
                'order' => new OrderResource($order->load(['items', 'address.zone'])),
            ],
        ]);
    }

    /**
     * POST /api/shop/payments/webhook/{provider}
     *
     * ────────────────────────────────────────────────────────────────────────
     * THE WEBHOOK SETTLES THE ORDER.
     *
     * Xendify authenticates itself with a bearer key, checked below; a body that
     * fails that check gets a 401 and does nothing. A body that PASSES is
     * believed: its status and amount go straight to `SettlesPayments`, with no
     * outbound confirmation call. The shared key is therefore the only lock on
     * this endpoint — see XendifyGateway's header.
     *
     * Settlement still runs through the one `settle()` path, so the guarantees
     * that are not about trust hold unchanged: goods move exactly once no matter
     * how many times Xendify retries, and an underpayment leaves the order
     * pending.
     *
     * Always answers 200, which is what Xendify expects; a non-2xx makes them
     * retry up to ten times. Retries are harmless — settlement is idempotent —
     * but there is no reason to invite them.
     * ────────────────────────────────────────────────────────────────────────
     */
    public function webhook(Request $request, string $provider): JsonResponse
    {
        if ($provider !== $this->gateway->name()) {
            Log::warning('Webhook for a provider that is not bound.', [
                'provider' => $provider,
                'bound' => $this->gateway->name(),
            ]);

            return $this->acknowledge();
        }

        if (! $this->gateway->authenticateWebhook($request)) {
            Log::warning('Rejected an unauthenticated webhook.', ['provider' => $provider]);

            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $event = $this->gateway->parseWebhook($request);

        if (! $event->isIdentifiable()) {
            Log::warning('Webhook carried nothing to identify a payment by.', [
                'provider' => $provider,
                // Field NAMES only, never the values: the body carries the payer's
                // own bank details.
                'fields' => array_keys($request->all()),
            ]);

            return $this->acknowledge();
        }

        $payment = $this->findPayment($event);

        if (! $payment) {
            Log::warning('Webhook did not match any payment.', ['provider' => $provider]);

            return $this->acknowledge();
        }

        if ($event->transactionId && ! $payment->provider_transaction_id) {
            $payment->forceFill(['provider_transaction_id' => $event->transactionId])->save();
        }

        $payment->forceFill(['raw_webhook' => $event->raw])->save();

        // Settle from the body. The event is already authenticated, and `settle()`
        // applies the amount check, the paid transition and the stock movements —
        // the same call the customer's poll makes, so whichever lands first wins
        // and the other is a no-op.
        $this->settler->settle($payment, $event->toResult());

        return $this->acknowledge();
    }

    /**
     * POST /api/shop/payments/mock-settle  { reference, outcome }   ** DEV ONLY **
     *
     * Stands in for what happens INSIDE the payment provider when a customer
     * completes a bank transfer. The pay page's dev controls call it to record
     * the outcome a tester chose; `verify()` then reports it, exactly as Xendify
     * would.
     *
     * Guarded to the mock gateway, so it 404s the moment a real provider is
     * bound. Keeping it separate from `verify` matters: verify stays an honest
     * read of provider truth, which is what it must be in production.
     */
    public function mockSettle(Request $request): JsonResponse
    {
        abort_unless($this->gateway->name() === 'mock', 404);

        $request->validate([
            'reference' => ['required', 'string', 'max:32'],
            'outcome' => ['required', 'in:success,failed'],
        ]);

        $order = Order::where('reference', $this->normalise($request->input('reference')))
            ->firstOrFail();

        MockLedger::settle(
            $order->reference,
            (string) $request->input('outcome'),
            $order->total,
        );

        return response()->json(['data' => ['status' => 'recorded']]);
    }

    /**
     * Match a webhook to a payment.
     *
     * The virtual account number is the most reliable key: it was minted for one
     * order and nothing else can be credited to it. The provider's transaction id
     * and our own reference are fallbacks.
     */
    private function findPayment(WebhookEvent $event): ?Payment
    {
        $query = fn () => Payment::query()->latest('id');

        if ($event->accountNumber) {
            $found = $query()->where('account_number', $event->accountNumber)->first();

            if ($found) {
                return $found;
            }
        }

        if ($event->transactionId) {
            $found = $query()->where('provider_transaction_id', $event->transactionId)->first();

            if ($found) {
                return $found;
            }
        }

        if ($event->reference) {
            $found = $query()->where('provider_reference', $event->reference)->first();

            if ($found) {
                return $found;
            }

            $order = Order::where('reference', $event->reference)->first();

            if ($order) {
                return $order->payments()->latest('id')->first();
            }
        }

        return null;
    }

    private function orderFrom(Request $request): Order
    {
        $request->validate([
            'reference' => ['required', 'string', 'max:32'],
        ]);

        return Order::query()
            ->where('reference', $this->normalise($request->input('reference')))
            ->firstOrFail();
    }

    /** References are quoted down a phone line and retyped; be forgiving. */
    private function normalise(mixed $reference): string
    {
        return strtoupper(trim((string) $reference));
    }

    /**
     * @return array<string, mixed>
     */
    private function instructionPayload(Order $order, Payment $payment): array
    {
        return [
            'status' => $order->status,
            'reference' => $order->reference,
            'amount' => (int) $order->total,
            'currency' => $order->currency,
            // A transfer flow fills these; a redirect provider would fill
            // `authorization_url` instead. The storefront renders whichever it gets.
            'account_number' => $payment->account_number,
            'account_name' => $payment->account_name,
            'bank_name' => $payment->bank_name,
            'expires_at' => $payment->expires_at?->toIso8601String(),
            'authorization_url' => $payment->authorization_url,
            'provider' => $payment->provider,
        ];
    }

    private function acknowledge(): JsonResponse
    {
        return response()->json(['status' => 'success']);
    }
}
