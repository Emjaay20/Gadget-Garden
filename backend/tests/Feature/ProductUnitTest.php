<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\UnitEvent;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

/**
 * Serialized stock. The invariant that matters most here is simple and absolute:
 * ONE PHYSICAL LAPTOP CANNOT BE SOLD TWICE.
 */
class ProductUnitTest extends TestCase
{
    use RefreshDatabase;

    private function unit(array $attributes = []): ProductUnit
    {
        return ProductUnit::factory()->for(Product::factory())->create($attributes);
    }

    /**
     * A real order row.
     *
     * `product_units.order_id` is a foreign key (added alongside the orders
     * table), so these tests cannot use invented ids — the database refuses
     * them, which is exactly the guarantee we want.
     */
    private function order(): Order
    {
        return Order::factory()->create();
    }

    /* ------------------------------------------------------------ reserving */

    public function test_reserving_moves_it_off_the_shelf_and_records_an_event(): void
    {
        $unit = $this->unit();

        $order = $this->order();

        $this->assertTrue($unit->reserveFor($order->id, $order->reference, now()->addDay()));

        $unit->refresh();
        $this->assertSame(ProductUnit::STATUS_RESERVED, $unit->status);
        $this->assertNotNull($unit->reserved_until);
        $this->assertSame($order->id, (int) $unit->order_id);

        $this->assertDatabaseHas('unit_events', [
            'product_unit_id' => $unit->id,
            'event' => UnitEvent::RESERVED,
            'from_status' => ProductUnit::STATUS_AVAILABLE,
            'to_status' => ProductUnit::STATUS_RESERVED,
        ]);
    }

    /**
     * THE RACE THIS SCHEMA EXISTS TO CLOSE. Two customers, one laptop: the
     * second attempt must be refused rather than silently overwriting the first
     * reservation.
     */
    public function test_a_second_customer_cannot_reserve_the_same_machine(): void
    {
        $unit = $this->unit();

        $first = $this->order();
        $second = $this->order();

        $this->assertTrue($unit->reserveFor($first->id, $first->reference, now()->addDay()));
        $this->assertFalse($unit->reserveFor($second->id, $second->reference, now()->addDay()));

        // Still held by the first order.
        $this->assertSame($first->id, (int) $unit->fresh()->order_id);
    }

    public function test_releasing_puts_it_back_on_the_shelf(): void
    {
        $unit = $this->unit();
        $order = $this->order();
        $unit->reserveFor($order->id, $order->reference, now()->addDay());

        $this->assertTrue($unit->releaseReservation('Order expired unpaid.'));

        $unit->refresh();
        $this->assertSame(ProductUnit::STATUS_AVAILABLE, $unit->status);
        $this->assertNull($unit->reserved_until);
        $this->assertNull($unit->order_id);

        $this->assertDatabaseHas('unit_events', [
            'product_unit_id' => $unit->id,
            'event' => UnitEvent::RESERVATION_RELEASED,
        ]);
    }

    public function test_releasing_something_that_is_not_reserved_is_a_no_op(): void
    {
        $this->assertFalse($this->unit()->releaseReservation());
    }

    public function test_expired_reservations_scope_finds_only_stale_holds(): void
    {
        $stale = $this->unit();
        $staleOrder = $this->order();
        $stale->reserveFor($staleOrder->id, $staleOrder->reference, now()->subHour());

        $fresh = $this->unit();
        $freshOrder = $this->order();
        $fresh->reserveFor($freshOrder->id, $freshOrder->reference, now()->addHour());

        $available = $this->unit();

        $found = ProductUnit::expiredReservations()->pluck('id');

        $this->assertTrue($found->contains($stale->id));
        $this->assertFalse($found->contains($fresh->id));
        $this->assertFalse($found->contains($available->id));
    }

    /* --------------------------------------------------------------- selling */

    public function test_a_reserved_unit_can_be_sold_to_the_order_holding_it(): void
    {
        $unit = $this->unit();
        $order = $this->order();
        $unit->reserveFor($order->id, $order->reference, now()->addDay());

        $this->assertTrue($unit->markSold($order->id, $order->reference));

        $unit->refresh();
        $this->assertSame(ProductUnit::STATUS_SOLD, $unit->status);
        $this->assertNull($unit->reserved_until);
        $this->assertSame($order->id, (int) $unit->order_id);
    }

