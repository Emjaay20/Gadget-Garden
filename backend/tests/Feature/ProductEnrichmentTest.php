<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use App\Support\Permissions;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductEnrichmentTest extends TestCase
{
    use RefreshDatabase;

    private function createLaptop(string $name = 'HP EliteBook 840 G8', string $brand = 'HP'): Product
    {
        $category = Category::factory()->create();

        return Product::factory()->create([
            'category_id' => $category->id,
            'name' => $name,
            'brand' => $brand,
            'kind' => Product::KIND_UNIT,
            'description' => null,
            'short_description' => null,
            'highlights' => null,
            'price' => null,
            'stock' => null,
        ]);
    }

    public function test_manager_can_preview_enrichment_candidates(): void
    {
        $manager = $this->manager();
        $product = $this->createLaptop();

        $response = $this->actingAs($manager)
            ->postJson("/api/inventory/{$product->slug}/enrich")
            ->assertOk();

        $response->assertJsonStructure([
            'data' => [
                'model',
                'brand',
                'image_candidates' => [
                    '*' => ['url', 'alt', 'label'],
                ],
                'generated' => [
                    'short_description',
                    'description',
                    'highlights',
                    'meta_title',
                    'meta_description',
                    'seo_keywords',
                ],
            ],
        ]);

        $this->assertNotEmpty($response->json('data.image_candidates'));
        $this->assertStringContainsString('EliteBook', $response->json('data.generated.description'));
    }

    public function test_manager_can_apply_enrichment_and_attach_images(): void
    {
        $manager = $this->manager();
        $product = $this->createLaptop('Dell Latitude 7420', 'Dell');

        $imageUrl1 = 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45';
        $imageUrl2 = 'https://images.unsplash.com/photo-1593642702821-c8da6771f0c6';

        $response = $this->actingAs($manager)
            ->postJson("/api/inventory/{$product->slug}/enrich", [
                'apply' => true,
                'selected_images' => [
                    ['url' => $imageUrl1, 'alt' => 'Dell Front Angle'],
                    ['url' => $imageUrl2, 'alt' => 'Dell Open Keyboard'],
                ],
            ])
            ->assertOk();

        $product->refresh();

        $this->assertNotNull($product->description);
        $this->assertStringContainsString('Dell Latitude 7420', $product->description);
        $this->assertNotEmpty($product->highlights);
        $this->assertCount(2, $product->images);

        $this->assertDatabaseHas('product_images', [
            'imageable_id' => $product->id,
            'path' => $imageUrl1,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'product_ai_enriched',
            'user_id' => $manager->id,
        ]);
    }

    public function test_unauthorized_user_cannot_enrich_product(): void
    {
        $product = $this->createLaptop();

        $this->postJson("/api/inventory/{$product->slug}/enrich")
            ->assertUnauthorized();

        $salesUser = User::factory()->create(['is_active' => true]);
        $salesUser->givePermissionTo(Permissions::ORDERS_VIEW);

        $this->actingAs($salesUser)
            ->postJson("/api/inventory/{$product->slug}/enrich")
            ->assertForbidden();
    }
}
