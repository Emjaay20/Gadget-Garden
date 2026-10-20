<?php

namespace App\Payments\Gateways;

use App\Models\Order;
use App\Models\Payment;
use App\Payments\MockLedger;
use App\Payments\PaymentGateway;
use App\Payments\PaymentInstruction;
use App\Payments\PaymentResult;
use App\Payments\WebhookEvent;
use Illuminate\Http\Request;

/**
 * A no-network stand-in for local development and tests.
 *
 * Mimics the real flow's SHAPE, not a redirect: it mints a fake virtual account so
 * the storefront's "transfer to this account" screen and its polling both work
 * offline, exactly as they will against Xendify.
 *
 * Settlement is driven by `App\Payments\MockLedger`, which the mock pay page pokes
 * to say "pretend the customer transferred". Until something does that, `verify()`
 * answers pending — the same honest answer the real gateway gives while a customer
 * is still queueing at their banking app.
 */
class MockGateway implements PaymentGateway
{
    public function name(): string
    {
        return 'mock';
    }

    public function initialize(Order $order): PaymentInstruction
    {
        // Deterministic from the reference, so re-initialising an order shows the
        // same account rather than confusing the customer with a new one.
        $digits = substr(preg_replace('/\D/', '', crc32($order->reference).'0000000000'), 0, 10);

        return new PaymentInstruction(
            reference: $order->reference,
            accountNumber: $digits,
            accountName: 'GADGETS GARDEN / '.strtoupper($order->contact_name),
            bankName: 'Test Bank (mock)',
            expiresAt: now()->addDay(),
            raw: ['mock' => true, 'order' => $order->reference],
        );
    }

    public function verify(Payment $payment): PaymentResult
    {
        // Accept either our own reference or the `MOCK-…` transaction id this
        // gateway hands out. Unlike Xendify the mock can answer from the first poll,
        // which is what keeps the local pay page settling without a webhook.
        $reference = $payment->provider_transaction_id ?: $payment->provider_reference;

        $settled = MockLedger::get($reference)
            ?? MockLedger::get(preg_replace('/^MOCK-/', '', $reference));

        if ($settled === null) {
            return PaymentResult::pending(['mock' => true]);
        }

        if ($settled['outcome'] === 'failed') {
            return PaymentResult::failed(['mock' => true]);
        }

        return new PaymentResult(
            status: PaymentResult::SUCCESS,
            amount: $settled['amount'],
            transactionId: 'MOCK-'.$reference,
            paidAt: now(),
            raw: ['mock' => true],
        );
    }

    /**
     * Nothing to authenticate offline — which means a local webhook body settles an
     * order on its own. That is the point of the mock, and the reason it 404s the
     * dev-only routes and must never be the bound provider in production.
     */
    public function authenticateWebhook(Request $request): bool
    {
        return true;
    }

    public function parseWebhook(Request $request): WebhookEvent
    {
        return new WebhookEvent(
            transactionId: $request->input('trx'),
            reference: $request->input('reference'),
            accountNumber: $request->input('receiving_account'),
            amount: $request->has('amount') ? (int) round((float) $request->input('amount')) : null,
            // Mirrors Xendify: `00` is the success code, anything unrecognised is
            // pending and settles nothing.
            status: match (strtolower((string) $request->input('status'))) {
                '00', 'success', 'successful', 'paid' => PaymentResult::SUCCESS,
                'failed', 'declined', 'reversed', 'cancelled' => PaymentResult::FAILED,
                default => PaymentResult::PENDING,
            },
            paidAt: $request->has('status') ? now() : null,
            raw: $request->all(),
        );
    }
}
