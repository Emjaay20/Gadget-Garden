<?php

namespace App\Shop;

use App\Models\Product;
use App\Models\ProductUnit;

/**
 * One line of a cart, resolved against the database.
 *
 * The browser sends identifiers and quantities; it never sends prices. This is
 * what those identifiers resolve to server-side, priced from the catalogue as it
 * stands right now.
 */
final class CartLine
{
    public function __construct(
        public readonly Product $product,
        public readonly ?ProductUnit $unit,
        public readonly int $quantity,
        public readonly int $unitPrice,
        /** Null when the line is fine; a human sentence when it is not. */
        public readonly ?string $problem = null,
    ) {}

    public function isAvailable(): bool
    {
        return $this->problem === null;
    }

    public function lineTotal(): int
    {
        return $this->unitPrice * $this->quantity;
    }

    /** The stable key the storefront uses to identify this line in its cart. */
    public function key(): string
    {
        return $this->unit
            ? "unit:{$this->unit->id}"
            : "product:{$this->product->id}";
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'key' => $this->key(),
            'product_id' => (string) $this->product->id,
            'product_slug' => $this->product->slug,
            'product_unit_id' => $this->unit ? (string) $this->unit->id : null,
            'name' => $this->product->name,
            'sku' => $this->unit?->sku,
            'brand' => $this->product->brand,
            'condition' => $this->unit?->condition,
            'specs' => $this->unit?->specs ?? $this->product->base_specs ?? [],
            'unit_price' => $this->unitPrice,
            'quantity' => $this->quantity,
            'line_total' => $this->lineTotal(),
            'is_available' => $this->isAvailable(),
            'problem' => $this->problem,
        ];
    }
}
