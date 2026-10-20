<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\StockMovement;
use App\Models\UnitEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Inventory management.
 *
 * The permission split is the thing under test as much as the behaviour:
 * receiving a shipment and deciding what it sells for are different kinds of
 * trust, and `inventory.manage` must not imply `catalogue.manage`.
 */
class BackofficeInventoryTest extends TestCase
{
    use RefreshDatabase;

    private function laptopListing(): Product
    {
        return Product::factory()->create(['slug' => 'elitebook', 'name' => 'HP EliteBook']);
    }

    /* --------------------------------------------------------------- access */

    public function test_sales_can_see_stock_but_not_move_it(): void
    {
        $product = Product::factory()->stocked(stock: 10, price: 22_000)->create();
        $sales = $this->sales();

        $this->actingAs($sales)->getJson('/api/inventory')->assertOk();

        $this->forgetAuth();

        $this->actingAs($sales)
            ->postJson("/api/inventory/{$product->slug}/stock-movements", [
                'delta' => 5,
                'reason' => 'restock',
            ])
            ->assertStatus(403);
    }

    public function test_an_anonymous_request_is_rejected(): void
    {
        $this->getJson('/api/inventory')
            ->assertStatus(401)
            ->assertJsonPath('message', 'Unauthenticated.');
    }

    /* ------------------------------------------------------------- listing */

    /**
     * The storefront hides sold-out listings. The backoffice must NOT — the
     * thing that has run out is exactly what staff came to look at.
     */
    public function test_the_inventory_list_includes_sold_out_and_inactive_listings(): void
    {
        $gone = $this->laptopListing();
        $order = Order::factory()->create();
        ProductUnit::factory()->for($gone)->create()->markSold($order->id, $order->reference);

        Product::factory()->create(['slug' => 'hidden', 'is_active' => false]);

        $slugs = collect($this->actingAs($this->manager())->getJson('/api/inventory')->json('data'))
            ->pluck('slug');

        $this->assertTrue($slugs->contains('elitebook'));
        $this->assertTrue($slugs->contains('hidden'));
    }

    public function test_low_stock_filter(): void
    {
        Product::factory()->stocked(stock: 2, price: 10_000)->create([
            'slug' => 'nearly-out',
            'low_stock_threshold' => 5,
        ]);
        Product::factory()->stocked(stock: 40, price: 10_000)->create([
            'slug' => 'plenty',
            'low_stock_threshold' => 5,
        ]);

        $slugs = collect(
            $this->actingAs($this->manager())
                ->getJson('/api/inventory?low_stock=1')
                ->json('data'),
        )->pluck('slug');

        $this->assertTrue($slugs->contains('nearly-out'));
        $this->assertFalse($slugs->contains('plenty'));
    }

    /* --------------------------------------------------------------- intake */

    public function test_bulk_intake_creates_units_and_their_first_event(): void
    {
        $product = $this->laptopListing();

        $response = $this->actingAs($this->manager())
            ->postJson("/api/inventory/{$product->slug}/units", [
                'units' => [
                    [
                        'sku' => 'GG-EB840-101',
                        'serial' => 'SN-AAA-111',
                        'condition' => 'foreign_used',
                        'grade' => 'A',
                        'price' => 620_000,
                        'cost' => 470_000,
                        'specs' => ['cpu' => 'Core i7', 'ram_gb' => 16, 'storage_gb' => 512],
                    ],
                    [
                        'sku' => 'GG-EB840-102',
                        'condition' => 'foreign_used',
                        'grade' => 'B',
                        'price' => 545_000,
                    ],
                ],
            ]);

        $response->assertCreated()->assertJsonPath('meta.created', 2);

        $this->assertSame(2, $product->units()->count());
        $this->assertSame(
            2,
            UnitEvent::where('event', UnitEvent::ACQUIRED)->count(),
            'Every machine must enter the ledger on arrival.',
        );
    }

    /**
     * A shipment is entered as a batch. Half a shipment in the database is worse
     * than none, because the shelf and the system then disagree silently.
     */
    public function test_a_duplicate_sku_rejects_the_whole_batch(): void
    {
        $product = $this->laptopListing();
        ProductUnit::factory()->for($product)->create(['sku' => 'GG-DUPE']);

        $this->actingAs($this->manager())
            ->postJson("/api/inventory/{$product->slug}/units", [
                'units' => [
                    ['sku' => 'GG-NEW-1', 'condition' => 'foreign_used', 'price' => 500_000],
                    ['sku' => 'GG-DUPE', 'condition' => 'foreign_used', 'price' => 600_000],
                ],
            ])
            ->assertStatus(422);

        // The good row must not have landed either.
        $this->assertSame(0, ProductUnit::where('sku', 'GG-NEW-1')->count());
    }

    public function test_the_same_sku_twice_in_one_batch_is_rejected(): void
    {
        $product = $this->laptopListing();

        $this->actingAs($this->manager())
            ->postJson("/api/inventory/{$product->slug}/units", [
                'units' => [
                    ['sku' => 'GG-SAME', 'condition' => 'new', 'price' => 500_000],
                    ['sku' => 'GG-SAME', 'condition' => 'new', 'price' => 500_000],
                ],
            ])
            ->assertStatus(422);
    }

