<?php

namespace Database\Factories;

use App\Models\Customer;
use App\Models\Order;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Order> */
class OrderFactory extends Factory
{
    public function definition(): array
    {
        $subtotal = fake()->numberBetween(100_000, 900_000);
        $fee = 5_000;

        return [
            'reference' => Order::generateReference(),
            'customer_id' => Customer::factory(),
            'address_id' => null,
            'subtotal' => $subtotal,
            'delivery_fee' => $fee,
            'total' => $subtotal + $fee,
            'contact_name' => fake()->name(),
            'contact_email' => fake()->unique()->safeEmail(),
            'contact_phone' => '08056947271',
            'placed_at' => now(),
            'reserved_until' => now()->addDay(),
        ];
    }

    /** An order whose hold has already run out — what the sweeper collects. */
    public function expired(): static
    {
        return $this->state(fn () => ['reserved_until' => now()->subHour()]);
    }
}
