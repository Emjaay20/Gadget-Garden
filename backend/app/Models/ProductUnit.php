<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * One physical machine. See the migration for the reservation rule.
 *
 * `cost` is hidden by default: it is what the business paid, it backs margin
 * reporting, and it must never leak into a public response. A resource that
 * wants it has to ask for it explicitly, behind `reports.view`.
 */
#[Fillable([
    'product_id', 'sku', 'serial', 'imei', 'condition', 'grade',
    'specs', 'price', 'cost', 'note',
])]
#[Hidden(['cost', 'serial', 'imei'])]
class ProductUnit extends Model
{
    use HasFactory;

    public const STATUS_AVAILABLE = 'available';

    public const STATUS_RESERVED = 'reserved';

    public const STATUS_SOLD = 'sold';

    public const STATUS_RETURNED = 'returned';

    public const STATUS_FAULTY = 'faulty';

    public const CONDITION_NEW = 'new';

    public const CONDITION_FOREIGN_USED = 'foreign_used';

    public const CONDITION_REFURBISHED = 'refurbished';

    protected function casts(): array
    {
        return [
            'specs' => 'array',
            'reserved_until' => 'datetime',
            // Encrypted at rest: these identify a specific device and are what a
            // warranty dispute or a stolen-goods claim turns on.
            'serial' => 'encrypted',
            'imei' => 'encrypted',
        ];
    }

    /* ------------------------------------------------------------ relations */

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(UnitEvent::class)->latest('created_at');
    }

    public function images(): MorphMany
    {
        return $this->morphMany(ProductImage::class, 'imageable')->orderBy('position');
    }

    public function getRouteKeyName(): string
    {
        return 'sku';
    }

    /* -------------------------------------------------------------- history */

    /**
     * Append a row to this unit's history. Never updates, never deletes — a
     * correction is a new event.
     */
    public function recordEvent(
        string $event,
        ?string $fromStatus = null,
        ?string $toStatus = null,
        array $attributes = [],
    ): UnitEvent {
        return $this->events()->create([
            'event' => $event,
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'order_id' => $attributes['order_id'] ?? null,
            'order_reference' => $attributes['order_reference'] ?? null,
            'user_id' => $attributes['user_id'] ?? null,
            'note' => $attributes['note'] ?? null,
        ]);
    }

    /* --------------------------------------------------------- transitions */

    /**
     * Hold this machine for an order that has not been paid for yet.
     *
     * THE RACE THIS CLOSES: two customers checking out with the same laptop.
     * The row is re-read under `lockForUpdate` inside the transaction, so the
     * second caller blocks until the first commits and then sees `reserved` —
     * rather than both reading `available` and both being told yes.
     *
     * Returns false rather than throwing when the unit is already taken: at
     * checkout that is an ordinary outcome the caller reports to the customer,
     * not an exceptional one.
     */
    public function reserveFor(int $orderId, string $orderReference, Carbon $until): bool
    {
        return DB::transaction(function () use ($orderId, $orderReference, $until) {
            /** @var self|null $locked */
            $locked = self::query()->lockForUpdate()->find($this->id);

            if (! $locked || $locked->status !== self::STATUS_AVAILABLE) {
                return false;
            }

            $locked->forceFill([
                'status' => self::STATUS_RESERVED,
                'reserved_until' => $until,
                'order_id' => $orderId,
            ])->save();

            $locked->recordEvent(
                UnitEvent::RESERVED,
                self::STATUS_AVAILABLE,
                self::STATUS_RESERVED,
                ['order_id' => $orderId, 'order_reference' => $orderReference],
            );

            $this->refresh();

            return true;
        });
    }

    /**
     * Put an unpaid hold back on the shelf. Driven by `orders:expire-unpaid` and
     * by a cancelled order.
     */
    public function releaseReservation(?string $note = null): bool
    {
        return DB::transaction(function () use ($note) {
            /** @var self|null $locked */
            $locked = self::query()->lockForUpdate()->find($this->id);

            if (! $locked || $locked->status !== self::STATUS_RESERVED) {
                return false;
            }

            $orderId = $locked->order_id;

            $locked->forceFill([
                'status' => self::STATUS_AVAILABLE,
                'reserved_until' => null,
                'order_id' => null,
            ])->save();

            $locked->recordEvent(
                UnitEvent::RESERVATION_RELEASED,
                self::STATUS_RESERVED,
                self::STATUS_AVAILABLE,
                ['order_id' => $orderId, 'note' => $note],
            );

            $this->refresh();

            return true;
        });
    }

    /**
     * The machine is paid for and leaving.
     *
     * Accepts `available` as well as `reserved`: an order paid through a path
     * that never reserved (a staff-entered walk-in sale) is legitimate. It
     * refuses only an already-sold unit, which is the case that would mean
     * selling one laptop twice.
     */
    public function markSold(int $orderId, string $orderReference, ?int $userId = null): bool
    {
        return DB::transaction(function () use ($orderId, $orderReference, $userId) {
            /** @var self|null $locked */
            $locked = self::query()->lockForUpdate()->find($this->id);

            if (! $locked) {
                return false;
            }

            if ($locked->status === self::STATUS_SOLD) {
                // Idempotent: settlement can be driven twice (webhook + poll).
                // Selling it to the SAME order again is a no-op; to a different
                // one is a real conflict and must be loud.
                if ((int) $locked->order_id !== $orderId) {
                    throw new RuntimeException(
                        "Unit [{$locked->sku}] is already sold on another order."
                    );
                }

                return false;
            }

            if (! in_array($locked->status, [self::STATUS_AVAILABLE, self::STATUS_RESERVED], true)) {
                throw new RuntimeException(
                    "Unit [{$locked->sku}] cannot be sold from status [{$locked->status}]."
                );
            }

            $from = $locked->status;

            $locked->forceFill([
                'status' => self::STATUS_SOLD,
                'reserved_until' => null,
                'order_id' => $orderId,
            ])->save();

            $locked->recordEvent(
                UnitEvent::SOLD,
                $from,
                self::STATUS_SOLD,
                [
                    'order_id' => $orderId,
                    'order_reference' => $orderReference,
                    'user_id' => $userId,
                ],
            );

            $this->refresh();

            return true;
        });
    }

    /* --------------------------------------------------------------- scopes */

    /** @param  Builder<ProductUnit>  $query */
    public function scopeAvailable(Builder $query): void
    {
        $query->where('status', self::STATUS_AVAILABLE);
    }

    /**
     * Reservations whose hold has run out — what the expiry sweeper collects.
     *
     * @param  Builder<ProductUnit>  $query
     */
    public function scopeExpiredReservations(Builder $query): void
    {
        $query->where('status', self::STATUS_RESERVED)
            ->where('reserved_until', '<', now());
    }
}
