<?php

namespace Database\Factories;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Product> */
class ProductFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->unique()->words(3, true);

        return [
            'name' => Str::title($name),
            'slug' => Str::slug($name),
            'brand' => fake()->randomElement(['HP', 'Dell', 'Lenovo', 'ASUS', 'Acer']),
            'kind' => Product::KIND_UNIT,
            'category_id' => Category::factory(),
            'description' => fake()->paragraph(),
            'short_description' => fake()->sentence(),
            'highlights' => [fake()->sentence(), fake()->sentence()],
            'base_specs' => ['screen' => '14" FHD'],
            'warranty_months' => 6,
            // A unit listing owns neither; the CHECK constraint enforces it.
            'price' => null,
            'compare_at_price' => null,
            'stock' => null,
            'low_stock_threshold' => 5,
            'is_active' => true,
        ];
    }

    /**
     * A quantity-tracked SKU. `stock` is set directly here rather than through
     * the ledger because a factory builds a starting state, not a history — the
     * seeder, which represents real intake, does go through the ledger.
     */
    public function stocked(int $stock = 10, int $price = 25_000): static
    {
        return $this->state(fn () => [
            'kind' => Product::KIND_STOCKED,
            'price' => $price,
            'stock' => $stock,
        ]);
    }
}
