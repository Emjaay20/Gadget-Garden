<?php

namespace App\Http\Controllers\Backoffice;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Http\Resources\ProductUnitResource;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\StockMovement;
use App\Models\UnitEvent;
use App\Support\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;

/**
 * Stock, as the shop floor sees it.
 *
 * Behind `inventory.view` to read and `inventory.manage` to move. Pricing lives
 * on a different permission (`catalogue.manage`) and a different controller —
 * receiving a shipment and deciding what it sells for are two different kinds of
 * trust.
 */
class InventoryController extends Controller
{
    /**
     * GET /api/inventory  ?search=&low_stock=&kind=
     *
     * Unlike the storefront listing, this shows EVERYTHING — inactive listings
     * and sold-out ones included. Staff need to see the thing that has run out;
     * that is the whole point of the page.
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'kind' => ['nullable', 'in:unit,stocked'],
            'low_stock' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Product::query()
            ->withAvailability()
            ->with(['category', 'images'])
            ->orderBy('name');


        if ($search = $validated['search'] ?? null) {
            $term = '%'.str_replace('%', '\%', $search).'%';

            $query->where(fn ($q) => $q
                ->where('name', 'ilike', $term)
                ->orWhere('brand', 'ilike', $term)
                ->orWhere('slug', 'ilike', $term));
        }

        if ($kind = $validated['kind'] ?? null) {
            $query->where('kind', $kind);
        }

        $paginator = $query->paginate($validated['per_page'] ?? 50)->withQueryString();

        $products = collect($paginator->items());

        /*
         | Low stock is filtered AFTER pagination rather than in SQL.
         |
         | It compares a per-product threshold against an availability figure
         | that is itself a correlated subquery, and expressing that in the
         | WHERE clause would mean repeating the subquery. On a catalogue of a
         | few hundred products this is the cheaper trade; revisit it if the
         | catalogue reaches thousands.
         */
        if ($validated['low_stock'] ?? false) {
            $products = $products->filter(function (Product $product) {
                $available = $product->isUnitKind()
                    ? (int) ($product->unit_available_count ?? 0)
                    : (int) $product->stock;

                return $available <= (int) $product->low_stock_threshold;
            })->values();
        }

