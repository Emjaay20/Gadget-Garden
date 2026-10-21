<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\DeliveryZone;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\Payment;
use App\Payments\MockLedger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WishlistAndLayawayTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_customer_can_share_a_public_wishlist(): void
    {
        $customer = Customer::factory()->create(['password' => bcrypt('password123')]);
        $token = $customer->createToken('storefront_customer')->plainTextToken;
        $product = Product::factory()->create();

        $this->withToken($token)->postJson('/api/shop/customer/wishlist/items', [
            'product_id' => $product->id,
        ])->assertCreated();

        $wishlist = $this->withToken($token)->patchJson('/api/shop/customer/wishlist', [
            'title' => 'Birthday ideas',
            'is_public' => true,
        ])->assertOk()->json('data');

        $this->getJson('/api/shop/wishlists/'.$wishlist['share_slug'])
            ->assertOk()
            ->assertJsonPath('data.title', 'Birthday ideas')
            ->assertJsonPath('data.items.0.product.id', (string) $product->id);
    }

    public function test_layaway_reserves_one_laptop_for_thirty_days_with_a_minimum_deposit(): void
    {
        $zone = DeliveryZone::factory()->create(['slug' => 'lagos', 'fee' => 0]);
        $unit = ProductUnit::factory()->for(Product::factory()->create())->create(['price' => 600_000]);

        $response = $this->postJson('/api/shop/orders', [
            'items' => [['product_unit_id' => $unit->id]],
            'contact' => ['name' => 'Ada Obi', 'email' => 'ada@example.test', 'phone' => '08056947271'],
            'delivery_zone' => $zone->slug,
            'address' => ['line1' => '12 Oshitelu Street', 'city' => 'Ikeja', 'state' => 'Lagos'],
            'payment_mode' => 'layaway',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.payment_mode', 'layaway')
            ->assertJsonPath('data.layaway_minimum_payment', 120_000);

        $order = Order::firstOrFail();
        $this->assertTrue($order->isLayaway());
        $this->assertSame(0, $order->layaway_paid_amount);
        $this->assertTrue($order->layaway_due_at->between(now()->addDays(29), now()->addDays(31)));
        $this->assertSame(ProductUnit::STATUS_RESERVED, $unit->fresh()->status);
    }

    public function test_verified_layaway_payments_accumulate_before_stock_is_sold(): void
    {
        config(['shop.provider' => 'mock']);
        $zone = DeliveryZone::factory()->create(['slug' => 'lagos', 'fee' => 0]);
        $unit = ProductUnit::factory()->for(Product::factory()->create())->create(['price' => 600_000]);
        $reference = $this->postJson('/api/shop/orders', [
            'items' => [['product_unit_id' => $unit->id]],
            'contact' => ['name' => 'Ada Obi', 'email' => 'ada@example.test', 'phone' => '08056947271'],
            'delivery_zone' => $zone->slug,
            'address' => ['line1' => '12 Oshitelu Street', 'city' => 'Ikeja', 'state' => 'Lagos'],
            'payment_mode' => 'layaway',
        ])->json('data.reference');

        $first = $this->postJson('/api/shop/payments/initialize', ['reference' => $reference])
            ->assertOk()->json('data');
        $this->assertSame(120_000, $first['amount']);
        MockLedger::settle(Payment::latest('id')->value('provider_reference'), 'success', 120_000);
        $this->postJson('/api/shop/payments/verify', ['reference' => $reference])
            ->assertOk()->assertJsonPath('data.status', Order::PENDING_PAYMENT);

        $this->assertSame(120_000, Order::where('reference', $reference)->value('layaway_paid_amount'));
        $this->assertSame(ProductUnit::STATUS_RESERVED, $unit->fresh()->status);

        $second = $this->postJson('/api/shop/payments/initialize', ['reference' => $reference, 'amount' => 480_000])
            ->assertOk()->json('data');
        MockLedger::settle(Payment::latest('id')->value('provider_reference'), 'success', 480_000);
        $this->postJson('/api/shop/payments/verify', ['reference' => $reference])
            ->assertOk()->assertJsonPath('data.status', Order::PAID);

        $this->assertSame(ProductUnit::STATUS_SOLD, $unit->fresh()->status);
    }
}
