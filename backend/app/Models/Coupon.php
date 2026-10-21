<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'code',
    'description',
    'type',
    'value',
    'min_order_amount',
    'max_discount',
    'starts_at',
    'expires_at',
    'usage_limit',
    'used_count',
    'is_first_order_only',
    'is_active',
])]
class Coupon extends Model
{
    use HasFactory;

    public const TYPE_FIXED = 'fixed';

    public const TYPE_PERCENT = 'percent';

    protected function casts(): array
    {
        return [
            'value' => 'integer',
            'min_order_amount' => 'integer',
            'max_discount' => 'integer',
            'starts_at' => 'datetime',
            'expires_at' => 'datetime',
            'usage_limit' => 'integer',
            'used_count' => 'integer',
            'is_first_order_only' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    protected $attributes = [
        'type' => self::TYPE_FIXED,
        'min_order_amount' => 0,
        'used_count' => 0,
        'is_first_order_only' => false,
        'is_active' => true,
    ];

    public function isExpired(): bool
    {
        if ($this->starts_at && now()->lt($this->starts_at)) {
            return true;
        }

        if ($this->expires_at && now()->gt($this->expires_at)) {
            return true;
        }

        return false;
    }

    public function hasReachedLimit(): bool
    {
        return $this->usage_limit !== null && $this->used_count >= $this->usage_limit;
    }

    /**
     * Evaluates whether this coupon can be applied to the given subtotal & customer email,
     * and calculates the integer whole-naira discount amount.
     *
     * @return array{valid: bool, discount: int, error: ?string}
     */
    public function validateFor(int $subtotal, ?string $email = null): array
    {
        if (! $this->is_active) {
            return ['valid' => false, 'discount' => 0, 'error' => 'This promo code is no longer active.'];
        }

        if ($this->isExpired()) {
            return ['valid' => false, 'discount' => 0, 'error' => 'This promo code has expired.'];
        }

        if ($this->hasReachedLimit()) {
            return ['valid' => false, 'discount' => 0, 'error' => 'This promo code has reached its maximum redemptions.'];
        }

        if ($subtotal < $this->min_order_amount) {
            return [
                'valid' => false,
                'discount' => 0,
                'error' => 'Minimum order amount for this coupon is ₦'.number_format($this->min_order_amount).'.',
            ];
        }

        if ($this->is_first_order_only && $email) {
            $hasPreviousOrders = Order::where('contact_email', $email)
                ->whereIn('status', [Order::PAID, Order::PROCESSING, Order::SHIPPED, Order::DELIVERED])
                ->exists();

            if ($hasPreviousOrders) {
                return [
                    'valid' => false,
                    'discount' => 0,
                    'error' => 'This promo code is valid for first-time buyers only.',
                ];
            }
        }

        $discount = 0;
        if ($this->type === self::TYPE_PERCENT) {
            $computed = (int) floor(($subtotal * $this->value) / 100);
            if ($this->max_discount !== null && $computed > $this->max_discount) {
                $computed = $this->max_discount;
            }
            $discount = min($computed, $subtotal);
        } else {
            // Fixed whole naira
            $discount = min($this->value, $subtotal);
        }

        return [
            'valid' => true,
            'discount' => $discount,
            'error' => null,
        ];
    }
}
