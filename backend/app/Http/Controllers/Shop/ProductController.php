<?php

namespace App\Http\Controllers\Shop;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Models\ProductUnit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The public catalogue. Unauthenticated, throttled, CORS-limited to the
 * storefront origin.
 *
 * Everything here is read-only and shows only what a customer may see: active
 * products with something actually available. `cost`, `serial` and `imei` never
 * reach this surface — see ProductUnitResource.
 */
class ProductController extends Controller
{
    /**
     * GET /api/shop/products
     *
     * ?search= &category= &brand[]= &condition[]= &min_ram= &min_storage=
     * &min_price= &max_price= &sort= &page=
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'category' => ['nullable', 'string', 'max:120'],
            'brand' => ['nullable', 'array'],
            'brand.*' => ['string', 'max:60'],
            'condition' => ['nullable', 'array'],
            'condition.*' => ['string', 'in:new,foreign_used,refurbished'],
            'min_ram' => ['nullable', 'integer', 'min:0', 'max:512'],
            'min_storage' => ['nullable', 'integer', 'min:0', 'max:16384'],
            'min_price' => ['nullable', 'integer', 'min:0'],
            'max_price' => ['nullable', 'integer', 'min:0'],
            'sort' => ['nullable', 'string', 'in:featured,price_asc,price_desc,newest'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:48'],
        ]);

        $query = Product::query()
            ->active()
            ->inStock()
            ->withAvailability()
            ->with(['category', 'images']);

        $this->applyFilters($query, $validated);
        $this->applySort($query, $validated['sort'] ?? 'featured');

        $paginator = $query->paginate($validated['per_page'] ?? 24)->withQueryString();

        /*
         | `->items()`, never the paginator itself.
         |
         | Handing a paginator to a resource collection that also sets
         | `additional(['meta' => …])` makes Laravel emit its own pagination meta
         | and merge the two — every shared key becomes a two-element array
         | (`"total": [9, 9]`). Building the meta explicitly avoids that entirely.
         */
        return response()->json([
            'data' => ProductResource::collection($paginator->items())->resolve(),
            'meta' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    /**
     * GET /api/shop/products/{slug}
     *
     * Eager-loads the available units so the storefront can render the unit
     * picker — the list of actual machines under this model line, each with its
     * own specs and price. That picker IS the product page for serialized stock.
     */
    public function show(string $slug): JsonResponse
    {
        $product = Product::query()
            ->active()
            ->where('slug', $slug)
            ->with([
                'category',
                'images',
                'availableUnits' => fn ($q) => $q->with('images')->orderBy('price'),
            ])
            ->firstOrFail();

        return response()->json(['data' => new ProductResource($product)]);
    }

    /**
     * GET /api/shop/products/filters
     *
     * The facets available across the live catalogue, so the storefront renders
     * only filters that would actually return something. Offering "ASUS" when no
     * ASUS machine is in stock produces an empty page and a confused buyer.
     */
    public function filters(): JsonResponse
    {
        $inStock = Product::query()->active()->inStock();

        $brands = (clone $inStock)
            ->whereNotNull('brand')
            ->distinct()
            ->orderBy('brand')
            ->pluck('brand');

        // Conditions come from the units themselves, restricted to available
        // ones — a condition only its sold machines had is not a real facet.
        $conditions = ProductUnit::query()
            ->available()
            ->whereHas('product', fn (Builder $q) => $q->active())
            ->distinct()
            ->pluck('condition');

        $prices = ProductUnit::query()
            ->available()
            ->whereHas('product', fn (Builder $q) => $q->active())
            ->selectRaw('min(price) as min_price, max(price) as max_price')
            ->first();

        return response()->json([
            'data' => [
                'brands' => $brands->values(),
                'conditions' => $conditions->values(),
                'ram_options' => [8, 16, 32],
                'storage_options' => [256, 512, 1024],
                'price_range' => [
                    'min' => (int) ($prices->min_price ?? 0),
                    'max' => (int) ($prices->max_price ?? 0),
                ],
            ],
        ]);
    }

    /**
     * @param  Builder<Product>  $query
     * @param  array<string, mixed>  $filters
     */
    private function applyFilters(Builder $query, array $filters): void
    {
        if ($search = $filters['search'] ?? null) {
            $term = '%'.str_replace('%', '\%', $search).'%';

            $query->where(function (Builder $q) use ($term) {
                $q->where('name', 'ilike', $term)
                    ->orWhere('brand', 'ilike', $term)
                    ->orWhere('short_description', 'ilike', $term)
                    ->orWhere('description', 'ilike', $term)
                    ->orWhereHas('category', fn ($cq) => $cq->where('name', 'ilike', $term))
                    ->orWhereHas('units', fn ($uq) => $uq->whereRaw('cast(specs as text) ilike ?', [$term]))
                    ->orWhereRaw('cast(properties as text) ilike ?', [$term]);
            });
        }

        if ($category = $filters['category'] ?? null) {
            $query->whereHas('category', fn (Builder $q) => $q->where('slug', $category));
        }

        if ($brands = $filters['brand'] ?? null) {
            $query->whereIn('brand', $brands);
        }

        if ($conditions = $filters['condition'] ?? null) {
            $query->whereHas(
                'units',
                fn (Builder $q) => $q->available()->whereIn('condition', $conditions),
            );
        }

        /*
         | Spec filters read the unit's `specs` json. `->>` extracts as text, so
         | it is cast before comparing — without the cast Postgres compares
         | '8' > '16' as strings and answers true.
         |
         | Only unit products can match: a charger has no RAM, and silently
         | including it in a "16GB+" result would be wrong.
         */
        if ($minRam = $filters['min_ram'] ?? null) {
            $query->whereHas('units', fn (Builder $q) => $q->available()
                ->whereRaw("(specs->>'ram_gb')::int >= ?", [$minRam]));
        }

        if ($minStorage = $filters['min_storage'] ?? null) {
            $query->whereHas('units', fn (Builder $q) => $q->available()
                ->whereRaw("(specs->>'storage_gb')::int >= ?", [$minStorage]));
        }

        // Price bounds straddle both kinds: a stocked product's own price, or
        // any available unit's price.
        if ($min = $filters['min_price'] ?? null) {
            $query->where(fn (Builder $q) => $q
                ->where('price', '>=', $min)
                ->orWhereHas('units', fn (Builder $u) => $u->available()->where('price', '>=', $min)));
        }

        if ($max = $filters['max_price'] ?? null) {
            $query->where(fn (Builder $q) => $q
                ->where('price', '<=', $max)
                ->orWhereHas('units', fn (Builder $u) => $u->available()->where('price', '<=', $max)));
        }
    }

    /** @param  Builder<Product>  $query */
    private function applySort(Builder $query, string $sort): void
    {
        match ($sort) {
            // `from_price` is the COALESCE column from scopeWithAvailability(),
            // so one ORDER BY sorts across both kinds. NULLS LAST keeps anything
            // unpriced out of the top of an ascending list.
            'price_asc' => $query->orderByRaw('from_price asc nulls last'),
            'price_desc' => $query->orderByRaw('from_price desc nulls last'),
            'newest' => $query->orderByDesc('products.created_at'),
            default => $query
                ->orderByDesc('products.is_featured')
                ->orderByDesc('products.created_at'),
        };
    }
}
