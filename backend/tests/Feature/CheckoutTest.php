<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\DeliveryZone;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\StockMovement;
use App\Models\UnitEvent;
use App\Shop\PlacesOrders;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Checkout. The two things that must never happen: the browser deciding what
 * something costs, and one physical laptop being sold twice.
 */
class CheckoutTest extends TestCase
{
    use RefreshDatabase;

    private DeliveryZone $zone;

    protected function setUp(): void
    {
        parent::setUp();

        $this->zone = DeliveryZone::factory()->create([
            'slug' => 'lagos-mainland',
            'fee' => 3_500,
            'free_above' => 500_000,
        ]);
    }

    private function laptop(int $price = 620_000): ProductUnit
    {
        return ProductUnit::factory()
            ->for(Product::factory()->create())
            ->create(['price' => $price]);
    }

    /** @return array<string, mixed> */
    private function payload(array $items, array $overrides = []): array
    {
        return array_replace_recursive([
            'items' => $items,
            'contact' => [
                'name' => 'Ada Obi',
                'email' => 'ada@example.test',
                'phone' => '08056947271',
            ],
            'delivery_zone' => $this->zone->slug,
            'address' => [
                'line1' => '12 Oshitelu Street',
                'city' => 'Ikeja',
                'state' => 'Lagos',
                'landmark' => 'Adjacent GTBank',
            ],
        ], $overrides);
    }

    /* ------------------------------------------------------------- pricing */

    public function test_an_order_is_priced_from_the_database(): void
    {
        $unit = $this->laptop(620_000);

        $response = $this->postJson('/api/shop/orders', $this->payload([
            ['product_unit_id' => $unit->id],
        ]));

        $response->assertCreated()
            ->assertJsonPath('data.subtotal', 620_000)
            // Over the ₦500,000 threshold, so delivery is free.
            ->assertJsonPath('data.delivery_fee', 0)
            ->assertJsonPath('data.total', 620_000);
    }

    /**
     * The whole reason prices are never accepted from the client: a hand-edited
     * request must change nothing.
     */
    public function test_prices_in_the_request_body_are_ignored(): void
    {
        $unit = $this->laptop(620_000);

        $response = $this->postJson('/api/shop/orders', $this->payload([
            [
                'product_unit_id' => $unit->id,
                'unit_price' => 1,
                'price' => 1,
                'line_total' => 1,
            ],
        ], [
            'subtotal' => 1,
            'total' => 1,
            'delivery_fee' => 0,
        ]));

        $response->assertCreated()->assertJsonPath('data.total', 620_000);
        $this->assertSame(620_000, (int) Order::first()->total);
    }

    public function test_the_delivery_fee_is_computed_from_the_zone(): void
    {
        // A cheap accessory, under the free-delivery threshold.
        $product = Product::factory()->stocked(stock: 10, price: 22_000)->create();

        $response = $this->postJson('/api/shop/orders', $this->payload([
            ['product_id' => $product->id, 'quantity' => 2],
        ]));

        $response->assertCreated()
            ->assertJsonPath('data.subtotal', 44_000)
            ->assertJsonPath('data.delivery_fee', 3_500)
            ->assertJsonPath('data.total', 47_500);
    }

    public function test_the_order_total_always_equals_subtotal_plus_delivery(): void
    {
        $product = Product::factory()->stocked(stock: 10, price: 22_000)->create();

        $this->postJson('/api/shop/orders', $this->payload([
            ['product_id' => $product->id, 'quantity' => 3],
        ]))->assertCreated();

        $order = Order::first();
        $this->assertSame(
            (int) $order->subtotal + (int) $order->delivery_fee,
            (int) $order->total,
        );
    }

    /* -------------------------------------------------------- reservations */

    public function test_placing_an_order_reserves_the_machine(): void
    {
        $unit = $this->laptop();

        $reference = $this->postJson('/api/shop/orders', $this->payload([
            ['product_unit_id' => $unit->id],
        ]))->assertCreated()->json('data.reference');

        $unit->refresh();
        $this->assertSame(ProductUnit::STATUS_RESERVED, $unit->status);
        $this->assertNotNull($unit->reserved_until);

        $order = Order::where('reference', $reference)->first();
        $this->assertSame($order->id, (int) $unit->order_id);

        $this->assertDatabaseHas('unit_events', [
            'product_unit_id' => $unit->id,
            'event' => UnitEvent::RESERVED,
        ]);
    }

