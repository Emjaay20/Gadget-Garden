<?php

namespace Database\Seeders;

use App\Models\Coupon;
use Illuminate\Database\Seeder;

class CouponSeeder extends Seeder
{
    public function run(): void
    {
        Coupon::firstOrCreate(
            ['code' => 'WELCOME5K'],
            [
                'description' => '₦5,000 off your first laptop purchase',
                'type' => Coupon::TYPE_FIXED,
                'value' => 5000,
                'min_order_amount' => 150000,
                'is_first_order_only' => true,
                'is_active' => true,
            ]
        );

        Coupon::firstOrCreate(
            ['code' => 'GARDEN10'],
            [
                'description' => '10% off accessories and orders above ₦50,000',
                'type' => Coupon::TYPE_PERCENT,
                'value' => 10,
                'min_order_amount' => 50000,
                'max_discount' => 20000,
                'is_first_order_only' => false,
                'is_active' => true,
            ]
        );
    }
}
