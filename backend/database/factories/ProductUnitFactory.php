<?php

namespace Database\Factories;

use App\Models\Product;
use App\Models\ProductUnit;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<ProductUnit> */
class ProductUnitFactory extends Factory
{
    public function definition(): array
    {
        return [
            'product_id' => Product::factory(),
            'sku' => 'GG-'.Str::upper(Str::random(8)),
            'serial' => Str::upper(Str::random(12)),
            'condition' => ProductUnit::CONDITION_FOREIGN_USED,
            'grade' => fake()->randomElement(['A', 'B']),
            'specs' => [
                'cpu' => 'Core i7-1165G7',
                'ram_gb' => 16,
                'storage_gb' => 512,
                'storage_type' => 'SSD',
            ],
            'price' => fake()->numberBetween(400_000, 900_000),
            'cost' => fake()->numberBetween(300_000, 700_000),
            'status' => ProductUnit::STATUS_AVAILABLE,
        ];
    }

    public function sold(int $orderId = 1): static
    {
        return $this->state(fn () => [
            'status' => ProductUnit::STATUS_SOLD,
            'order_id' => $orderId,
        ]);
    }

    public function reserved(int $orderId = 1): static
    {
        return $this->state(fn () => [
            'status' => ProductUnit::STATUS_RESERVED,
            'reserved_until' => now()->addDay(),
            'order_id' => $orderId,
        ]);
    }
}
