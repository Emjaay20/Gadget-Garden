<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

#[Fillable([
    'reference',
    'product_id',
    'product_unit_id',
    'customer_name',
    'customer_email',
    'customer_phone',
    'original_price',
    'offered_price',
    'counter_price',
    'agreed_price',
    'status',
    'responded_by',
    'customer_note',
    'staff_note',
    'expires_at',
    'converted_at',
    'order_id',
])]
class Offer extends Model
{
    use HasFactory, SoftDeletes;

    public const STATUS_PENDING = 'pending';

    public const STATUS_COUNTERED = 'countered';

    public const STATUS_ACCEPTED = 'accepted';

    public const STATUS_DECLINED = 'declined';

    public const STATUS_EXPIRED = 'expired';

    public const STATUS_CONVERTED = 'converted';

    protected function casts(): array
    {
        return [
            'original_price' => 'integer',
            'offered_price' => 'integer',
            'counter_price' => 'integer',
            'agreed_price' => 'integer',
            'expires_at' => 'datetime',
            'converted_at' => 'datetime',
        ];
    }

    public static function generateReference(): string
    {
        do {
            $ref = 'OFF-'.strtoupper(Str::random(8));
        } while (static::where('reference', $ref)->exists());

        return $ref;
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(ProductUnit::class, 'product_unit_id');
    }

    public function responder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responded_by');
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function isExpired(): bool
    {
        if ($this->status === self::STATUS_EXPIRED) {
            return true;
        }

        if ($this->expires_at && $this->expires_at->isPast()) {
            return true;
        }

        return false;
    }

    public function isActionable(): bool
    {
        return in_array($this->status, [self::STATUS_PENDING, self::STATUS_COUNTERED], true)
            && ! $this->isExpired();
    }
}
