<?php

namespace App\Payments;

use Illuminate\Support\Carbon;

/**
 * A provider webhook, normalised.
 *
 * The webhook is the settlement trigger AND its evidence: an authenticated call
 * from the provider is taken at its word, so `status` and `amount` here decide the
 * outcome. What makes that safe is `PaymentGateway::authenticateWebhook()` — a body
 * that has not proved it came from the provider never reaches this class.
 *
 * The amount still matters as much as the status: a virtual account will accept
 * ₦500 against a ₦70,000 order, and `SettlesPayments` compares before settling.
 */
final class WebhookEvent
{
    /**
     * @param  array<string, mixed>  $raw
     */
    public function __construct(
        /** The provider's transaction id. */
        public readonly ?string $transactionId = null,
        /** Our reference, if the provider echoes it back. */
        public readonly ?string $reference = null,
        /** The virtual account credited — how a transfer maps back to an order. */
        public readonly ?string $accountNumber = null,
        public readonly ?int $amount = null,
        /** Normalised to one of PaymentResult's constants by the gateway. */
        public readonly string $status = PaymentResult::PENDING,
        public readonly ?Carbon $paidAt = null,
        public readonly array $raw = [],
    ) {}

    /** True when there is at least one way to identify the payment. */
    public function isIdentifiable(): bool
    {
        return filled($this->transactionId) || filled($this->reference) || filled($this->accountNumber);
    }

    /**
     * The event as a settlement decision, for `SettlesPayments::settle()`.
     *
     * Same shape a `verify()` call returns, so both paths into settlement stay
     * identical and there is only ever one place an order becomes paid.
     */
    public function toResult(): PaymentResult
    {
        return new PaymentResult(
            status: $this->status,
            amount: $this->amount,
            transactionId: $this->transactionId,
            paidAt: $this->paidAt,
            raw: $this->raw,
        );
    }
}
