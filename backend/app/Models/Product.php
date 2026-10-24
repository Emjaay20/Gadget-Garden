<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * A catalogue listing. See the migration for why `kind` exists.
 *
 * `stock` is NOT fillable. It is a denormalised running total owned by the
 * ledger, and the only supported way to change it is `recordStockMovement()`.
 * Leaving it out of `#[Fillable]` is the first of three locks — the API rejects
 * a `stock` key with 422, and a CHECK constraint holds the arithmetic.
 */
#[Fillable([
    'slug', 'name', 'brand', 'kind', 'category_id', 'description',
    'short_description', 'youtube_url', 'highlights', 'properties', 'base_specs',
    'processor', 'ram_gb', 'storage_gb', 'storage_type', 'screen_size', 'resolution', 'graphics', 'color',
    'warranty_months', 'price', 'compare_at_price', 'low_stock_threshold',
    'currency', 'is_featured', 'is_active',
])]
class Product extends Model
{
    use HasFactory, SoftDeletes;

    public const KIND_UNIT = 'unit';

    public const KIND_STOCKED = 'stocked';

    /**
     * Mirrors the database default; see the note on Order.
     *
     * @var array<string, mixed>
     */
    protected $attributes = ['currency' => 'NGN'];

    protected function casts(): array
    {
        return [
            'highlights' => 'array',
            'properties' => 'array',
            'base_specs' => 'array',
            'ram_gb' => 'integer',
            'storage_gb' => 'integer',
            'is_featured' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    /* ------------------------------------------------------------ relations */

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function units(): HasMany
    {
        return $this->hasMany(ProductUnit::class);
    }

    public function availableUnits(): HasMany
    {
        return $this->units()
            ->where('status', ProductUnit::STATUS_AVAILABLE)
            ->orderBy('price');
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    public function images(): MorphMany
    {
        return $this->morphMany(ProductImage::class, 'imageable')->orderBy('position');
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /* -------------------------------------------------------------- helpers */

    public function isUnitKind(): bool
    {
        return $this->kind === self::KIND_UNIT;
    }

    /**
     * How many are actually buyable right now.
     *
     * For a unit listing this counts available machines; reserved ones are
     * excluded, because somebody is mid-checkout with them.
     */
    public function availableCount(): int
    {
        return $this->isUnitKind()
            ? $this->units()->where('status', ProductUnit::STATUS_AVAILABLE)->count()
            : (int) $this->stock;
    }

    /**
     * The number a card shows. Null when nothing is available — the caller
     * renders "Sold out" rather than a price for something nobody can buy.
     */
    public function displayPrice(): ?int
    {
        if (! $this->isUnitKind()) {
            return $this->stock > 0 ? (int) $this->price : null;
        }

        $cheapest = $this->units()
            ->where('status', ProductUnit::STATUS_AVAILABLE)
            ->min('price');

        return $cheapest === null ? null : (int) $cheapest;
    }

    public function isLowStock(): bool
    {
        $available = $this->availableCount();

        return $available > 0 && $available <= $this->low_stock_threshold;
    }

    /* --------------------------------------------------------------- ledger */

    /**
     * THE ONLY SUPPORTED WAY TO CHANGE `stock`.
     *
     * Writes the movement row and the new total inside one transaction, with the
     * product row locked, so two concurrent restocks cannot both read stock=3 and
     * both write stock=4.
     *
     * Callers pass EITHER a signed `delta` (a delivery arrived, something broke)
     * OR an absolute `stock` (a physical count), never both — a stock-take is
     * recorded as the delta it implies, so the ledger stays continuous.
     *
     * @param  array{delta?: int, stock?: int, reason: string, note?: ?string, order_id?: ?int, order_reference?: ?string, user_id?: ?int}  $attributes
     */
    public function recordStockMovement(array $attributes): StockMovement
    {
        if ($this->isUnitKind()) {
            // Serialized stock moves by changing a unit's status and writing a
            // unit_event. Quantity arithmetic here would be meaningless.
            throw new RuntimeException(
                "Product [{$this->slug}] is unit-tracked; move its units, not a quantity."
            );
        }

        $hasDelta = array_key_exists('delta', $attributes);
        $hasAbsolute = array_key_exists('stock', $attributes);

        if ($hasDelta === $hasAbsolute) {
            throw new RuntimeException('Pass exactly one of [delta] or [stock].');
        }

        return DB::transaction(function () use ($attributes, $hasDelta) {
            /** @var self $locked */
            $locked = self::query()->lockForUpdate()->findOrFail($this->id);

            $before = (int) $locked->stock;

            $delta = $hasDelta
                ? (int) $attributes['delta']
                : (int) $attributes['stock'] - $before;

            if ($delta === 0) {
                // A zero-delta row would claim a change that did not happen, and
                // the CHECK constraint refuses it anyway — fail with a sentence
                // rather than a constraint violation.
                throw new RuntimeException('A stock movement must change the stock level.');
            }

            $after = $before + $delta;

            if ($after < 0) {
                throw new RuntimeException(
                    "Stock cannot go negative: {$before} on hand, {$delta} requested."
                );
            }

            $movement = $locked->stockMovements()->create([
                'delta' => $delta,
                'stock_before' => $before,
                'stock_after' => $after,
                'reason' => $attributes['reason'],
                'note' => $attributes['note'] ?? null,
                'order_id' => $attributes['order_id'] ?? null,
                'order_reference' => $attributes['order_reference'] ?? null,
                'user_id' => $attributes['user_id'] ?? null,
            ]);

            // Not `update()` — `stock` is intentionally not fillable.
            $locked->forceFill(['stock' => $after])->save();

            $this->setAttribute('stock', $after);

            return $movement;
        });
    }

    /* --------------------------------------------------------------- scopes */

    /** @param  Builder<Product>  $query */
    public function scopeActive(Builder $query): void
    {
        $query->where('is_active', true);
    }

    /**
     * Products a customer could actually buy — anything with nothing available
     * is excluded from the storefront listing entirely.
     *
     * Written as correlated subqueries rather than eager-loaded relations so the
     * catalogue stays a constant number of queries regardless of page size.
     *
     * @param  Builder<Product>  $query
     */
    public function scopeInStock(Builder $query): void
    {
        $query->where(function (Builder $q) {
            $q->where(function (Builder $stocked) {
                $stocked->where('kind', self::KIND_STOCKED)->where('stock', '>', 0);
            })->orWhere(function (Builder $unit) {
                $unit->where('kind', self::KIND_UNIT)
                    ->whereHas('units', fn (Builder $u) => $u->where('status', ProductUnit::STATUS_AVAILABLE));
            });
        });
    }

    /**
     * Attaches everything the catalogue card needs, as correlated subqueries, so
     * a page of 24 products stays a CONSTANT number of queries.
     *
     * `from_price` is COALESCE'd: for a stocked product it is the product's own
     * price, for a unit listing it is the cheapest available machine. One column
     * either way, so sorting by price works across both kinds in one ORDER BY.
     *
     * `unit_conditions` is a comma-joined set of the DISTINCT conditions among
     * available machines — enough for the card to decide whether one badge is
     * honest, without loading a single unit row. Deriving that from the relation
     * instead is a query per product, which is exactly the N+1 this scope
     * exists to prevent (and which a test asserts against).
     *
     * @param  Builder<Product>  $query
     */
    public function scopeWithAvailability(Builder $query): void
    {
        $forThisProduct = fn (Builder $q) => $q
            ->whereColumn('product_units.product_id', 'products.id')
            ->where('status', ProductUnit::STATUS_AVAILABLE);

        $available = $forThisProduct(ProductUnit::query())->selectRaw('count(*)');
        $cheapest = $forThisProduct(ProductUnit::query())->selectRaw('min(price)');
        $conditions = $forThisProduct(ProductUnit::query())
            ->selectRaw("string_agg(distinct condition, ',')");

        /*
         | The specs of the machine whose price the card is showing — i.e. the
         | cheapest available one. Without this a card reads "ThinkPad X1 Carbon,
         | ₦785,000" and nothing else, and two units of the same model at
         | different prices are indistinguishable until you click. `ORDER BY
         | price, id` so the tie-break is stable and the specs always belong to
         | the same unit the price came from.
         */
        $specs = $forThisProduct(ProductUnit::query())
            ->select('specs')
            ->orderBy('price')
            ->orderBy('id')
            ->limit(1);

        $query
            ->addSelect(['unit_available_count' => $available])
            ->addSelect(['unit_from_price' => $cheapest])
            ->addSelect(['unit_conditions' => $conditions])
            ->addSelect(['unit_specs' => $specs])
            ->selectRaw('products.*')
            ->selectRaw(
                'coalesce(products.price, ('.$cheapest->toSql().')) as from_price',
                $cheapest->getBindings(),
            );
    }
}
