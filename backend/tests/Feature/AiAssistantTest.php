<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductUnit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AiAssistantTest extends TestCase
{
    use RefreshDatabase;

    private function createLaptopWithUnit(
        string $name,
        string $brand,
        int $price,
        array $specs,
        string $status = ProductUnit::STATUS_AVAILABLE,
        ?Category $category = null
    ): array {
        $category = $category ?? Category::factory()->create();

        $product = Product::factory()->create([
            'name' => $name,
            'brand' => $brand,
            'is_active' => true,
            'kind' => Product::KIND_UNIT,
            'category_id' => $category->id,
            'price' => null,
            'stock' => null,
        ]);

        $unit = ProductUnit::factory()->create([
            'product_id' => $product->id,
            'price' => $price,
            'status' => $status,
            'specs' => $specs,
            'grade' => 'A',
            'condition' => ProductUnit::CONDITION_FOREIGN_USED,
        ]);

        return [$product, $unit];
    }

    public function test_ai_assistant_extracts_budget_and_filters_units(): void
    {
        $this->createLaptopWithUnit('Budget Machine', 'HP', 520_000, [
            'cpu' => 'Core i5-1135G7',
            'ram_gb' => 16,
            'storage_gb' => 256,
            'battery_health' => 90,
        ]);

        $this->createLaptopWithUnit('Expensive Beast', 'Dell', 950_000, [
            'cpu' => 'Core i7-1185G7',
            'ram_gb' => 32,
            'storage_gb' => 1024,
            'battery_health' => 95,
        ]);

        $response = $this->postJson('/api/shop/ai/recommend', [
            'query' => 'I need a clean laptop under 600k for work',
        ])->assertOk();

        $response->assertJsonPath('detected_intent.budget_max', 600_000);
        $response->assertJsonPath('is_fallback', false);

        $recommendations = $response->json('recommendations');
        $this->assertNotEmpty($recommendations);

        foreach ($recommendations as $item) {
            $this->assertLessThanOrEqual(600_000 * 1.05, $item['price']);
        }
    }

    public function test_ai_assistant_detects_software_development_intent_and_prefers_high_ram(): void
    {
        $this->createLaptopWithUnit('HP 8GB Dev', 'HP', 500_000, [
            'cpu' => 'Core i5',
            'ram_gb' => 8,
            'storage_gb' => 256,
        ]);

        $this->createLaptopWithUnit('ThinkPad Dev Workhorse', 'Lenovo', 680_000, [
            'cpu' => 'Core i7-1165G7',
            'ram_gb' => 16,
            'storage_gb' => 512,
            'battery_health' => 94,
        ]);

        $response = $this->postJson('/api/shop/ai/recommend', [
            'query' => 'Need a system for software engineering and docker with 16gb ram',
        ])->assertOk();

        $response->assertJsonPath('detected_intent.purpose', 'software_development');
        $response->assertJsonPath('detected_intent.min_ram', 16);

        $recommendations = $response->json('recommendations');
        $this->assertNotEmpty($recommendations);
        $this->assertEquals('ThinkPad Dev Workhorse', $recommendations[0]['product_name']);
        $this->assertEquals(16, $recommendations[0]['specs']['ram_gb']);
    }

    public function test_ai_assistant_detects_gaming_intent_and_dedicated_gpu(): void
    {
        $gamingCat = Category::factory()->create(['slug' => 'gaming', 'name' => 'Gaming']);

        $this->createLaptopWithUnit('Everyday Ultrabook', 'HP', 550_000, [
            'cpu' => 'Core i5',
            'ram_gb' => 16,
            'storage_gb' => 512,
        ]);

        $this->createLaptopWithUnit('Alienware Gaming Beast', 'Alienware', 1_850_000, [
            'cpu' => 'Core i9-11900H',
            'ram_gb' => 32,
            'storage_gb' => 1024,
            'gpu' => 'RTX 3080 8GB',
            'battery_health' => 90,
        ], ProductUnit::STATUS_AVAILABLE, $gamingCat);

        $response = $this->postJson('/api/shop/ai/recommend', [
            'query' => 'Looking for a gaming laptop for Blender 3D rendering and games with RTX gpu',
        ])->assertOk();

        $response->assertJsonPath('detected_intent.purpose', 'gaming_and_creative');
        $response->assertJsonPath('detected_intent.needs_gpu', true);

        $recommendations = $response->json('recommendations');
        $this->assertEquals('Alienware Gaming Beast', $recommendations[0]['product_name']);
        $this->assertStringContainsString('RTX 3080', $recommendations[0]['specs']['gpu']);
    }

    public function test_ai_assistant_handles_unrealistic_budget_with_smart_fallback(): void
    {
        $this->createLaptopWithUnit('Standard Laptop', 'HP', 520_000, [
            'cpu' => 'Core i5',
            'ram_gb' => 16,
            'storage_gb' => 256,
        ]);

        // Budget of 100k is far below any laptop in stock
        $response = $this->postJson('/api/shop/ai/recommend', [
            'query' => 'I want a gaming laptop under 100k',
        ])->assertOk();

        $response->assertJsonPath('is_fallback', true);
        $this->assertStringContainsString("couldn't find an exact in-stock match", $response->json('message'));
        $this->assertNotEmpty($response->json('recommendations'));
    }

    public function test_ai_assistant_ignores_unavailable_or_sold_units(): void
    {
        $this->createLaptopWithUnit('Faulty Laptop', 'Dell', 500_000, [
            'cpu' => 'Core i7',
            'ram_gb' => 16,
            'storage_gb' => 512,
        ], ProductUnit::STATUS_FAULTY);

        $this->createLaptopWithUnit('Available Laptop', 'Dell', 550_000, [
            'cpu' => 'Core i5',
            'ram_gb' => 16,
            'storage_gb' => 256,
        ], ProductUnit::STATUS_AVAILABLE);

        $response = $this->postJson('/api/shop/ai/recommend', [
            'query' => 'Dell laptop under 600k',
        ])->assertOk();

        $recommendations = $response->json('recommendations');
        $this->assertCount(1, $recommendations);
        $this->assertEquals('Available Laptop', $recommendations[0]['product_name']);
    }
}