        return response()->json([
            'data' => ProductResource::collection($products)->resolve(),
            'meta' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    /**
     * GET /api/inventory/categories
     *
     * List all categories for backoffice product creation.
     */
    public function categories(): JsonResponse
    {
        $categories = Category::query()->ordered()->get(['id', 'slug', 'name', 'description']);

        return response()->json([
            'data' => $categories,
        ]);
    }

    /**
     * POST /api/inventory
     *
     * Create a new product catalogue definition.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'brand' => ['required', 'string', 'max:80'],
            'kind' => ['required', 'in:unit,stocked'],
            'category_id' => ['required', 'exists:categories,id'],
            'price' => ['nullable', 'required_if:kind,stocked', 'integer', 'min:1'],
            'compare_at_price' => ['nullable', 'integer'],
            'opening_stock' => ['nullable', 'integer', 'min:0'],
            'warranty_months' => ['nullable', 'integer', 'min:0', 'max:60'],
            'low_stock_threshold' => ['nullable', 'integer', 'min:0', 'max:1000'],
            'short_description' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'youtube_url' => ['nullable', 'string', 'max:255'],
            'properties' => ['nullable', 'array'],
            'properties.*' => ['string', 'max:50'],
            'highlights' => ['nullable', 'array'],
            'highlights.*' => ['string', 'max:255'],
            'images' => ['nullable', 'array'],
            'images.*' => ['string', 'max:2048'],
            'auto_enrich' => ['nullable', 'boolean'],
        ]);

        if (! empty($validated['compare_at_price']) && ! empty($validated['price']) && $validated['compare_at_price'] <= $validated['price']) {
            throw ValidationException::withMessages([
                'compare_at_price' => ['The compare at price must be greater than the selling price.'],
            ]);
        }

        // Generate clean unique slug
        $baseSlug = Str::slug($validated['name']);
        $slug = $baseSlug;
        $counter = 1;
        while (Product::where('slug', $slug)->exists()) {
            $slug = "{$baseSlug}-{$counter}";
            $counter++;
        }

        $isUnit = $validated['kind'] === Product::KIND_UNIT;

        $product = new Product([
            'slug' => $slug,
            'name' => $validated['name'],
            'brand' => $validated['brand'],
            'kind' => $validated['kind'],
            'category_id' => $validated['category_id'],
            'short_description' => $validated['short_description'] ?? null,
            'description' => $validated['description'] ?? null,
            'youtube_url' => $validated['youtube_url'] ?? null,
            'properties' => $validated['properties'] ?? null,
            'highlights' => $validated['highlights'] ?? null,
            'warranty_months' => $validated['warranty_months'] ?? ($isUnit ? 3 : 1),
            'low_stock_threshold' => $validated['low_stock_threshold'] ?? ($isUnit ? 2 : 5),
            'price' => $isUnit ? null : ($validated['price'] ?? null),
            'compare_at_price' => $isUnit ? null : ($validated['compare_at_price'] ?? null),
            'is_active' => true,
        ]);

        if (! $isUnit) {
            $product->forceFill(['stock' => 0]);
        }

        $product->save();

        // Attach direct images if provided
        if (! empty($validated['images'])) {
            foreach ($validated['images'] as $idx => $img) {
                if (! empty($img)) {
                    $product->images()->create([
                        'path' => $img,
                        'alt' => $product->name,
                        'position' => $idx + 1,
                    ]);
                }
            }
        }

        // If stocked product with opening stock requested, record double-entry restock movement
        if (! $isUnit && ! empty($validated['opening_stock']) && $validated['opening_stock'] > 0) {
            $product->recordStockMovement([
                'delta' => (int) $validated['opening_stock'],
                'reason' => StockMovement::RESTOCK,
                'note' => 'Initial stock intake on product creation.',
                'user_id' => $request->user()->id,
            ]);
        }

        AuditLogger::log(
            action: 'product_created',
            description: "Created new product listing {$product->name} ({$product->kind})",
            auditable: $product,
            newValues: [
                'name' => $product->name,
                'brand' => $product->brand,
                'kind' => $product->kind,
                'category_id' => $product->category_id,
            ]
        );

        // Auto-enrich with images and SEO if requested
        if (! empty($validated['auto_enrich'])) {
            app(ProductEnrichmentController::class)->applyAutoEnrichment($product);
        }

        return response()->json([
            'message' => 'Product created successfully.',
            'data' => (new ProductResource($product->fresh(['category', 'images'])))->resolve($request),
        ], 201);
    }

    /**
     * GET /api/inventory/{product:slug}
     *
     * Detail view of a single product with full images and category.
     */
    public function show(Request $request, Product $product): JsonResponse
    {
        $product->loadMissing(['category', 'images']);

        return response()->json([
            'data' => (new ProductResource($product))->resolve($request),
        ]);
    }

    /**
     * PATCH /api/inventory/{product:slug}
     *
     * Update product details, commercial copy, and highlights.
     */
    public function update(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'brand' => ['sometimes', 'string', 'max:80'],
            'category_id' => ['sometimes', 'exists:categories,id'],
            'price' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'compare_at_price' => ['sometimes', 'nullable', 'integer'],
            'warranty_months' => ['sometimes', 'integer', 'min:0', 'max:60'],
            'low_stock_threshold' => ['sometimes', 'integer', 'min:0', 'max:1000'],
            'short_description' => ['sometimes', 'nullable', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string'],
            'youtube_url' => ['sometimes', 'nullable', 'string', 'max:255'],
            'properties' => ['sometimes', 'nullable', 'array'],
            'properties.*' => ['string', 'max:50'],
            'highlights' => ['sometimes', 'nullable', 'array'],
            'highlights.*' => ['string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (! empty($validated['compare_at_price']) && ! empty($validated['price'] ?? $product->price) && $validated['compare_at_price'] <= ($validated['price'] ?? $product->price)) {
            throw ValidationException::withMessages([
                'compare_at_price' => ['The compare at price must be greater than the selling price.'],
            ]);
        }

        // For unit kind, price must stay null
        if ($product->isUnitKind()) {
            unset($validated['price'], $validated['compare_at_price']);
        }

        $oldValues = $product->only(array_keys($validated));
        $product->update($validated);

        AuditLogger::log(
            action: 'product_updated',
            description: "Updated product listing {$product->name}",
            auditable: $product,
            oldValues: $oldValues,
            newValues: $validated
        );

        return response()->json([
            'message' => 'Product updated successfully.',
            'data' => (new ProductResource($product->fresh(['category', 'images'])))->resolve($request),
        ]);
    }

    /**
     * DELETE /api/inventory/{product:slug}
     *
     * Soft delete a product catalogue listing and remove unsold inventory units.
     */
    public function destroy(Request $request, Product $product): JsonResponse
    {
        $hasReserved = $product->units()->where('status', ProductUnit::STATUS_RESERVED)->exists();
        if ($hasReserved) {
            throw ValidationException::withMessages([
                'product' => ['This product has units currently reserved in active orders and cannot be deleted.'],
            ]);
        }

        $productName = $product->name;
        $productSlug = $product->slug;

        DB::transaction(function () use ($product, $productName, $productSlug) {
            // Clean up available, faulty, or returned machines that haven't been sold
            $product->units()->whereIn('status', [
                ProductUnit::STATUS_AVAILABLE,
                ProductUnit::STATUS_FAULTY,
                ProductUnit::STATUS_RETURNED,
            ])->delete();

            // Soft delete product listing
            $product->delete();

            AuditLogger::log(
                action: 'product_deleted',
                description: "Deleted product listing {$productName} ({$productSlug})",
                auditable: $product,
                oldValues: [
                    'name' => $productName,
                    'slug' => $productSlug,
                    'brand' => $product->brand,
                    'kind' => $product->kind,
                ]
            );
        });

        return response()->json([
            'message' => "Product '{$productName}' deleted successfully.",
        ]);
    }



    /**
     * GET /api/inventory/{product:slug}/units
     *
     * Every machine under a listing, whatever its state — available, reserved,
     * sold, faulty. Staff answering "where did that ThinkPad go" need the sold
     * ones as much as the live ones.
     */
    public function units(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'in:available,reserved,sold,returned,faulty'],
        ]);

        $units = $product->units()
            ->when($validated['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->orderByRaw("array_position(array['available','reserved','faulty','returned','sold'], status)")
            ->orderBy('price')
            ->get();

        return response()->json([
            'data' => $units
                ->map(fn (ProductUnit $unit) => (new ProductUnitResource($unit))->forStaff()->resolve($request))
                ->all(),
            'meta' => [
                'total' => $units->count(),
                'available' => $units->where('status', ProductUnit::STATUS_AVAILABLE)->count(),
            ],
        ]);
    }

    /**
     * POST /api/inventory/{product:slug}/units    — BULK INTAKE
     *
     * A shipment arrives as a box of machines, not one at a time. This takes the
     * whole batch in a single transaction: either the intake is recorded or none
     * of it is, so a half-entered shipment cannot leave the shelf disagreeing
     * with the database.
     */
    public function storeUnits(Request $request, Product $product): JsonResponse
    {
        if (! $product->isUnitKind()) {
            throw ValidationException::withMessages([
                'product' => ['This listing tracks quantity, not individual machines.'],
            ]);
        }

        $validated = $request->validate([
            'units' => ['required', 'array', 'min:1', 'max:50'],
            'units.*.sku' => ['required', 'string', 'max:64', 'distinct', 'unique:product_units,sku'],
            'units.*.serial' => ['nullable', 'string', 'max:120'],
            'units.*.imei' => ['nullable', 'string', 'max:32'],
            'units.*.condition' => ['required', 'in:new,foreign_used,refurbished'],
            'units.*.grade' => ['nullable', 'in:A,B,C'],
            'units.*.price' => ['required', 'integer', 'min:1'],
            'units.*.cost' => ['nullable', 'integer', 'min:0'],
            'units.*.note' => ['nullable', 'string', 'max:500'],
            'units.*.specs' => ['nullable', 'array'],
            'units.*.specs.cpu' => ['nullable', 'string', 'max:120'],
            'units.*.specs.ram_gb' => ['nullable', 'integer', 'min:1', 'max:512'],
            'units.*.specs.storage_gb' => ['nullable', 'integer', 'min:1', 'max:16384'],
            'units.*.specs.storage_type' => ['nullable', 'string', 'max:20'],
            'units.*.specs.screen' => ['nullable', 'string', 'max:60'],
            'units.*.specs.gpu' => ['nullable', 'string', 'max:120'],
            'units.*.specs.battery_health' => ['nullable', 'integer', 'min:0', 'max:100'],
        ]);

        $created = DB::transaction(function () use ($product, $validated, $request) {
            return collect($validated['units'])->map(function (array $row) use ($product, $request) {
                $unit = $product->units()->create($row);

                // The ledger is complete from the machine's first moment.
                $unit->recordEvent(
                    UnitEvent::ACQUIRED,
                    null,
                    ProductUnit::STATUS_AVAILABLE,
                    ['user_id' => $request->user()->id, 'note' => $row['note'] ?? null],
                );

                return $unit;
            });
        });

        return response()->json([
            'data' => $created
                ->map(fn (ProductUnit $unit) => (new ProductUnitResource($unit))->forStaff()->resolve($request))
                ->all(),
            'meta' => ['created' => $created->count()],
        ], 201);
    }

    /**
     * PATCH /api/inventory/units/{unit:sku}
     *
     * Correcting what a machine IS — its specs, grade, price, note. Its STATUS
     * is not editable here: available/reserved/sold are consequences of orders
     * and of `markSold`/`releaseReservation`, and letting a form set them
     * directly is how a sold laptop ends up back on the shelf.
     */
    public function updateUnit(Request $request, ProductUnit $unit): JsonResponse
    {
        $validated = $request->validate([
            'price' => ['sometimes', 'integer', 'min:1'],
            'cost' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'grade' => ['sometimes', 'nullable', 'in:A,B,C'],
            'condition' => ['sometimes', 'in:new,foreign_used,refurbished'],
            'serial' => ['sometimes', 'nullable', 'string', 'max:120'],
            'imei' => ['sometimes', 'nullable', 'string', 'max:32'],
            'note' => ['sometimes', 'nullable', 'string', 'max:500'],
            'specs' => ['sometimes', 'array'],
        ]);

        if ($unit->status === ProductUnit::STATUS_SOLD) {
            // A sold machine's record is evidence of what was sold. Editing it
            // would rewrite what a customer bought.
            throw ValidationException::withMessages([
                'unit' => ['This machine has been sold and can no longer be edited.'],
            ]);
        }

        $unit->update($validated);

        $unit->recordEvent(
            UnitEvent::CORRECTED,
            $unit->status,
            $unit->status,
            [
                'user_id' => $request->user()->id,
                'note' => 'Edited: '.implode(', ', array_keys($validated)),
            ],
        );

        return response()->json([
            'data' => (new ProductUnitResource($unit->fresh()))->forStaff()->resolve($request),
        ]);
    }

    /**
     * DELETE /api/inventory/units/{unit:sku}
     *
     * Delete an individual machine unit (if not already sold or reserved).
     */
    public function destroyUnit(Request $request, ProductUnit $unit): JsonResponse
    {
        if ($unit->status === ProductUnit::STATUS_SOLD) {
            throw ValidationException::withMessages([
                'unit' => ['This machine has already been sold and cannot be deleted.'],
            ]);
        }

        if ($unit->status === ProductUnit::STATUS_RESERVED) {
            throw ValidationException::withMessages([
                'unit' => ['This machine is currently reserved in an active order and cannot be deleted.'],
            ]);
        }

        $sku = $unit->sku;
        $product = $unit->product;

        DB::transaction(function () use ($unit, $sku, $product) {
            AuditLogger::log(
                action: 'unit_deleted',
                description: "Deleted machine unit {$sku} from product {$product?->name}",
                auditable: $unit,
                oldValues: [
                    'sku' => $sku,
                    'serial' => $unit->serial,
                    'status' => $unit->status,
                    'price' => $unit->price,
                ]
            );

            $unit->delete();
        });

        return response()->json([
            'message' => "Machine unit '{$sku}' deleted successfully.",
        ]);
    }

    /**
     * POST /api/inventory/{product:slug}/stock-movements
     *
     * The ONLY way quantity stock changes. Accepts either a signed `delta` (a
     * delivery, a breakage) or an absolute `stock` (a physical count), never
     * both — a stock-take is recorded as the delta it implies, so the ledger
     * stays continuous.
     */
    public function storeMovement(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate([
            'delta' => ['nullable', 'integer'],
            'stock' => ['nullable', 'integer', 'min:0'],
            'reason' => ['required', 'in:restock,sale,return,damage,correction'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $hasDelta = array_key_exists('delta', $validated) && $validated['delta'] !== null;
        $hasAbsolute = array_key_exists('stock', $validated) && $validated['stock'] !== null;

        if ($hasDelta === $hasAbsolute) {
            throw ValidationException::withMessages([
                'delta' => ['Give either a change (+/-) or a counted total, not both.'],
            ]);
        }

        /*
         | Reasons are DIRECTIONAL and the sign is checked against them here, at
         | the boundary: `restock`/`return` add, `sale`/`damage` remove,
         | `correction` may go either way. A "restock: -4" is a typo, not a
         | restock, and catching it here keeps the ledger readable as a story.
         */
        if ($hasDelta && ! StockMovement::signMatchesReason($validated['delta'], $validated['reason'])) {
            throw ValidationException::withMessages([
                'reason' => ["A {$validated['reason']} cannot change stock in that direction."],
            ]);
        }

        try {
            $movement = $product->recordStockMovement([
                ...($hasDelta ? ['delta' => $validated['delta']] : ['stock' => $validated['stock']]),
                'reason' => $validated['reason'],
                'note' => $validated['note'] ?? null,
                'user_id' => $request->user()->id,
            ]);
        } catch (RuntimeException $e) {
            throw ValidationException::withMessages(['delta' => [$e->getMessage()]]);
        }

        return response()->json([
            'data' => [
                'id' => (string) $movement->id,
                'delta' => (int) $movement->delta,
                'stock_before' => (int) $movement->stock_before,
                'stock_after' => (int) $movement->stock_after,
                'reason' => $movement->reason,
                'note' => $movement->note,
                'created_at' => $movement->created_at?->toIso8601String(),
            ],
        ], 201);
    }

    /**
     * GET /api/inventory/movements  ?product=
     *
     * The ledger. Append-only, newest first — "who took twelve chargers off the
     * shelf, and why".
     */
    public function movements(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product' => ['nullable', 'string', 'exists:products,slug'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        /*
         | Ordered by id as the tiebreak, not by timestamp alone.
         |
         | Two movements recorded in the same second — a stock-take entered
         | quickly, or a paid order moving several lines — otherwise come back in
         | arbitrary order, and a ledger that lists its own entries out of
         | sequence is worse than useless. The table is append-only, so a
         | descending id IS newest-first and is total.
         */
        $query = StockMovement::query()
            ->with(['product:id,slug,name', 'user:id,name'])
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if ($slug = $validated['product'] ?? null) {
            $query->whereHas('product', fn ($q) => $q->where('slug', $slug));
        }

        $paginator = $query->paginate($validated['per_page'] ?? 50)->withQueryString();

        return response()->json([
            'data' => collect($paginator->items())->map(fn (StockMovement $movement) => [
                'id' => (string) $movement->id,
                'product' => $movement->product?->name,
                'product_slug' => $movement->product?->slug,
                'delta' => (int) $movement->delta,
                'stock_before' => (int) $movement->stock_before,
                'stock_after' => (int) $movement->stock_after,
                'reason' => $movement->reason,
                'note' => $movement->note,
                'order_reference' => $movement->order_reference,
                // Null means the shop did it — a paid order moving its own stock.
                'user' => $movement->user?->name,
                'created_at' => $movement->created_at?->toIso8601String(),
            ])->all(),
            'meta' => [
                'total' => $paginator->total(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }
}
