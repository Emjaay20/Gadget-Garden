<?php

namespace App\Http\Controllers\Shop;

use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\DeliveryZoneResource;
use App\Models\Category;
use App\Models\DeliveryZone;
use Illuminate\Http\JsonResponse;

/**
 * The small public reads the storefront needs to render its chrome: the nav's
 * category row, and the delivery options shown at checkout.
 */
class CatalogueController extends Controller
{
    /** GET /api/shop/categories */
    public function categories(): JsonResponse
    {
        $buyable = fn ($q) => $q->active()->inStock();

        $categories = Category::query()
            ->active()
            ->ordered()
            ->withCount(['products' => $buyable])
            /*
             | Only categories with something buyable in them — a nav link to an
             | empty page is worse than no link.
             |
             | `whereHas`, NOT `having('products_count', …)`. `withCount` emits
             | the count as a SELECT subquery alias, and Postgres does not allow
             | a select alias in HAVING (MySQL does, which is how that pattern
             | spreads). This compiles to an EXISTS, which is also the cheaper
             | plan — it stops at the first matching row.
             */
            ->whereHas('products', $buyable)
            ->get();

        return response()->json([
            'data' => CategoryResource::collection($categories)->resolve(),
            'meta' => ['total' => $categories->count()],
        ]);
    }

    /** GET /api/shop/delivery-zones */
    public function deliveryZones(): JsonResponse
    {
        $zones = DeliveryZone::query()->active()->ordered()->get();

        return response()->json([
            'data' => DeliveryZoneResource::collection($zones)->resolve(),
            'meta' => ['total' => $zones->count()],
        ]);
    }
}