    /**
     * THE CENTRAL GUARANTEE. Two customers, one laptop: the second checkout must
     * be refused rather than handed a payable order for something that is gone.
     */
    public function test_a_second_customer_cannot_check_out_with_the_same_machine(): void
    {
        $unit = $this->laptop();

        $this->postJson('/api/shop/orders', $this->payload([
            ['product_unit_id' => $unit->id],
        ]))->assertCreated();

        $second = $this->postJson('/api/shop/orders', $this->payload([
            ['product_unit_id' => $unit->id],
        ], ['contact' => ['email' => 'someone.else@example.test']]));

        $second->assertStatus(422);
        $this->assertStringContainsString(
            'no longer available',
            $second->json('message'),
        );

        // Exactly one order exists, and the machine is still held by it.
        $this->assertSame(1, Order::count());
        $this->assertSame(ProductUnit::STATUS_RESERVED, $unit->fresh()->status);
    }

    public function test_a_failed_checkout_leaves_no_partial_order_behind(): void
    {
        $available = $this->laptop(500_000);
        $taken = $this->laptop(700_000);
        // A real order: `product_units.order_id` is a foreign key, so a made-up id
        // is (correctly) refused by the database.
        $otherOrder = Order::factory()->create();
        $taken->reserveFor($otherOrder->id, $otherOrder->reference, now()->addDay());

        $this->postJson('/api/shop/orders', $this->payload([
            ['product_unit_id' => $available->id],
            ['product_unit_id' => $taken->id],
        ]))->assertStatus(422);

        // Nothing survives the rollback beyond the fixture order created above,
        // and the good machine is back on the shelf rather than stranded in a
        // reservation belonging to an order that no longer exists.
        $this->assertSame(1, Order::count(), 'A partial order survived the rollback.');
        $this->assertSame(0, OrderItem::count());
        $this->assertSame(ProductUnit::STATUS_AVAILABLE, $available->fresh()->status);
    }

    /**
     * Quantity stock is deliberately NOT held — decrementing before payment
     * would let anyone empty the shop with carts they never pay for.
     */
    public function test_stocked_products_are_not_decremented_at_checkout(): void
    {
        $product = Product::factory()->stocked(stock: 10, price: 22_000)->create();

        $this->postJson('/api/shop/orders', $this->payload([
            ['product_id' => $product->id, 'quantity' => 3],
        ]))->assertCreated();

        $this->assertSame(10, (int) $product->fresh()->stock);
        $this->assertSame(0, StockMovement::count());
    }

    public function test_ordering_more_than_is_in_stock_is_refused(): void
    {
        $product = Product::factory()->stocked(stock: 2, price: 22_000)->create();

        $this->postJson('/api/shop/orders', $this->payload([
            ['product_id' => $product->id, 'quantity' => 5],
        ]))->assertStatus(422);

        $this->assertSame(0, Order::count());
    }

    public function test_a_serialized_listing_cannot_be_bought_as_a_quantity(): void
    {
        $unit = $this->laptop();

        $this->postJson('/api/shop/orders', $this->payload([
            ['product_id' => $unit->product_id, 'quantity' => 1],
        ]))->assertStatus(422);
    }

    public function test_a_sold_machine_cannot_be_ordered(): void
    {
        $unit = $this->laptop();
        $otherOrder = Order::factory()->create();
        $unit->markSold($otherOrder->id, $otherOrder->reference);

        $this->postJson('/api/shop/orders', $this->payload([
            ['product_unit_id' => $unit->id],
        ]))->assertStatus(422);
    }

    /* ------------------------------------------------------------ snapshots */

