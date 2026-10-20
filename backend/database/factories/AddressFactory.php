<?php

namespace Database\Factories;

use App\Models\Address;
use App\Models\Customer;
use App\Models\DeliveryZone;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Address> */
class AddressFactory extends Factory
{
    public function definition(): array
    {
        return [
            'customer_id' => Customer::factory(),
            'delivery_zone_id' => DeliveryZone::factory(),
            'line1' => fake()->streetAddress(),
            'city' => 'Ikeja',
            'state' => 'Lagos',
            'is_default' => true,
        ];
    }
}
