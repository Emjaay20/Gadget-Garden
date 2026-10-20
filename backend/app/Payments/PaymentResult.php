<?php

namespace App\Payments;

use Illuminate\Support\Carbon;

/**
 * The provider's answer to "has this actually been paid?".
 *
 * `amount` is whole naira and matters as much as the status: a virtual
 * account will happily accept ₦500 against a ₦70,000 order, so the caller must
 * compare before treating a success as settled.
 */
final class PaymentResult
{
    public const SUCCESS = 'success';

    public const FAILED = 'failed';

    public const PENDING = 'pending';

    /**
     * @param  array<string, mixed>  $raw
     */
    public function __construct(
        public readonly string $status,
        public readonly ?int $amount = null,
        public readonly ?string $transactionId = null,
        public readonly ?Carbon $paidAt = null,
        public readonly array $raw = [],
    ) {}

    public function isSuccess(): bool
    {
        return $this->status === self::SUCCESS;
    }

    public static function pending(array $raw = []): self
    {
        return new self(self::PENDING, raw: $raw);
    }

    public static function failed(array $raw = []): self
    {
        return new self(self::FAILED, raw: $raw);
    }
}