    /**
     * Re-pricing the catalogue must not rewrite what somebody already paid.
     */
    public function test_order_lines_snapshot_the_price_and_specs(): void
    {
        $unit = $this->laptop(620_000);
        $unit->update(['specs' => ['cpu' => 'Core i7-1165G7', 'ram_gb' => 16]]);

        $this->postJson('/api/shop/orders', $this->payload([
            ['product_unit_id' => $unit->id],
        ]))->assertCreated();

        // The catalogue changes afterwards.
        $unit->update(['price' => 900_000, 'specs' => ['cpu' => 'Something else']]);
        $unit->product->update(['name' => 'Renamed listing']);

        $item = Order::first()->items()->first();

        $this->assertSame(620_000, (int) $item->unit_price_at_time);
        $this->assertSame('Core i7-1165G7', $item->specs_at_time['cpu']);
        $this->assertNotSame('Renamed listing', $item->name_at_time);
        $this->assertSame($unit->sku, $item->sku_at_time);
    }

    /* ------------------------------------------------------------- customer */

    public function test_a_returning_buyer_is_matched_on_email(): void
    {
        foreach ([$this->laptop(400_000), $this->laptop(500_000)] as $unit) {
            $this->postJson('/api/shop/orders', $this->payload([
                ['product_unit_id' => $unit->id],
            ]))->assertCreated();
        }

        $this->assertSame(1, Customer::count());
        $this->assertSame(2, Customer::first()->orders()->count());
    }

    public function test_the_reference_is_readable_and_unique(): void
    {
        $unit = $this->laptop();

        $reference = $this->postJson('/api/shop/orders', $this->payload([
            ['product_unit_id' => $unit->id],
        ]))->json('data.reference');

        $this->assertMatchesRegularExpression('/^GG-[A-Z0-9]{6}$/', $reference);
        // No characters that are ambiguous when read down a phone line.
        $this->assertSame(0, preg_match('/[ILOU]/', substr($reference, 3)));
    }

    /* ------------------------------------------------------------ validation */