    public function test_units_cannot_be_added_to_a_quantity_tracked_product(): void
    {
        $charger = Product::factory()->stocked(stock: 5, price: 22_000)->create();

        $this->actingAs($this->manager())
            ->postJson("/api/inventory/{$charger->slug}/units", [
                'units' => [['sku' => 'GG-X', 'condition' => 'new', 'price' => 1_000]],
            ])
            ->assertStatus(422);
    }

    /* ---------------------------------------------------------- unit editing */

    public function test_a_unit_can_be_corrected_and_the_edit_is_recorded(): void
    {
        $unit = ProductUnit::factory()->for($this->laptopListing())->create([
            'sku' => 'GG-FIX-1',
            'price' => 600_000,
        ]);

        $this->actingAs($this->manager())
            ->patchJson('/api/inventory/units/GG-FIX-1', ['price' => 575_000, 'grade' => 'B'])
            ->assertOk()
            ->assertJsonPath('data.price', 575_000);

        $this->assertDatabaseHas('unit_events', [
            'product_unit_id' => $unit->id,
            'event' => UnitEvent::CORRECTED,
        ]);
    }

    /** A sold machine's record is evidence of what somebody bought. */
    public function test_a_sold_unit_cannot_be_edited(): void
    {
        $order = Order::factory()->create();
        $unit = ProductUnit::factory()->for($this->laptopListing())->create(['sku' => 'GG-SOLD-1']);
        $unit->markSold($order->id, $order->reference);

        $this->actingAs($this->manager())
            ->patchJson('/api/inventory/units/GG-SOLD-1', ['price' => 1])
            ->assertStatus(422);

        $this->assertNotSame(1, (int) $unit->fresh()->price);
    }

    /** Status is a consequence of orders, never a form field. */
    public function test_a_unit_status_cannot_be_set_through_the_edit_endpoint(): void
    {
        ProductUnit::factory()->for($this->laptopListing())->create(['sku' => 'GG-ST-1']);

        $this->actingAs($this->manager())
            ->patchJson('/api/inventory/units/GG-ST-1', ['status' => 'sold', 'price' => 500_000])
            ->assertOk();

        $this->assertSame(
            ProductUnit::STATUS_AVAILABLE,
            ProductUnit::where('sku', 'GG-ST-1')->first()->status,
        );
    }

    /* -------------------------------------------------------------- movements */

    public function test_a_restock_moves_stock_and_records_who_did_it(): void
    {
        $product = Product::factory()->stocked(stock: 10, price: 22_000)->create();
        $manager = $this->manager();

        $this->actingAs($manager)
            ->postJson("/api/inventory/{$product->slug}/stock-movements", [
                'delta' => 12,
                'reason' => 'restock',
                'note' => 'Tuesday delivery',
            ])
            ->assertCreated()
            ->assertJsonPath('data.stock_before', 10)
            ->assertJsonPath('data.stock_after', 22);

        $this->assertSame(22, (int) $product->fresh()->stock);
        $this->assertSame($manager->id, (int) StockMovement::first()->user_id);
    }

    public function test_a_stock_take_is_recorded_as_the_delta_it_implies(): void
    {
        $product = Product::factory()->stocked(stock: 10, price: 22_000)->create();

        $this->actingAs($this->manager())
            ->postJson("/api/inventory/{$product->slug}/stock-movements", [
                'stock' => 7,
                'reason' => 'correction',
                'note' => 'Counted the shelf',
            ])
            ->assertCreated()
            ->assertJsonPath('data.delta', -3);
    }

