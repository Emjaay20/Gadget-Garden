<?php

namespace App\Shop;

use App\Models\DeliveryZone;
use App\Models\Product;
use App\Models\ProductUnit;
use Illuminate\Support\Collection;

/**
 * Turns what the browser sent into priced, availability-checked lines.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE BROWSER IS NEVER BELIEVED ABOUT MONEY.
 *
 * A cart request carries identifiers and quantities and nothing else. Prices are
 * read from the catalogue here, every time. A cart that sat in someone's
 * localStorage for three weeks while the price changed is re-priced at today's
 * figure, and a request with a hand-edited price is simply ignored because there
 * is nowhere for that number to go.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The same resolution backs both the cart page (so a machine someone else bought
 * is flagged BEFORE checkout, not after) and order creation itself.
 */
class ResolvesCart
{
    /**
     * @param  array<int, array{product_unit_id?: string|int|null, product_id?: string|int|null, quantity?: int}>  $items
     * @return Collection<int, CartLine>
     */
    public function resolve(array $items): Collection
    {
        $unitIds = collect($items)->pluck('product_unit_id')->filter()->all();
        $productIds = collect($items)->pluck('product_id')->filter()->all();

        // Two queries regardless of cart size.
        $units = ProductUnit::with('product')->whereIn('id', $unitIds)->get()->keyBy('id');
        $products = Product::whereIn('id', $productIds)->get()->keyBy('id');

        return collect($items)
            ->map(fn (array $item) => $this->resolveLine($item, $units, $products))
            ->filter()
            ->values();
    }

    /**
     * @param  array{product_unit_id?: string|int|null, product_id?: string|int|null, quantity?: int}  $item
     * @param  Collection<int, ProductUnit>  $units
     * @param  Collection<int, Product>  $products
     */
    private function resolveLine(array $item, Collection $units, Collection $products): ?CartLine
    {
        $quantity = max(1, (int) ($item['quantity'] ?? 1));

        if (! empty($item['product_unit_id'])) {
            return $this->resolveUnitLine($units->get((int) $item['product_unit_id']));
        }

        if (! empty($item['product_id'])) {
            return $this->resolveProductLine($products->get((int) $item['product_id']), $quantity);
        }

        // Neither identifier — nothing to resolve, and nothing worth erroring
        // over. Drop the line silently rather than failing a whole checkout.
        return null;
    }

    private function resolveUnitLine(?ProductUnit $unit): ?CartLine
    {
        if (! $unit || ! $unit->product) {
            return null;
        }

        // Quantity is FORCED to 1. There is exactly one of this machine in the
        // world; a database CHECK enforces the same thing on the order line.
        $line = fn (?string $problem) => new CartLine(
            product: $unit->product,
            unit: $unit,
            quantity: 1,
            unitPrice: (int) $unit->price,
            problem: $problem,
        );

        if (! $unit->product->is_active) {
            return $line('This listing is no longer available.');
        }

        return match ($unit->status) {
            ProductUnit::STATUS_AVAILABLE => $line(null),
            ProductUnit::STATUS_RESERVED => $line('Someone is checking out with this one right now.'),
            ProductUnit::STATUS_SOLD => $line('This exact machine has just been sold.'),
            default => $line('This machine is not currently for sale.'),
        };
    }

    private function resolveProductLine(?Product $product, int $quantity): ?CartLine
    {
        if (! $product) {
            return null;
        }

        $line = fn (?string $problem, ?int $qty = null) => new CartLine(
            product: $product,
            unit: null,
            quantity: $qty ?? $quantity,
            unitPrice: (int) $product->price,
            problem: $problem,
        );

        if (! $product->is_active) {
            return $line('This product is no longer available.');
        }

        if ($product->isUnitKind()) {
            // A serialized listing cannot be bought as a quantity — the customer
            // has to pick a specific machine.
            return $line('Choose a specific machine for this model.');
        }

        $available = (int) $product->stock;

        if ($available <= 0) {
            return $line('Out of stock.');
        }

        if ($quantity > $available) {
            return $line(
                $available === 1
                    ? 'Only 1 left — quantity reduced.'
                    : "Only {$available} left — quantity reduced.",
                $available,
            );
        }

        return $line(null);
    }

    /**
     * Delivery, computed from the zone row — never from anything the browser
     * sends. `feeFor` applies the free-delivery threshold.
     */
    public function deliveryFee(?DeliveryZone $zone, int $subtotal): int
    {
        return $zone?->feeFor($subtotal) ?? 0;
    }
}