    public function test_an_empty_cart_is_refused(): void
    {
        $this->postJson('/api/shop/orders', $this->payload([]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['items']);
    }

    public function test_contact_details_are_required(): void
    {
        $unit = $this->laptop();

        $this->postJson('/api/shop/orders', [
            'items' => [['product_unit_id' => $unit->id]],
            'delivery_zone' => $this->zone->slug,
            'address' => ['line1' => 'x', 'city' => 'Ikeja', 'state' => 'Lagos'],
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['contact.name', 'contact.email', 'contact.phone']);
    }

    public function test_an_unknown_delivery_zone_is_refused(): void
    {
        $unit = $this->laptop();

        $this->postJson('/api/shop/orders', $this->payload(
            [['product_unit_id' => $unit->id]],
            ['delivery_zone' => 'mars'],
        ))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['delivery_zone']);
    }

    /* ---------------------------------------------------- database guarantees */

    public function test_the_database_refuses_an_order_whose_total_does_not_add_up(): void
    {
        $order = Order::factory()->create();

        $this->expectException(QueryException::class);

        $order->forceFill(['subtotal' => 100, 'delivery_fee' => 10, 'total' => 999])->save();
    }

    public function test_the_database_refuses_a_serialized_line_with_quantity_above_one(): void
    {
        $unit = $this->laptop();
        $order = Order::factory()->create();

        $this->expectException(QueryException::class);

        $order->items()->create([
            'product_id' => $unit->product_id,
            'product_unit_id' => $unit->id,
            'name_at_time' => 'Two of a one-of-a-kind laptop',
            'unit_price_at_time' => 620_000,
            'quantity' => 2,
            'line_total' => 1_240_000,
        ]);
    }

    /* --------------------------------------------------------------- status */

    public function test_the_order_status_page_is_readable_by_reference(): void
    {
        $unit = $this->laptop();

        $reference = $this->postJson('/api/shop/orders', $this->payload([
            ['product_unit_id' => $unit->id],
        ]))->json('data.reference');

        $this->getJson("/api/shop/orders/{$reference}")
            ->assertOk()
            ->assertJsonPath('data.reference', $reference)
            ->assertJsonPath('data.status', Order::PENDING_PAYMENT)
            ->assertJsonPath('data.status_label', 'Awaiting payment');
    }

    public function test_an_unknown_reference_is_a_404(): void
    {
        $this->getJson('/api/shop/orders/GG-NOPE99')
            ->assertStatus(404)
            ->assertJsonPath('message', 'Order not found.');
    }

    public function test_the_status_page_never_exposes_internals(): void
    {
        $unit = $this->laptop();
        $unit->update(['cost' => 470_000]);

        $reference = $this->postJson('/api/shop/orders', $this->payload([
            ['product_unit_id' => $unit->id],
        ]))->json('data.reference');

        $body = $this->getJson("/api/shop/orders/{$reference}")->getContent();

        $this->assertStringNotContainsString('470000', $body);
        $this->assertStringNotContainsString('staff_note', $body);
        $this->assertStringNotContainsString('customer_id', $body);
    }

    /* ------------------------------------------------------------- expiry */

    public function test_expiring_an_unpaid_order_puts_the_machine_back_on_the_shelf(): void
    {
        $unit = $this->laptop();

        $reference = $this->postJson('/api/shop/orders', $this->payload([
            ['product_unit_id' => $unit->id],
        ]))->json('data.reference');

        // Wind the hold into the past.
        Order::where('reference', $reference)->update(['reserved_until' => now()->subHour()]);

        $this->artisan('orders:expire-unpaid')->assertSuccessful();

        $unit->refresh();
        $this->assertSame(ProductUnit::STATUS_AVAILABLE, $unit->status);
        $this->assertNull($unit->order_id);
        $this->assertNull($unit->reserved_until);

        $this->assertSame(
            Order::CANCELLED,
            Order::where('reference', $reference)->first()->status,
        );

        $this->assertDatabaseHas('unit_events', [
            'product_unit_id' => $unit->id,
            'event' => UnitEvent::RESERVATION_RELEASED,
        ]);
    }

    public function test_a_hold_that_has_not_expired_is_left_alone(): void
    {
        $unit = $this->laptop();

        $this->postJson('/api/shop/orders', $this->payload([
            ['product_unit_id' => $unit->id],
        ]))->assertCreated();

        $this->artisan('orders:expire-unpaid')->assertSuccessful();

        $this->assertSame(ProductUnit::STATUS_RESERVED, $unit->fresh()->status);
    }

    /** A paid order's machine belongs to somebody. It must never be released. */
    public function test_a_paid_order_is_never_expired(): void
    {
        $unit = $this->laptop();

        $reference = $this->postJson('/api/shop/orders', $this->payload([
            ['product_unit_id' => $unit->id],
        ]))->json('data.reference');

        $order = Order::where('reference', $reference)->first();
        $order->forceFill([
            'status' => Order::PAID,
            'paid_at' => now(),
            'reserved_until' => now()->subHour(),
        ])->save();

        $this->artisan('orders:expire-unpaid')->assertSuccessful();

        $this->assertSame(Order::PAID, $order->fresh()->status);
        $this->assertSame(ProductUnit::STATUS_RESERVED, $unit->fresh()->status);
    }

    public function test_the_dry_run_changes_nothing(): void
    {
        $unit = $this->laptop();

        $reference = $this->postJson('/api/shop/orders', $this->payload([
            ['product_unit_id' => $unit->id],
        ]))->json('data.reference');

        Order::where('reference', $reference)->update(['reserved_until' => now()->subHour()]);

        $this->artisan('orders:expire-unpaid --dry-run')->assertSuccessful();

        $this->assertSame(ProductUnit::STATUS_RESERVED, $unit->fresh()->status);
        $this->assertSame(
            Order::PENDING_PAYMENT,
            Order::where('reference', $reference)->first()->status,
        );
    }

    public function test_release_is_idempotent(): void
    {
        $unit = $this->laptop();

        $reference = $this->postJson('/api/shop/orders', $this->payload([
            ['product_unit_id' => $unit->id],
        ]))->json('data.reference');

        $order = Order::where('reference', $reference)->first();
        $orders = app(PlacesOrders::class);

        $orders->release($order, Order::CANCELLED);
        $orders->release($order->fresh(), Order::CANCELLED);

        $this->assertSame(ProductUnit::STATUS_AVAILABLE, $unit->fresh()->status);
        $this->assertSame(
            1,
            UnitEvent::where('product_unit_id', $unit->id)
                ->where('event', UnitEvent::RESERVATION_RELEASED)
                ->count(),
        );
    }
}
