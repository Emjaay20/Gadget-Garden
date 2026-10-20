<?php

namespace Tests\Feature;

use App\Models\DeliveryZone;
use App\Models\Offer;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductUnit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OfferNegotiationTest extends TestCase
{
    use RefreshDatabase;

    private function laptopWithUnit(int $price = 700_000): array
    {
        $product = Product::factory()->create([
            'is_active' => true,
            'kind' => Product::KIND_UNIT,
            'price' => null,
            'stock' => null,
        ]);

        $unit = ProductUnit::factory()->create([
            'product_id' => $product->id,
            'price' => $price,
            'status' => 'available',
        ]);

        return [$product, $unit];
    }

    public function test_low_offer_is_auto_declined(): void
    {
        [$product, $unit] = $this->laptopWithUnit(1_000_000);

        // 500,000 is 50% of 1,000,000 — below the 70% floor
        $response = $this->postJson('/api/shop/offers', [
            'product_id' => $product->id,
            'product_unit_id' => $unit->id,
            'customer_name' => 'Emeka Obi',
            'customer_email' => 'emeka@example.test',
            'customer_phone' => '08033334444',
            'offered_price' => 500_000,
            'customer_note' => 'Student budget please',
        ])->assertStatus(201);

        $response->assertJsonPath('data.status', Offer::STATUS_DECLINED);
        $this->assertDatabaseHas('offers', [
            'reference' => $response->json('data.reference'),
            'status' => Offer::STATUS_DECLINED,
        ]);
    }

    public function test_offer_near_list_price_is_auto_accepted(): void
    {
        [$product, $unit] = $this->laptopWithUnit(1_000_000);

        // 960,000 is 96% — above 95% threshold
        $response = $this->postJson('/api/shop/offers', [
            'product_id' => $product->id,
            'product_unit_id' => $unit->id,
            'customer_name' => 'Folake Adeleke',
            'customer_email' => 'folake@example.test',
            'customer_phone' => '08022223333',
            'offered_price' => 960_000,
        ])->assertStatus(201);

        $response->assertJsonPath('data.status', Offer::STATUS_ACCEPTED);
        $response->assertJsonPath('data.agreed_price', 960_000);
        $this->assertNotNull($response->json('data.checkout_url'));
    }

    public function test_fair_offer_is_queued_and_countered_by_sales_then_accepted_by_customer(): void
    {
        [$product, $unit] = $this->laptopWithUnit(800_000);
        $sales = $this->sales();

        // Customer offers ₦700,000 (87.5% of list price)
        $offerRes = $this->postJson('/api/shop/offers', [
            'product_id' => $product->id,
            'product_unit_id' => $unit->id,
            'customer_name' => 'David Okon',
            'customer_email' => 'david@example.test',
            'customer_phone' => '08011112222',
            'offered_price' => 700_000,
        ])->assertStatus(201);

        $reference = $offerRes->json('data.reference');
        $this->assertSame(Offer::STATUS_PENDING, $offerRes->json('data.status'));

        // Sales desk counters with ₦750,000
        $counterRes = $this->actingAs($sales)
            ->postJson("/api/offers/{$reference}/counter", [
                'counter_price' => 750_000,
                'staff_note' => 'We can do ₦750k with free laptop bag and mouse included.',
            ])
            ->assertOk();

        $counterRes->assertJsonPath('data.status', Offer::STATUS_COUNTERED);
        $counterRes->assertJsonPath('data.counter_price', 750_000);
        $this->assertNotNull($counterRes->json('data.whatsapp_url'));

        // Customer accepts the counter-offer
        $acceptRes = $this->postJson("/api/shop/offers/{$reference}/accept-counter")
            ->assertOk();

        $acceptRes->assertJsonPath('data.status', Offer::STATUS_ACCEPTED);
        $acceptRes->assertJsonPath('data.agreed_price', 750_000);
    }

    public function test_customer_can_checkout_with_accepted_offer_and_convert_it(): void
    {
        [$product, $unit] = $this->laptopWithUnit(900_000);

        // Pre-create accepted offer
        $offer = Offer::create([
            'reference' => Offer::generateReference(),
            'product_id' => $product->id,
            'product_unit_id' => $unit->id,
            'customer_name' => 'Zainab Ahmed',
            'customer_email' => 'zainab@example.test',
            'customer_phone' => '08055556666',
            'original_price' => 900_000,
            'offered_price' => 820_000,
            'agreed_price' => 820_000,
            'status' => Offer::STATUS_ACCEPTED,
            'expires_at' => now()->addHours(2),
        ]);

        $zone = DeliveryZone::where('slug', 'pickup-store')->first()
            ?? DeliveryZone::factory()->create(['slug' => 'pickup-store', 'fee' => 0]);

        $orderRes = $this->postJson('/api/shop/orders', [
            'items' => [
                ['product_id' => $product->id, 'product_unit_id' => $unit->id, 'quantity' => 1],
            ],
            'offer_reference' => $offer->reference,
            'delivery_zone' => $zone->slug,
            'contact' => [
                'name' => 'Zainab Ahmed',
                'email' => 'zainab@example.test',
                'phone' => '08055556666',
            ],
            'address' => [
                'line1' => '12 Oshitelu St',
                'city' => 'Ikeja',
                'state' => 'Lagos',
            ],
        ])->assertStatus(201);

        // Order subtotal must reflect the agreed offer price, not original 900k!
        $orderRes->assertJsonPath('data.subtotal', 820_000);
        $orderRes->assertJsonPath('data.total', 820_000);

        // Offer is converted
        $this->assertSame(Offer::STATUS_CONVERTED, $offer->fresh()->status);
        $this->assertNotNull($offer->fresh()->order_id);
    }

    public function test_staff_can_decline_offer(): void
    {
        [$product, $unit] = $this->laptopWithUnit(600_000);
        $sales = $this->sales();

        $offer = Offer::create([
            'reference' => Offer::generateReference(),
            'product_id' => $product->id,
            'product_unit_id' => $unit->id,
            'customer_name' => 'Kolawole Sanusi',
            'customer_email' => 'kola@example.test',
            'customer_phone' => '08077778888',
            'original_price' => 600_000,
            'offered_price' => 450_000,
            'status' => Offer::STATUS_PENDING,
        ]);

        $this->actingAs($sales)
            ->postJson("/api/offers/{$offer->reference}/decline", [
                'staff_note' => 'Cannot discount this particular machine further.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', Offer::STATUS_DECLINED);
    }
}
