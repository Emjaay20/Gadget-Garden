<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

#[Fillable([
    'reference', 'customer_id', 'address_id', 'subtotal', 'delivery_fee',
    'total', 'currency', 'coupon_code', 'discount_amount', 'contact_name',
    'contact_email', 'contact_phone', 'placed_at', 'reserved_until', 'payment_mode',
    'layaway_due_at',
])]
class Order extends Model
{
    public const PAYMENT_MODE_FULL = 'full';

    public const PAYMENT_MODE_LAYAWAY = 'layaway';
    use HasFactory, SoftDeletes;

    public const PENDING_PAYMENT = 'pending_payment';

    public const PAID = 'paid';

    public const PROCESSING = 'processing';

    public const SHIPPED = 'shipped';

    public const DELIVERED = 'delivered';

    public const FAILED = 'failed';

    public const CANCELLED = 'cancelled';

    /**
     * In-memory defaults that MIRROR the database defaults.
     *
     * Eloquent does not read a column default back after an insert, so without
     * this a freshly created order has `currency = null` and `status = null` in
     * memory even though the row on disk is correct. That is not theoretical: the
     * payment gateway sends `$order->currency` to Xendify, and a null there
     * reaches the provider as a missing currency. Caught by
     * XendifyGatewayTest — the fix belongs here rather than in a `fresh()` call
     * at each site, because every future caller would have to remember it.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'status' => self::PENDING_PAYMENT,
        'currency' => 'NGN',
        'discount_amount' => 0,
        'coupon_code' => null,
        'payment_mode' => self::PAYMENT_MODE_FULL,
        'layaway_paid_amount' => 0,
    ];

    /**
     * `status` is deliberately NOT fillable. An order's status is a claim about
     * money and about physical goods leaving the building — it is only ever set
     * by the code that owns that transition (SettlesPayments, or a staff action
     * behind `orders.manage`), never by mass assignment from a request body.
     */
    protected function casts(): array
    {
        return [
            'placed_at' => 'datetime',
            'paid_at' => 'datetime',
            'reserved_until' => 'datetime',
            'subtotal' => 'integer',
            'delivery_fee' => 'integer',
            'discount_amount' => 'integer',
            'total' => 'integer',
            'layaway_paid_amount' => 'integer',
            'layaway_minimum_payment' => 'integer',
            'layaway_due_at' => 'datetime',
        ];
    }

    /* ------------------------------------------------------------ relations */

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function address(): BelongsTo
    {
        return $this->belongsTo(Address::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function units(): HasMany
    {
        return $this->hasMany(ProductUnit::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function getRouteKeyName(): string
    {
        return 'reference';
    }

    /* -------------------------------------------------------------- helpers */

    /**
     * A reference a customer can read down a phone line: GG-7F3K2Q.
     *
     * Crockford's alphabet — no I, L, O, U — because the whole point is that
     * someone reads it aloud to the desk, and 0/O and 1/I/L are exactly where
     * that goes wrong. `U` is dropped as well, which also keeps the generator
     * from accidentally spelling anything unfortunate.
     */
    public static function generateReference(): string
    {
        do {
            $reference = 'GG-'.Str::upper(Str::random(6));
            $reference = str_replace(['I', 'L', 'O', 'U'], ['J', 'M', 'P', 'V'], $reference);
        } while (self::withTrashed()->where('reference', $reference)->exists());

        return $reference;
    }

    /**
     * Statuses in which an order may still be HOLDING reserved stock.
     *
     * `failed` belongs here, and that is not obvious. A failed transfer is very
     * often retried within minutes, so `SettlesPayments` deliberately leaves the
     * reservation in place rather than releasing it instantly and letting someone
     * else take the machine. But that means a failed order holds stock, so the
     * expiry sweeper MUST be able to collect it — otherwise a single failed
     * payment removes a one-of-a-kind laptop from the catalogue permanently.
     */
    public const HOLDING_STATUSES = [self::PENDING_PAYMENT, self::FAILED];

    public function isPaid(): bool
    {
        return ! in_array($this->status, [
            self::PENDING_PAYMENT,
            self::FAILED,
            self::CANCELLED,
        ], true);
    }

    public function isLayaway(): bool
    {
        return $this->payment_mode === self::PAYMENT_MODE_LAYAWAY;
    }

    public function layawayBalance(): int
    {
        return max(0, (int) $this->total - (int) $this->layaway_paid_amount);
    }

    /** Awaiting payment: the only state from which a customer can still pay. */
    public function isOpen(): bool
    {
        return $this->status === self::PENDING_PAYMENT;
    }

    /** Might still be sitting on reserved machines. */
    public function isHoldingStock(): bool
    {
        return in_array($this->status, self::HOLDING_STATUSES, true);
    }

    /**
     * Has the hold on this order's stock run out?
     *
     * Mirrors `scopeExpired` exactly — `isHoldingStock()`, not `isOpen()`, so a
     * failed order is included. The two must agree or the sweeper and this check
     * would disagree about the same row.
     */
    public function hasExpired(): bool
    {
        return $this->isHoldingStock()
            && $this->reserved_until !== null
            && $this->reserved_until->isPast();
    }

    /* --------------------------------------------------------------- scopes */

    /**
     * Orders whose hold has run out and whose stock should go back on the shelf.
     *
     * Covers `failed` as well as `pending_payment` — see HOLDING_STATUSES.
     *
     * @param  Builder<Order>  $query
     */
    public function scopeExpired(Builder $query): void
    {
        $query->whereIn('status', self::HOLDING_STATUSES)
            ->whereNotNull('reserved_until')
            ->where('reserved_until', '<', now());
    }
}
