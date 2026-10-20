<?php

namespace Database\Factories;

use App\Models\DeliveryZone;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<DeliveryZone> */
class DeliveryZoneFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->unique()->city();

        return [
            'name' => $name,
            'slug' => Str::slug($name),
            'fee' => 5_000,
            'free_above' => null,
            'is_active' => true,
            'position' => 0,
        ];
    }
}
