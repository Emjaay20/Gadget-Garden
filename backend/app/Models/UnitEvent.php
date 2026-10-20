<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One line in a machine's history. Append-only — see the migration.
 */
#[Fillable([
    'product_unit_id', 'event', 'from_status', 'to_status',
    'order_id', 'order_reference', 'user_id', 'note',
])]
class UnitEvent extends Model
{
    public const ACQUIRED = 'acquired';

    public const LISTED = 'listed';

    public const RESERVED = 'reserved';

    public const RESERVATION_RELEASED = 'reservation_released';

    public const SOLD = 'sold';

    public const RETURNED = 'returned';

    public const REPAIRED = 'repaired';

    public const WRITTEN_OFF = 'written_off';

    public const CORRECTED = 'corrected';

    /** Append-only rows have nothing to update. */
    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(ProductUnit::class, 'product_unit_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
