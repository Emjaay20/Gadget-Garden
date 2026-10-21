<?php

namespace App\Http\Controllers\Shop;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Customer;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\Wishlist;
use App\Models\WishlistItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WishlistController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->payload($this->wishlist($request))]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:80'],
            'is_public' => ['sometimes', 'boolean'],
            'share_expires_at' => ['nullable', 'date', 'after:now'],
        ]);

        $wishlist = $this->wishlist($request);
        if (array_key_exists('share_expires_at', $data) && $data['share_expires_at'] === null) {
            $wishlist->share_expires_at = null;
            unset($data['share_expires_at']);
        }
        $wishlist->fill($data)->save();

        return response()->json(['data' => $this->payload($wishlist)]);
    }

    public function storeItem(Request $request): JsonResponse
    {
        $data = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'product_unit_id' => ['nullable', 'integer', 'exists:product_units,id'],
        ]);

        $product = Product::findOrFail($data['product_id']);
        if (isset($data['product_unit_id'])) {
            $unit = ProductUnit::findOrFail($data['product_unit_id']);
            abort_unless($unit->product_id === $product->id, 422, 'That machine does not belong to this listing.');
        }

        $wishlist = $this->wishlist($request);
        $item = $wishlist->items()->firstOrCreate([
            'product_id' => $product->id,
            'product_unit_id' => $data['product_unit_id'] ?? null,
        ]);

        return response()->json(['data' => $this->itemPayload($item->load(['product.category', 'product.images', 'product.availableUnits']))], 201);
    }

    public function destroyItem(Request $request, WishlistItem $item): JsonResponse
    {
        abort_unless($item->wishlist_id === $this->wishlist($request)->id, 404);
        $item->delete();

        return response()->json([], 204);
    }

    public function shared(string $slug): JsonResponse
    {
        $wishlist = Wishlist::where('share_slug', $slug)
            ->with(['customer:id,name', 'items.product.category', 'items.product.images', 'items.product.availableUnits', 'items.unit'])
            ->firstOrFail();

        abort_unless($wishlist->canBeViewedPublicly(), 404);

        return response()->json(['data' => $this->payload($wishlist, false)]);
    }

    private function wishlist(Request $request): Wishlist
    {
        /** @var Customer $customer */
        $customer = $request->user();
        abort_unless($customer instanceof Customer, 401);

        return Wishlist::firstOrCreate(
            ['customer_id' => $customer->id],
            ['share_slug' => Wishlist::newShareSlug()],
        )->load(['items.product.category', 'items.product.images', 'items.product.availableUnits', 'items.unit']);
    }

    private function payload(Wishlist $wishlist, bool $includeSettings = true): array
    {
        return array_filter([
            'title' => $wishlist->title,
            'share_slug' => $wishlist->share_slug,
            'is_public' => $includeSettings ? $wishlist->is_public : null,
            'share_expires_at' => $includeSettings ? $wishlist->share_expires_at?->toIso8601String() : null,
            'owner_name' => $includeSettings ? null : $wishlist->customer?->name,
            'items' => $wishlist->items->map(fn (WishlistItem $item) => $this->itemPayload($item))->values()->all(),
        ], fn ($value) => $value !== null);
    }

    private function itemPayload(WishlistItem $item): array
    {
        return [
            'id' => (string) $item->id,
            'product' => (new ProductResource($item->product))->resolve(),
            'unit_id' => $item->product_unit_id ? (string) $item->product_unit_id : null,
            'unit_sku' => $item->unit?->sku,
            'added_at' => $item->created_at?->toIso8601String(),
        ];
    }
}
