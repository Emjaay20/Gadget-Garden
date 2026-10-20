<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\StockMovement;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductCreationTest extends TestCase
{
    use RefreshDatabase;

    public function test_manager_can_fetch_categories(): void
    {
        $manager = $this->manager();
        Category::factory()->count(3)->create();

        $response = $this->actingAs($manager)
            ->getJson('/api/inventory/categories')
            ->assertOk();

        $response->assertJsonStructure([
            'data' => [
                '*' => ['id', 'slug', 'name'],
            ],
        ]);

        $this->assertCount(3, $response->json('data'));
    }

    public function test_manager_can_create_unit_laptop_product(): void
    {
        $manager = $this->manager();
        $category = Category::factory()->create();

        $payload = [
            'name' => 'Lenovo Legion 5 Pro 16ACH6H',
            'brand' => 'Lenovo',
            'kind' => Product::KIND_UNIT,
            'category_id' => $category->id,
            'warranty_months' => 6,
            'low_stock_threshold' => 2,
            'short_description' => 'Flagship AMD Ryzen 7 gaming powerhouse with RTX graphics.',
        ];

        $response = $this->actingAs($manager)
            ->postJson('/api/inventory', $payload)
            ->assertStatus(201);

        $response->assertJsonPath('data.name', 'Lenovo Legion 5 Pro 16ACH6H');
        $response->assertJsonPath('data.slug', 'lenovo-legion-5-pro-16ach6h');
        $response->assertJsonPath('data.kind', 'unit');

        $this->assertDatabaseHas('products', [
            'name' => 'Lenovo Legion 5 Pro 16ACH6H',
            'slug' => 'lenovo-legion-5-pro-16ach6h',
            'kind' => Product::KIND_UNIT,
            'price' => null,
            'stock' => null,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'product_created',
        ]);
    }

    public function test_manager_can_create_stocked_accessory_with_initial_stock(): void
    {
        $manager = $this->manager();
        $category = Category::factory()->create();

        $payload = [
            'name' => '100W GaN Fast Charger',
            'brand' => 'Baseus',
            'kind' => Product::KIND_STOCKED,
            'category_id' => $category->id,
            'price' => 35_000,
            'compare_at_price' => 42_000,
            'opening_stock' => 12,
            'warranty_months' => 1,
        ];

        $response = $this->actingAs($manager)
            ->postJson('/api/inventory', $payload)
            ->assertStatus(201);

        $response->assertJsonPath('data.name', '100W GaN Fast Charger');
        $response->assertJsonPath('data.from_price', 35_000);

        $product = Product::where('slug', '100w-gan-fast-charger')->firstOrFail();
        $this->assertEquals(35_000, $product->price);
        $this->assertEquals(12, $product->stock);

        // Verify double-entry ledger restock movement was recorded
        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $product->id,
            'delta' => 12,
            'reason' => StockMovement::RESTOCK,
        ]);
    }

    public function test_manager_can_create_product_with_ai_auto_enrichment(): void
    {
        $manager = $this->manager();
        $category = Category::factory()->create();

        $payload = [
            'name' => 'HP EliteBook 840 G8 Core i7',
            'brand' => 'HP',
            'kind' => Product::KIND_UNIT,
            'category_id' => $category->id,
            'auto_enrich' => true,
        ];

        $response = $this->actingAs($manager)
            ->postJson('/api/inventory', $payload)
            ->assertStatus(201);

        $product = Product::where('slug', 'hp-elitebook-840-g8-core-i7')->firstOrFail();

        // Enriched description and highlights must be present
        $this->assertNotEmpty($product->description);
        $this->assertNotEmpty($product->highlights);

        // Images must be attached automatically
        $this->assertGreaterThan(0, $product->images()->count());

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'product_ai_enriched',
        ]);
    }

    public function test_sales_role_cannot_create_products(): void
    {
        $sales = $this->sales();
        $category = Category::factory()->create();

        $this->actingAs($sales)
            ->postJson('/api/inventory', [
                'name' => 'Unauthorized Laptop',
                'brand' => 'Generic',
                'kind' => Product::KIND_UNIT,
                'category_id' => $category->id,
            ])
            ->assertStatus(403);
    }
}