    /**
     * Settlement is driven from two places (webhook and customer poll), so
     * selling the same unit to the same order twice must be a harmless no-op
     * rather than a second sale or an exception.
     */
    public function test_selling_the_same_unit_to_the_same_order_twice_is_idempotent(): void
    {
        $unit = $this->unit();

        $order = $this->order();

        $this->assertTrue($unit->markSold($order->id, $order->reference));
        $this->assertFalse($unit->markSold($order->id, $order->reference));

        $this->assertSame(1, UnitEvent::where('event', UnitEvent::SOLD)->count());
    }

    /** Selling one machine to two different orders must be loud, not silent. */
    public function test_selling_an_already_sold_unit_to_a_different_order_throws(): void
    {
        $unit = $this->unit();
        $first = $this->order();
        $second = $this->order();

        $unit->markSold($first->id, $first->reference);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('already sold');

        $unit->markSold($second->id, $second->reference);
    }

    public function test_a_faulty_unit_cannot_be_sold(): void
    {
        $unit = $this->unit();
        $unit->forceFill(['status' => ProductUnit::STATUS_FAULTY])->save();

        $this->expectException(RuntimeException::class);

        $order = $this->order();
        $unit->markSold($order->id, $order->reference);
    }

    /* ---------------------------------------------------- database guarantees */

    public function test_the_database_refuses_a_reservation_with_no_expiry(): void
    {
        $unit = $this->unit();

        $this->expectException(QueryException::class);

        // A null expiry is invisible to the sweeper, so the machine would be
        // held forever by an order nobody paid for.
        $unit->forceFill([
            'status' => ProductUnit::STATUS_RESERVED,
            'reserved_until' => null,
        ])->save();
    }

    public function test_the_database_refuses_a_stale_expiry_on_an_available_unit(): void
    {
        $unit = $this->unit();

        $this->expectException(QueryException::class);

        $unit->forceFill([
            'status' => ProductUnit::STATUS_AVAILABLE,
            'reserved_until' => now()->addDay(),
        ])->save();
    }

    public function test_the_database_refuses_a_sold_unit_with_no_order(): void
    {
        $unit = $this->unit();

        $this->expectException(QueryException::class);

        $unit->forceFill([
            'status' => ProductUnit::STATUS_SOLD,
            'order_id' => null,
        ])->save();
    }

    public function test_the_database_refuses_an_unknown_condition(): void
    {
        $this->expectException(QueryException::class);

        $this->unit(['condition' => 'slightly-haunted']);
    }

    public function test_the_database_refuses_an_unknown_status(): void
    {
        $unit = $this->unit();

        $this->expectException(QueryException::class);

        $unit->forceFill(['status' => 'vanished'])->save();
    }

    /* -------------------------------------------------------- derived values */

    public function test_display_price_is_the_cheapest_available_machine(): void
    {
        $product = Product::factory()->create();

        ProductUnit::factory()->for($product)->create(['price' => 800_000]);
        ProductUnit::factory()->for($product)->create(['price' => 620_000]);
        ProductUnit::factory()->for($product)->create(['price' => 700_000]);

        $this->assertSame(620_000, $product->displayPrice());
        $this->assertSame(3, $product->availableCount());
    }

    /** A sold machine must stop influencing the "from" price on the card. */
    public function test_a_sold_unit_stops_counting_towards_price_and_availability(): void
    {
        $product = Product::factory()->create();

        $cheap = ProductUnit::factory()->for($product)->create(['price' => 620_000]);
        ProductUnit::factory()->for($product)->create(['price' => 800_000]);

        $order = $this->order();
        $cheap->markSold($order->id, $order->reference);

        $this->assertSame(800_000, $product->fresh()->displayPrice());
        $this->assertSame(1, $product->fresh()->availableCount());
    }

    /** A reserved machine is mid-checkout with someone else. */
    public function test_a_reserved_unit_is_not_available(): void
    {
        $product = Product::factory()->create();
        $unit = ProductUnit::factory()->for($product)->create(['price' => 620_000]);

        $order = $this->order();
        $unit->reserveFor($order->id, $order->reference, now()->addDay());

        $this->assertSame(0, $product->fresh()->availableCount());
        $this->assertNull($product->fresh()->displayPrice());
    }

    public function test_serial_and_imei_are_encrypted_at_rest(): void
    {
        $unit = $this->unit(['serial' => 'SN-VISIBLE-12345', 'imei' => '350000000000001']);

        $raw = \DB::table('product_units')->where('id', $unit->id)->first();

        $this->assertNotSame('SN-VISIBLE-12345', $raw->serial);
        $this->assertStringNotContainsString('SN-VISIBLE', $raw->serial);
        $this->assertSame('SN-VISIBLE-12345', $unit->fresh()->serial);
        $this->assertSame('350000000000001', $unit->fresh()->imei);
    }
}
