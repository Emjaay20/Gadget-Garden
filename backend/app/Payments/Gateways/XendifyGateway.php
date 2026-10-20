<?php

namespace App\Payments\Gateways;

use App\Models\Order;
use App\Models\Payment;
use App\Payments\PaymentGateway;
use App\Payments\PaymentInstruction;
use App\Payments\PaymentResult;
use App\Payments\WebhookEvent;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Xendify — dedicated virtual account collection.
 * https://documenter.getpostman.com/view/11737658/2sB2ca5K9B
 *
 * The flow, which is NOT a redirect handshake:
 *
 *   1. `POST /create_checkout_account` with our order reference and the amount →
 *      a bank account number the customer transfers to.
 *   2. The customer transfers from their own banking app, whenever they like.
 *   3. Xendify POSTs a `collection` webhook to us when the money lands, and that
 *      webhook settles the order.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE WEBHOOK KEY IS THE LOCK
 *
 * Xendify authenticates itself with `Authorization: Bearer {webhook_key}`, checked
 * in `authenticateWebhook()` against `SHOP_XENDIFY_WEBHOOK_KEY`. An anonymous or
 * wrong-keyed POST gets a 401 and settles nothing.
 *
 * A body that clears that check is then believed: `parseWebhook()` reads the status
 * and amount out of it and `SettlesPayments` acts on them, with no outbound
 * confirmation call. That makes the shared key the ONE thing standing between a
 * stranger and free goods — it is a static bearer token, not a per-request
 * signature, so treat it like the secret key: never log it, rotate it if it is ever
 * exposed. `/transaction_verify/{trx}` is still available through `verify()` for
 * the customer's poll and for staff rechecks.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Response shapes: `create_checkout_account` and the collection webhook are pinned
 * to the real payloads (see XendifyGatewayTest). `transaction_verify`'s response is
 * still unconfirmed, so those reads try several plausible field names. The whole
 * payload is persisted to `payments.raw_response` for reconciliation.
 */
class XendifyGateway implements PaymentGateway
{
    /**
     * The PROVIDER's name, not the bank partner's.
     *
     * The original implementation returned 'safehaven' here — the bank that mints
     * the virtual account — which meant the webhook route `/webhook/{provider}`
     * and the container binding were both keyed on an implementation detail that
     * can change without the integration changing. The partner now lives only in
     * `shop.xendify.provider`, where it belongs.
     */
    public function name(): string
    {
        return 'xendify';
    }

    public function initialize(Order $order): PaymentInstruction
    {
        $response = $this->client()->post('/create_checkout_account', [
            'name' => $order->contact_name,
            'email' => $order->contact_email,
            // Their example sends amount as a string, in naira.
            'amount' => (string) $order->total,
            'currency' => $order->currency,
            'reference' => $order->reference,
            'phone' => $order->contact_phone,
            'title' => 'Gadgets Garden',
            'description' => "Order {$order->reference}",
            'provider' => config('shop.xendify.provider'),
        ]);

        $body = $response->json() ?? [];
        $data = $this->unwrap($body);

        /*
         | Xendify answers a *rejected* request with `success: false`, a numeric
         | status ("24") and a human message ("Amount cannot be less than 1") — the
         | HTTP code alone does not tell us. So the body is checked before the HTTP
         | status, and the message is carried into the exception: without this a bad
         | request surfaces as the generic "no virtual account" error below and the
         | actual reason is lost.
         */
        if ($response->failed() || $this->rejected($data)) {
            $message = $this->pick($data, ['message', 'error']) ?? "HTTP {$response->status()}";

            throw new RuntimeException("Xendify create_checkout_account failed: {$message}");
        }

        $accountNumber = $this->pick($data, ['account_number', 'accountNumber', 'virtual_account_number', 'accountNo']);

        if (blank($accountNumber)) {
            // Loud, because the customer has nowhere to send money.
            Log::error('Xendify returned no account number.', [
                'order' => $order->reference,
                'keys' => array_keys($data),
            ]);

            throw new RuntimeException('Xendify did not return a virtual account.');
        }

        // `accountExpiry` is the field the live API actually sends, and it matters:
        // a null expiry makes ShopPaymentController::initialize() treat the account
        // as eternal and keep handing back a dead one on every reload.
        $expires = $this->pick($data, ['accountExpiry', 'expires_at', 'expiry', 'expiryDate', 'expires']);

        return new PaymentInstruction(
            reference: (string) ($this->pick($data, ['reference', 'trx', 'transaction_reference']) ?? $order->reference),
            accountNumber: (string) $accountNumber,
            accountName: $this->pick($data, ['account_name', 'accountName']) ?? $order->contact_name,
            bankName: $this->pick($data, ['bank_name', 'bankName', 'bank']),
            expiresAt: $expires ? $this->parseDate($expires) : null,
            raw: $body,
        );
    }

