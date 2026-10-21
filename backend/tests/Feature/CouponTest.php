<?php

namespace Tests\Feature;

use App\Models\Coupon;
use App\Models\DeliveryZone;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductUnit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CouponTest extends TestCase
{
    use RefreshDatabase;

    private DeliveryZone $zone;

    private ProductUnit $unit;

    protected function setUp(): void
    {
        parent::setUp();

        $this->zone = DeliveryZone::factory()->create([
            'slug' => 'lagos',
            'fee' => 5000,
            'free_above' => 1_000_000,
        ]);

        $this->unit = ProductUnit::factory()
            ->for(Product::factory()->create(['name' => 'Dell XPS 13']))
            ->create(['price' => 500_000, 'status' => ProductUnit::STATUS_AVAILABLE]);
    }

    public function test_can_validate_fixed_naira_coupon(): void
    {
        $coupon = Coupon::create([
            'code' => 'SAVE10K',
            'type' => Coupon::TYPE_FIXED,
            'value' => 10_000,
            'min_order_amount' => 100_000,
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/shop/coupons/validate', [
            'code' => 'SAVE10K',
            'items' => [['product_unit_id' => $this->unit->id]],
            'delivery_zone' => $this->zone->slug,
        ]);

        $response->assertOk()
            ->assertJsonPath('valid', true)
            ->assertJsonPath('data.code', 'SAVE10K')
            ->assertJsonPath('data.discount_amount', 10_000)
            ->assertJsonPath('data.subtotal', 500_000)
            ->assertJsonPath('data.delivery_fee', 5_000)
            ->assertJsonPath('data.total', 495_000); // 500k + 5k - 10k
    }

    public function test_can_validate_percentage_coupon_with_ceiling(): void
    {
        $coupon = Coupon::create([
            'code' => 'DISCOUNT10',
            'type' => Coupon::TYPE_PERCENT,
            'value' => 10,
            'min_order_amount' => 50_000,
            'max_discount' => 25_000, // Capped at 25k even though 10% of 500k is 50k
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/shop/coupons/validate', [
            'code' => 'DISCOUNT10',
            'items' => [['product_unit_id' => $this->unit->id]],
            'delivery_zone' => $this->zone->slug,
        ]);

        $response->assertOk()
            ->assertJsonPath('valid', true)
            ->assertJsonPath('data.discount_amount', 25_000)
            ->assertJsonPath('data.total', 480_000); // 500k + 5k - 25k
    }

    public function test_first_time_coupon_rejected_for_returning_buyer_with_paid_orders(): void
    {
        Coupon::create([
            'code' => 'WELCOME5K',
            'type' => Coupon::TYPE_FIXED,
            'value' => 5_000,
            'min_order_amount' => 100_000,
            'is_first_order_only' => true,
            'is_active' => true,
        ]);

        // Place a previous paid order
        Order::factory()->create([
            'contact_email' => 'returning@example.test',
            'status' => Order::PAID,
            'paid_at' => now(),
        ]);

        $response = $this->postJson('/api/shop/coupons/validate', [
            'code' => 'WELCOME5K',
            'email' => 'returning@example.test',
            'items' => [['product_unit_id' => $this->unit->id]],
            'delivery_zone' => $this->zone->slug,
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('valid', false)
            ->assertJsonPath('message', 'This promo code is valid for first-time buyers only.');
    }

    public function test_order_creation_applies_coupon_and_records_discount(): void
    {
        $coupon = Coupon::create([
            'code' => 'SPECIAL5K',
            'type' => Coupon::TYPE_FIXED,
            'value' => 5_000,
            'min_order_amount' => 100_000,
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/shop/orders', [
            'items' => [['product_unit_id' => $this->unit->id]],
            'contact' => ['name' => 'Femi Cole', 'email' => 'femi@example.test', 'phone' => '08023456789'],
            'delivery_zone' => $this->zone->slug,
            'coupon_code' => 'SPECIAL5K',
            'address' => ['line1' => 'Plot 4, Allen Avenue', 'city' => 'Ikeja', 'state' => 'Lagos'],
        ]);

        $response->assertCreated();

        $reference = $response->json('data.reference');
        $order = Order::where('reference', $reference)->firstOrFail();

        $this->assertSame('SPECIAL5K', $order->coupon_code);
        $this->assertSame(5_000, $order->discount_amount);
        $this->assertSame(500_000, $order->subtotal);
        $this->assertSame(5_000, $order->delivery_fee);
        $this->assertSame(500_000, $order->total); // 500k + 5k - 5k = 500k

        $coupon->refresh();
        $this->assertSame(1, $coupon->used_count);
    }
}
