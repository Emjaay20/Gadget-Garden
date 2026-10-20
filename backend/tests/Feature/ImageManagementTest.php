<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductUnit;
use App\Models\User;
use App\Support\Permissions;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ImageManagementTest extends TestCase
{
    use RefreshDatabase;

    private function productWithUnit(): array
    {
        $category = Category::factory()->create();
        $product = Product::factory()->create([
            'category_id' => $category->id,
            'kind' => Product::KIND_UNIT,
            'price' => null,
            'stock' => null,
        ]);

        $unit = ProductUnit::factory()->create([
            'product_id' => $product->id,
            'price' => 600_000,
            'status' => ProductUnit::STATUS_AVAILABLE,
        ]);

        return [$product, $unit];
    }

    public function test_manager_can_upload_product_image_file(): void
    {
        Storage::fake('public');
        $manager = $this->manager();
        [$product] = $this->productWithUnit();

        $file = UploadedFile::fake()->image('macbook.jpg', 800, 600);

        $response = $this->actingAs($manager)
            ->postJson("/api/inventory/{$product->slug}/images", [
                'image' => $file,
                'alt' => 'MacBook Pro Front View',
            ])
            ->assertStatus(201);

        $imageId = $response->json('data.id');
        $this->assertDatabaseHas('product_images', [
            'id' => $imageId,
            'imageable_type' => Product::class,
            'imageable_id' => $product->id,
            'alt' => 'MacBook Pro Front View',
        ]);

        $image = ProductImage::find($imageId);
        Storage::disk('public')->assertExists($image->path);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'product_image_uploaded',
            'user_id' => $manager->id,
        ]);
    }

    public function test_manager_can_link_product_image_url(): void
    {
        $manager = $this->manager();
        [$product] = $this->productWithUnit();

        $imageUrl = 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8';

        $response = $this->actingAs($manager)
            ->postJson("/api/inventory/{$product->slug}/images", [
                'url' => $imageUrl,
                'alt' => 'External Unsplash Laptop Photo',
            ])
            ->assertStatus(201);

        $response->assertJsonPath('data.url', $imageUrl);
        $this->assertDatabaseHas('product_images', [
            'imageable_type' => Product::class,
            'imageable_id' => $product->id,
            'path' => $imageUrl,
        ]);
    }

    public function test_manager_can_upload_unit_image(): void
    {
        Storage::fake('public');
        $manager = $this->manager();
        [, $unit] = $this->productWithUnit();

        $file = UploadedFile::fake()->image('scuff-detail.jpg', 600, 600);

        $response = $this->actingAs($manager)
            ->postJson("/api/inventory/units/{$unit->sku}/images", [
                'image' => $file,
                'alt' => 'Chassis bottom view',
            ])
            ->assertStatus(201);

        $imageId = $response->json('data.id');
        $this->assertDatabaseHas('product_images', [
            'id' => $imageId,
            'imageable_type' => ProductUnit::class,
            'imageable_id' => $unit->id,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'unit_image_uploaded',
            'user_id' => $manager->id,
        ]);
    }

    public function test_manager_can_delete_image(): void
    {
        Storage::fake('public');
        $manager = $this->manager();
        [$product] = $this->productWithUnit();

        $file = UploadedFile::fake()->image('temporary.jpg');
        $path = $file->store('products', 'public');

        $image = $product->images()->create([
            'path' => $path,
            'alt' => 'Temporary Image',
            'position' => 1,
        ]);

        Storage::disk('public')->assertExists($path);

        $this->actingAs($manager)
            ->deleteJson("/api/inventory/images/{$image->id}")
            ->assertOk();

        $this->assertDatabaseMissing('product_images', ['id' => $image->id]);
        Storage::disk('public')->assertMissing($path);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'image_deleted',
            'user_id' => $manager->id,
        ]);
    }

    public function test_unauthorized_user_cannot_upload_images(): void
    {
        [$product] = $this->productWithUnit();

        // Guest
        $this->postJson("/api/inventory/{$product->slug}/images", [
            'url' => 'https://example.com/laptop.jpg',
        ])->assertUnauthorized();

        // User without inventory.manage
        $salesUser = User::factory()->create(['is_active' => true]);
        $salesUser->givePermissionTo(Permissions::ORDERS_VIEW);

        $this->actingAs($salesUser)
            ->postJson("/api/inventory/{$product->slug}/images", [
                'url' => 'https://example.com/laptop.jpg',
            ])
            ->assertForbidden();
    }
}