    /**
     * `/transaction_verify/{trx}` answers to Xendify's own `trx` and nothing else —
     * not our order reference, not the `transactionRef` from account creation. `trx`
     * first reaches us on the collection webhook, so before that webhook there is
     * simply no question we can ask, and this returns pending without a request.
     *
     * The webhook itself now settles the order, so this is a second opinion rather
     * than the deciding one: it backs the customer's poll and the staff recheck once
     * a `trx` exists. A webhook Xendify never delivers is still a paid order left
     * pending — see `orders:expire-unpaid`.
     */
    public function verify(Payment $payment): PaymentResult
    {
        $trx = $payment->provider_transaction_id;

        if (blank($trx)) {
            return PaymentResult::pending();
        }

        $response = $this->client()->get("/transaction_verify/{$trx}");

        if ($response->failed()) {
            // A failed lookup is NOT a failed payment — the money may be fine and
            // Xendify merely unreachable. Pending keeps the order open and lets a
            // retry settle it, rather than cancelling a paid order.
            Log::warning('Xendify verify unreachable.', [
                'trx' => $trx,
                'status' => $response->status(),
            ]);

            return PaymentResult::pending();
        }

        $body = $response->json() ?? [];
        $data = $this->unwrap($body);

        $status = strtolower((string) ($this->pick($data, ['status', 'transaction_status']) ?? ''));
        $amount = $this->pick($data, ['amount', 'amount_paid', 'settled_amount']);
        $paidAt = $this->pick($data, ['timestamp', 'paid_at', 'created_at', 'transaction_date']);

        return new PaymentResult(
            status: $this->normaliseStatus($status),
            // Amounts arrive as strings ("5000"); naira, not kobo.
            amount: $amount === null ? null : (int) round((float) $amount),
            transactionId: $this->pick($data, ['trx', 'transaction_id', 'reference']),
            paidAt: $paidAt ? $this->parseDate($paidAt) : null,
            raw: $body,
        );
    }

    /**
     * Xendify calls our webhook with `Authorization: Bearer {webhook_key}` — a
     * shared secret we compare against `SHOP_XENDIFY_WEBHOOK_KEY`.
     *
     * Fails CLOSED when the key is unconfigured. That is a deliberate trade: an
     * unset key breaks settlement loudly (every webhook 401s, and the log below says
     * why) rather than quietly accepting anonymous POSTs in production. The
     * comparison is constant-time so a wrong key leaks nothing about the right one.
     */
    public function authenticateWebhook(Request $request): bool
    {
        $key = config('shop.xendify.webhook_key');

        if (blank($key)) {
            Log::error('SHOP_XENDIFY_WEBHOOK_KEY is not set — rejecting the webhook, so this order cannot settle.');

            return false;
        }

        return hash_equals($key, (string) $request->bearerToken());
    }

    public function parseWebhook(Request $request): WebhookEvent
    {
        $body = $request->all();
        $paidAt = $this->pick($body, ['timestamp', 'paid_at', 'transaction_date']);

        return new WebhookEvent(
            transactionId: $this->pick($body, ['trx', 'transaction_id']),
            reference: $this->pick($body, ['customer_reference', 'reference']),
            // The virtual account that was credited — the most reliable way back to
            // an order, since it was minted for that order alone.
            accountNumber: $this->pick($body, ['receiving_account', 'account_number']),
            amount: ($a = $this->pick($body, ['amount'])) === null ? null : (int) round((float) $a),
            // `00` on a successful collection. Anything unrecognised normalises to
            // pending, which settles nothing and leaves the order open.
            status: $this->normaliseStatus(strtolower((string) ($this->pick($body, ['status']) ?? ''))),
            paidAt: $paidAt ? $this->parseDate($paidAt) : null,
            raw: $body,
        );
    }

    private function client(): PendingRequest
    {
        $key = config('shop.xendify.secret_key');

        if (blank($key)) {
            throw new RuntimeException(
                'SHOP_XENDIFY_SECRET_KEY is not set — cannot reach Xendify.'
            );
        }

        return Http::baseUrl(rtrim(config('shop.xendify.base_url'), '/'))
            ->withToken($key)
            ->acceptJson()
            ->timeout(20)
            // `throw: false` — a retry that exhausts its attempts otherwise raises a
            // RequestException, which would skip the `$response->failed()` handling
            // below and turn a temporary provider outage into an unhandled error.
            ->retry(2, 250, throw: false);
    }

    /**
     * True when the body is an explicit rejection rather than a transport failure.
     *
     * `success: false` is the reliable signal; `status` is "00" on success and a
     * numeric code ("24") on rejection. Absent both, assume nothing is wrong and
     * let the account-number check decide.
     */
    private function rejected(array $data): bool
    {
        if (array_key_exists('success', $data)) {
            return $data['success'] === false || $data['success'] === 'false';
        }

        $status = $this->pick($data, ['status']);

        return is_string($status) && preg_match('/^\d{2}$/', $status) && $status !== '00';
    }

    /** Their responses may or may not wrap the useful fields in `data`. */
    private function unwrap(array $body): array
    {
        foreach (['data', 'result', 'response'] as $key) {
            if (isset($body[$key]) && is_array($body[$key])) {
                return $body[$key];
            }
        }

        return $body;
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  list<string>  $keys
     */
    private function pick(array $data, array $keys): mixed
    {
        foreach ($keys as $key) {
            if (isset($data[$key]) && $data[$key] !== '') {
                return $data[$key];
            }
        }

        return null;
    }

    /** `00` is Xendify's success code; the rest are strings like "success". */
    private function normaliseStatus(string $status): string
    {
        return match (true) {
            in_array($status, ['00', 'success', 'successful', 'completed', 'paid'], true) => PaymentResult::SUCCESS,
            in_array($status, ['failed', 'declined', 'reversed', 'cancelled'], true) => PaymentResult::FAILED,
            default => PaymentResult::PENDING,
        };
    }

    private function parseDate(mixed $value): ?Carbon
    {
        try {
            return Carbon::parse((string) $value);
        } catch (\Throwable) {
            return null;
        }
    }
}
