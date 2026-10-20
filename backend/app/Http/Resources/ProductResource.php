<?php

namespace App\Http\Resources;

use App\Models\Product;
use App\Models\ProductUnit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A catalogue listing.
 *
 * The shape is the SAME for both kinds, which is the whole point of the
 * abstraction: the storefront renders one card component whether it is looking
 * at a serialized laptop or a boxed charger.
 *
 *   `from_price`      what to show. Null when nothing is available.
 *   `price_is_from`   whether to prefix it with "from" — true for a unit
 *                     listing holding several machines at different prices.
 *   `available_count` how many can be bought right now.
 *
 * `available_count` and `from_price` are read from the columns attached by
 * `Product::scopeWithAvailability()` when present, and computed per-model
 * otherwise. The scope exists so a page of 24 products is a constant number of
 * queries rather than 24 extra ones; the fallback keeps the resource correct
 * when a caller forgot it, instead of returning silently wrong numbers.
 *
 * @mixin Product
 */
class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $availableCount = $this->resolveAvailableCount();
        $fromPrice = $this->resolveFromPrice();

        return [
            'id' => (string) $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'brand' => $this->brand,
            'kind' => $this->kind,
            'category' => new CategoryResource($this->whenLoaded('category')),

            'short_description' => $this->short_description,
            'description' => $this->whenNotNull($this->description),
            'youtube_url' => $this->youtube_url,
            'highlights' => $this->highlights ?? [],
            'properties' => $this->properties ?? [],
            'base_specs' => $this->base_specs ?? [],

            /*
             | The specs to print on a card: those of the machine whose price is
             | being shown. A card carrying only a name and a price cannot
             | distinguish two ThinkPads ₦200,000 apart, which makes it an
             | invitation to a blind click.
             */
            'summary_specs' => $this->resolveSummarySpecs(),

            'warranty_months' => (int) $this->warranty_months,

            'from_price' => $fromPrice,
            'compare_at_price' => $this->compare_at_price === null
                ? null
                : (int) $this->compare_at_price,
            'currency' => $this->currency,

            /*
             | True only when there is genuinely a range to summarise. A listing
             | with ONE machine left shows its actual price — "from ₦620,000"
             | when ₦620,000 is the only option reads as evasive on a brand that
             | sells on trust.
             */
            'price_is_from' => $this->isUnitKind() && $availableCount > 1,

            'available_count' => $availableCount,
            'in_stock' => $availableCount > 0,
            'is_low_stock' => $availableCount > 0
                && $availableCount <= (int) $this->low_stock_threshold,

            /*
             | The condition a buyer will get. Derived from the units rather than
             | stored, because it is a property of what is physically on the
             | shelf: a listing whose foreign-used machines have all sold, with
             | one new one left, is a NEW listing today.
             */
            'condition' => $this->resolveCondition(),

            'is_featured' => (bool) $this->is_featured,
            'images' => ProductImageResource::collection($this->whenLoaded('images')),
            'units' => ProductUnitResource::collection($this->whenLoaded('availableUnits')),
        ];
    }

    private function resolveAvailableCount(): int
    {
        // Attached by scopeWithAvailability(); absent on a plain find().
        if ($this->isUnitKind()) {
            return $this->unit_available_count !== null
                ? (int) $this->unit_available_count
                : $this->availableCount();
        }

        return max(0, (int) $this->stock);
    }

    private function resolveFromPrice(): ?int
    {
        if (! $this->isUnitKind()) {
            return (int) $this->stock > 0 ? (int) $this->price : null;
        }

        if ($this->unit_from_price !== null) {
            return (int) $this->unit_from_price;
        }

        return $this->displayPrice();
    }

    /**
     * Specs for the card, resolved in the same order as the price it sits under.
     *
     * @return array<string, mixed>
     */
    private function resolveSummarySpecs(): array
    {
        if (! $this->isUnitKind()) {
            return $this->base_specs ?? [];
        }

        // Attached by scopeWithAvailability(). Postgres hands json back as a
        // string through a subquery select, so it needs decoding.
        if (array_key_exists('unit_specs', $this->getAttributes())) {
            $raw = $this->getAttributes()['unit_specs'];

            if (is_string($raw)) {
                return json_decode($raw, true) ?: [];
            }

            return is_array($raw) ? $raw : [];
        }

        if ($this->relationLoaded('availableUnits')) {
            return $this->availableUnits->first()?->specs ?? [];
        }

        return $this->units()
            ->where('status', ProductUnit::STATUS_AVAILABLE)
            ->orderBy('price')
            ->orderBy('id')
            ->value('specs') ?? [];
    }

    /**
     * The single condition to badge, or null when the available machines
     * genuinely differ and no one badge would be honest.
     */
    private function resolveCondition(): ?string
    {
        if (! $this->isUnitKind()) {
            return ProductUnit::CONDITION_NEW;
        }

        /*
         | Preferred path: the aggregate attached by scopeWithAvailability().
         | Checked by KEY rather than by value, because a legitimately null
         | aggregate (nothing available) must still count as "the scope ran" —
         | otherwise it falls through to the per-product query below and
         | reintroduces the N+1 the scope exists to prevent.
         */
        if (array_key_exists('unit_conditions', $this->getAttributes())) {
            $joined = $this->getAttributes()['unit_conditions'];

            if ($joined === null || $joined === '') {
                return null;
            }

            $conditions = explode(',', $joined);

            return count($conditions) === 1 ? $conditions[0] : null;
        }

        if ($this->relationLoaded('availableUnits')) {
            $conditions = $this->availableUnits->pluck('condition')->unique();

            return $conditions->count() === 1 ? $conditions->first() : null;
        }

        // Last resort — correct, but one query. Only reached by a caller that
        // used neither the scope nor the eager load.
        $conditions = $this->units()
            ->where('status', ProductUnit::STATUS_AVAILABLE)
            ->distinct()
            ->pluck('condition');

        return $conditions->count() === 1 ? $conditions->first() : null;
    }
}
