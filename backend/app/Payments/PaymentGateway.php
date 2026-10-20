<?php

namespace App\Payments;

use App\Models\Order;
use App\Models\Payment;
use Illuminate\Http\Request;

/**
 * A payment provider.
 *
 * No provider is baked into a controller: adding one is a new class implementing
 * this, plus `SHOP_PAYMENT_PROVIDER=<name>`.
 */
interface PaymentGateway
{
    public function name(): string;

    /**
     * Ask the provider for a payment instruction — a virtual account, or a
     * redirect URL, depending on the provider.
     */
    public function initialize(Order $order): PaymentInstruction;

    /**
     * Ask the provider directly whether a payment landed. This is what the
     * customer's poll and staff rechecks run on; the webhook settles on its own.
     *
     * Takes the whole Payment rather than one identifier because providers differ
     * on which one they will answer to: the mock accepts either, while Xendify's
     * `/transaction_verify/{trx}` accepts ONLY its own `trx` — an id that does not
     * exist until the collection webhook delivers it. A gateway that cannot yet
     * identify the payment must answer pending, never failed.
     */
    public function verify(Payment $payment): PaymentResult;

    /**
     * Whether this request genuinely came from the provider — a shared bearer key,
     * a signature, whatever that provider uses.
     *
     * Returning false MUST make the caller refuse the webhook. Returning true is
     * what authorises settlement from the body, so a gateway that cannot actually
     * authenticate its provider must return false rather than shrug.
     */
    public function authenticateWebhook(Request $request): bool;

    /** Pull the identifying fields out of a webhook body. */
    public function parseWebhook(Request $request): WebhookEvent;
}
