<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One line in a stocked product's ledger. Append-only.
 *
 * Reasons are DIRECTIONAL, and the sign is validated against them at the API
 * boundary: `restock` and `return` add, `sale` and `damage` remove, `correction`
 * may go either way. A "restock: -4" is a typo, not a restock.
 */
#[Fillable([
    'product_id', 'delta', 'stock_before', 'stock_after', 'reason',
    'note', 'order_id', 'order_reference', 'user_id',
])]
class StockMovement extends Model
{
    public const RESTOCK = 'restock';

    public const SALE = 'sale';

    public const RETURN = 'return';

    public const DAMAGE = 'damage';

    public const CORRECTION = 'correction';

    /** Append-only rows have nothing to update. */
    public const UPDATED_AT = null;

    /** Reasons that may only ever increase stock. */
    public const ADDITIVE = [self::RESTOCK, self::RETURN];

    /** Reasons that may only ever decrease it. */
    public const SUBTRACTIVE = [self::SALE, self::DAMAGE];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Whether a sign and a reason agree. */
    public static function signMatchesReason(int $delta, string $reason): bool
    {
        if (in_array($reason, self::ADDITIVE, true)) {
            return $delta > 0;
        }

        if (in_array($reason, self::SUBTRACTIVE, true)) {
            return $delta < 0;
        }

        return $reason === self::CORRECTION;
    }
}
