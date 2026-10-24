<?php

namespace App\Http\Controllers\Backoffice;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductImageResource;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductUnit;
use App\Support\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class ImageController extends Controller
{
    /**
     * POST /api/inventory/{product:slug}/images
     *
     * Uploads or links an image for a product catalog listing.
     */
    public function uploadProductImage(Request $request, Product $product): JsonResponse
    {
        $validated = $this->validateImageRequest($request);

        $path = $this->resolvePath($request, $validated);
        $position = $validated['position'] ?? ($product->images()->max('position') + 1);
        $type = $validated['type'] ?? ($request->hasFile('image') ? 'real_device' : 'official_stock');
        $isPrimary = (bool) ($validated['is_primary'] ?? false);

        if ($isPrimary) {
            $product->images()->update(['is_primary' => false]);
        }

        $image = $product->images()->create([
            'path' => $path,
            'alt' => $validated['alt'] ?? $product->name,
            'type' => $type,
            'is_primary' => $isPrimary,
            'position' => $position,
        ]);

        AuditLogger::log(
            action: 'product_image_uploaded',
            description: "Attached photo to product {$product->name}",
            auditable: $product,
            newValues: [
                'image_id' => $image->id,
                'path' => $path,
                'product_slug' => $product->slug,
            ]
        );

        return response()->json([
            'data' => (new ProductImageResource($image))->resolve($request),
            'message' => 'Image attached to product successfully.',
        ], 201);
    }

    /**
     * POST /api/inventory/units/{unit:sku}/images
     *
     * Uploads an image specific to this physical machine (showing scuffs, ports, battery, etc.).
     */
    public function uploadUnitImage(Request $request, ProductUnit $unit): JsonResponse
    {
        $validated = $this->validateImageRequest($request);

        $path = $this->resolvePath($request, $validated);
        $position = $validated['position'] ?? ($unit->images()->max('position') + 1);

        $image = $unit->images()->create([
            'path' => $path,
            'alt' => $validated['alt'] ?? "Unit {$unit->sku} photo",
            'position' => $position,
        ]);

        AuditLogger::log(
            action: 'unit_image_uploaded',
            description: "Attached photo to unit SKU {$unit->sku}",
            auditable: $unit,
            newValues: [
                'image_id' => $image->id,
                'path' => $path,
                'sku' => $unit->sku,
            ]
        );

        return response()->json([
            'data' => (new ProductImageResource($image))->resolve($request),
            'message' => 'Image attached to unit successfully.',
        ], 201);
    }

    /**
     * DELETE /api/inventory/images/{image}
     *
     * Deletes an image record and removes its physical file from storage if stored locally.
     */
    public function destroy(Request $request, ProductImage $image): JsonResponse
    {
        $path = $image->path;
        $imageable = $image->imageable;

        // If stored on the public disk (not an external URL), delete the physical file
        if (! (str_starts_with($path, 'http://') || str_starts_with($path, 'https://'))) {
            Storage::disk('public')->delete($path);
        }

        $image->delete();

        if ($imageable) {
            AuditLogger::log(
                action: 'image_deleted',
                description: 'Deleted image from product or unit',
                auditable: $imageable,
                oldValues: ['deleted_path' => $path]
            );
        }

        return response()->json([
            'message' => 'Image deleted successfully.',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validateImageRequest(Request $request): array
    {
        $validated = $request->validate([
            'image' => ['nullable', 'file', 'image', 'mimes:jpeg,png,jpg,webp,avif', 'max:10240'],
            'url' => ['nullable', 'url', 'max:2048'],
            'alt' => ['nullable', 'string', 'max:255'],
            'type' => ['nullable', 'string', 'in:real_device,official_stock'],
            'is_primary' => ['nullable', 'boolean'],
            'position' => ['nullable', 'integer', 'min:0'],
        ]);

        if (! $request->hasFile('image') && empty($validated['url'])) {
            throw ValidationException::withMessages([
                'image' => ['Please upload an image file or provide an image URL.'],
            ]);
        }

        return $validated;
    }

    /**
     * Stores file to disk or returns external URL.
     *
     * @param array<string, mixed> $validated
     */
    private function resolvePath(Request $request, array $validated): string
    {
        if ($request->hasFile('image')) {
            return $request->file('image')->store('products', 'public');
        }

        return $validated['url'];
    }
}
