<?php

namespace App\Payments;

use Illuminate\Support\Carbon;

/**
 * What the customer must do next to pay.
 *
 * Generalised from the original plan, which assumed every provider is a redirect
 * handshake returning an `authorization_url`. Xendify's dedicated-virtual-account
 * flow is not that: nothing is redirected anywhere — the customer is shown a bank
 * account and transfers to it from their own banking app, possibly hours later.
 *
 * So an instruction is either a URL to send them to, or an account to send money
 * to. Both shapes fit here, and the controller never has to know which provider is
 * bound.
 */
final class PaymentInstruction
{
    /**
     * @param  array<string, mixed>  $raw
     */
    public function __construct(
        /** The provider's reference for this attempt. */
        public readonly string $reference,
        public readonly ?string $authorizationUrl = null,
        public readonly ?string $accountNumber = null,
        public readonly ?string $accountName = null,
        public readonly ?string $bankName = null,
        /** When the virtual account stops accepting transfers, if it does. */
        public readonly ?Carbon $expiresAt = null,
        public readonly array $raw = [],
    ) {}

    public function isTransfer(): bool
    {
        return filled($this->accountNumber);
    }
}