    /** `restock: -4` is a typo, not a restock. */
    public function test_a_reason_that_disagrees_with_the_sign_is_refused(): void
    {
        $product = Product::factory()->stocked(stock: 10, price: 22_000)->create();

        $this->actingAs($this->manager())
            ->postJson("/api/inventory/{$product->slug}/stock-movements", [
                'delta' => -4,
                'reason' => 'restock',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['reason']);

        $this->assertSame(10, (int) $product->fresh()->stock);
    }

    public function test_passing_both_a_delta_and_a_count_is_refused(): void
    {
        $product = Product::factory()->stocked(stock: 10, price: 22_000)->create();

        $this->actingAs($this->manager())
            ->postJson("/api/inventory/{$product->slug}/stock-movements", [
                'delta' => 5,
                'stock' => 20,
                'reason' => 'correction',
            ])
            ->assertStatus(422);
    }

    public function test_stock_cannot_be_driven_negative(): void
    {
        $product = Product::factory()->stocked(stock: 3, price: 22_000)->create();

        $this->actingAs($this->manager())
            ->postJson("/api/inventory/{$product->slug}/stock-movements", [
                'delta' => -5,
                'reason' => 'damage',
            ])
            ->assertStatus(422);

        $this->assertSame(3, (int) $product->fresh()->stock);
    }

    public function test_the_ledger_reads_newest_first_and_names_who_moved_it(): void
    {
        $product = Product::factory()->stocked(stock: 0, price: 22_000)->create();
        $manager = $this->manager(['name' => 'Shop Manager']);

        foreach ([5, 7] as $delta) {
            $this->actingAs($manager)->postJson(
                "/api/inventory/{$product->slug}/stock-movements",
                ['delta' => $delta, 'reason' => 'restock'],
            )->assertCreated();
        }

        $movements = $this->actingAs($manager)
            ->getJson('/api/inventory/movements')
            ->assertOk()
            ->json('data');

        $this->assertCount(2, $movements);
        $this->assertSame(7, $movements[0]['delta'], 'Newest first.');
        $this->assertSame('Shop Manager', $movements[0]['user']);
    }

    /* ----------------------------------------------------------------- margin */

    /**
     * `cost` is what the business paid. A manager moves stock without seeing it;
     * only `reports.view` does.
     */
    public function test_a_manager_cannot_see_unit_cost(): void
    {
        $product = $this->laptopListing();
        ProductUnit::factory()->for($product)->create(['sku' => 'GG-C-1', 'cost' => 470_000]);

        $units = $this->actingAs($this->manager())
            ->getJson("/api/inventory/{$product->slug}/units")
            ->assertOk()
            ->json('data');

        $this->assertNull($units[0]['cost']);
    }

    public function test_an_owner_can_see_unit_cost(): void
    {
        $product = $this->laptopListing();
        ProductUnit::factory()->for($product)->create(['sku' => 'GG-C-2', 'cost' => 470_000]);

        $units = $this->actingAs($this->owner())
            ->getJson("/api/inventory/{$product->slug}/units")
            ->assertOk()
            ->json('data');

        $this->assertSame(470_000, $units[0]['cost']);
    }

    /** Staff legitimately need the serial; the storefront never does. */
    public function test_staff_see_the_serial_that_the_storefront_does_not(): void
    {
        $product = $this->laptopListing();
        ProductUnit::factory()->for($product)->create([
            'sku' => 'GG-S-1',
            'serial' => 'SN-VISIBLE-TO-STAFF',
        ]);

        $units = $this->actingAs($this->manager())
            ->getJson("/api/inventory/{$product->slug}/units")
            ->json('data');

        $this->assertSame('SN-VISIBLE-TO-STAFF', $units[0]['serial']);
    }

    /* --------------------------------------------------------------- deletion */

    public function test_a_manager_can_delete_a_product(): void
    {
        $product = $this->laptopListing();
        ProductUnit::factory()->for($product)->create(['sku' => 'GG-DEL-1', 'status' => ProductUnit::STATUS_AVAILABLE]);

        $this->actingAs($this->manager())
            ->deleteJson("/api/inventory/{$product->slug}")
            ->assertOk()
            ->assertJsonPath('message', "Product '{$product->name}' deleted successfully.");

        $this->assertSoftDeleted('products', ['id' => $product->id]);
        $this->assertDatabaseMissing('product_units', ['sku' => 'GG-DEL-1']);
    }

    public function test_cannot_delete_a_product_with_active_reserved_units(): void
    {
        $product = $this->laptopListing();
        ProductUnit::factory()->for($product)->create([
            'sku' => 'GG-DEL-RES',
            'status' => ProductUnit::STATUS_RESERVED,
            'reserved_until' => now()->addHour(),
        ]);

        $this->actingAs($this->manager())
            ->deleteJson("/api/inventory/{$product->slug}")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['product']);

        $this->assertDatabaseHas('products', ['id' => $product->id, 'deleted_at' => null]);
    }

    public function test_sales_without_inventory_manage_cannot_delete_product(): void
    {
        $product = $this->laptopListing();

        $this->actingAs($this->sales())
            ->deleteJson("/api/inventory/{$product->slug}")
            ->assertStatus(403);

        $this->assertDatabaseHas('products', ['id' => $product->id, 'deleted_at' => null]);
    }

    public function test_a_manager_can_delete_an_available_unit(): void
    {
        $product = $this->laptopListing();
        $unit = ProductUnit::factory()->for($product)->create(['sku' => 'GG-UNIT-DEL', 'status' => ProductUnit::STATUS_AVAILABLE]);

        $this->actingAs($this->manager())
            ->deleteJson("/api/inventory/units/{$unit->sku}")
            ->assertOk()
            ->assertJsonPath('message', "Machine unit '{$unit->sku}' deleted successfully.");

        $this->assertDatabaseMissing('product_units', ['sku' => $unit->sku]);
    }

    public function test_cannot_delete_a_sold_unit(): void
    {
        $product = $this->laptopListing();
        $order = Order::factory()->create();
        $unit = ProductUnit::factory()->for($product)->create(['sku' => 'GG-UNIT-SOLD']);
        $unit->markSold($order->id, $order->reference);

        $this->actingAs($this->manager())
            ->deleteJson("/api/inventory/units/{$unit->sku}")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['unit']);

        $this->assertDatabaseHas('product_units', ['sku' => $unit->sku]);
    }
}
