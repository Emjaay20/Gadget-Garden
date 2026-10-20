<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One line on an order. Everything is snapshotted — see the migration.
 */
#[Fillable([
    'product_id', 'product_unit_id', 'name_at_time', 'sku_at_time',
    'specs_at_time', 'condition_at_time', 'unit_price_at_time',
    'quantity', 'line_total',
])]
class OrderItem extends Model
{
    protected function casts(): array
    {
        return ['specs_at_time' => 'array'];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(ProductUnit::class, 'product_unit_id');
    }

    /** A serialized line is one specific machine; a stocked line is a quantity. */
    public function isUnitLine(): bool
    {
        return $this->product_unit_id !== null;
    }
}
