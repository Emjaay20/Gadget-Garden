<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductUnit;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Sales reporting.
 *
 * The failure modes here are quiet ones: a number that looks plausible and is
 * wrong. Most of these tests exist to pin down what is deliberately EXCLUDED.
 */
class ReportsTest extends TestCase
{
    use RefreshDatabase;

    private function paidOrder(int $total, ?string $paidAt = null): Order
    {
        $order = Order::factory()->create([
            'subtotal' => $total,
            'delivery_fee' => 0,
            'total' => $total,
        ]);

        $order->forceFill([
            'status' => Order::PAID,
            'paid_at' => $paidAt ? Carbon::parse($paidAt) : now(),
            'reserved_until' => null,
        ])->save();

        return $order->fresh();
    }

    private function lineOn(Order $order, ProductUnit $unit, int $price): void
    {
        $order->items()->create([
            'product_id' => $unit->product_id,
            'product_unit_id' => $unit->id,
            'name_at_time' => $unit->product->name,
            'sku_at_time' => $unit->sku,
            'unit_price_at_time' => $price,
            'quantity' => 1,
            'line_total' => $price,
        ]);
    }

    /* --------------------------------------------------------------- access */

    public function test_margin_reporting_is_owner_only(): void
    {
        $this->actingAs($this->manager())->getJson('/api/reports')->assertStatus(403);

        $this->forgetAuth();

        $this->actingAs($this->sales())->getJson('/api/reports')->assertStatus(403);

        $this->forgetAuth();

        $this->actingAs($this->owner())->getJson('/api/reports')->assertOk();
    }

    /* -------------------------------------------------------------- revenue */

    public function test_revenue_counts_only_orders_that_were_paid(): void
    {
        $this->paidOrder(620_000);

        // Unpaid. Subtotal and fee must add up to the total — the database
        // refuses anything else, which is the point of that constraint.
        Order::factory()->create([
            'subtotal' => 999_999,
            'delivery_fee' => 0,
            'total' => 999_999,
        ]);

        $summary = $this->actingAs($this->owner())
            ->getJson('/api/reports')
            ->json('data.summary.current');

        $this->assertSame(620_000, $summary['revenue']);
        $this->assertSame(1, $summary['orders']);
    }

    /**
     * A refunded order keeps its `paid_at`, so filtering on the timestamp alone
     * would count money that was given back.
     */
    public function test_a_refunded_order_is_excluded_from_revenue(): void
    {
        $kept = $this->paidOrder(620_000);
        $refunded = $this->paidOrder(500_000);
        $refunded->forceFill(['status' => Order::CANCELLED])->save();

        $summary = $this->actingAs($this->owner())
            ->getJson('/api/reports')
            ->json('data.summary.current');

        $this->assertSame(620_000, $summary['revenue']);
        $this->assertNotNull($kept);
    }

    /**
     * Revenue is dated by when the MONEY arrived, not when the order was placed
     * — that is what reconciles against a bank statement.
     */
    public function test_revenue_is_dated_by_payment_not_by_placement(): void
    {
        $order = $this->paidOrder(620_000, now()->subDays(2)->toDateTimeString());
        $order->forceFill(['placed_at' => now()->subDays(40)])->save();

        $summary = $this->actingAs($this->owner())
            ->getJson('/api/reports')
            ->json('data.summary.current');

        // Placed outside the 30-day window, paid inside it: it counts.
        $this->assertSame(620_000, $summary['revenue']);
    }

    public function test_a_custom_range_is_respected(): void
    {
        $this->paidOrder(100_000, now()->subDays(90)->toDateTimeString());
        $this->paidOrder(200_000, now()->subDay()->toDateTimeString());

        $recent = $this->actingAs($this->owner())
            ->getJson('/api/reports')
            ->json('data.summary.current.revenue');

        $this->assertSame(200_000, $recent);

        $this->forgetAuth();

        $wide = $this->actingAs($this->owner())
            ->getJson('/api/reports?from='.now()->subDays(120)->toDateString())
            ->json('data.summary.current.revenue');

        $this->assertSame(300_000, $wide);
    }

    /* -------------------------------------------------------------- margin */

    public function test_margin_is_revenue_minus_what_the_machines_cost(): void
    {
        $unit = ProductUnit::factory()
            ->for(Product::factory())
            ->create(['price' => 620_000, 'cost' => 470_000]);

        $order = $this->paidOrder(620_000);
        $this->lineOn($order, $unit, 620_000);

        $summary = $this->actingAs($this->owner())
            ->getJson('/api/reports')
            ->json('data.summary.current');

        $this->assertSame(150_000, $summary['margin']);
        $this->assertSame(620_000, $summary['cost_known_revenue']);
    }

    /**
     * Accessories carry no cost, so counting them would report their full price
     * as profit — a number that reads plausible and is completely wrong.
     */
    public function test_lines_without_a_known_cost_are_left_out_of_margin(): void
    {
        $unit = ProductUnit::factory()
            ->for(Product::factory())
            ->create(['price' => 620_000, 'cost' => 470_000]);

        $charger = Product::factory()->stocked(stock: 10, price: 22_000)->create();

        $order = $this->paidOrder(642_000);
        $this->lineOn($order, $unit, 620_000);
        $order->items()->create([
            'product_id' => $charger->id,
            'name_at_time' => $charger->name,
            'unit_price_at_time' => 22_000,
            'quantity' => 1,
            'line_total' => 22_000,
        ]);

        $summary = $this->actingAs($this->owner())
            ->getJson('/api/reports')
            ->json('data.summary.current');

        $this->assertSame(150_000, $summary['margin'], 'The charger must not inflate margin.');
        // And the UI can tell it only covers part of the revenue.
        $this->assertSame(620_000, $summary['cost_known_revenue']);
        $this->assertSame(642_000, $summary['revenue']);
    }

    /* -------------------------------------------------------------- series */

    /**
     * A series that skips empty days draws a chart that lies — the line runs
     * straight from Monday to Thursday and reads as continuous trade.
     */
    public function test_every_day_in_the_range_appears_even_when_empty(): void
    {
        $this->paidOrder(620_000, now()->subDays(3)->toDateTimeString());

        $series = $this->actingAs($this->owner())
            ->getJson('/api/reports?from='.now()->subDays(6)->toDateString())
            ->json('data.revenue_by_day');

        $this->assertCount(7, $series);
        $this->assertSame(1, collect($series)->where('revenue', '>', 0)->count());
        $this->assertSame(6, collect($series)->where('revenue', 0)->count());
    }

    public function test_the_previous_period_is_returned_for_comparison(): void
    {
        $this->paidOrder(200_000, now()->subDays(2)->toDateTimeString());
        $this->paidOrder(100_000, now()->subDays(35)->toDateTimeString());

        $summary = $this->actingAs($this->owner())
            ->getJson('/api/reports')
            ->json('data.summary');

        $this->assertSame(200_000, $summary['current']['revenue']);
        $this->assertSame(100_000, $summary['previous']['revenue']);
        $this->assertSame(100, $summary['change']['revenue']);
    }

    /** "Up 100%" from nothing is noise, not information. */
    public function test_change_is_null_when_there_is_no_baseline(): void
    {
        $this->paidOrder(200_000);

        $change = $this->actingAs($this->owner())
            ->getJson('/api/reports')
            ->json('data.summary.change.revenue');

        $this->assertNull($change);
    }

    /* --------------------------------------------------------------- brands */

    public function test_brands_are_ranked_by_revenue(): void
    {
        foreach ([['HP', 620_000], ['Dell', 900_000]] as [$brand, $price]) {
            $unit = ProductUnit::factory()
                ->for(Product::factory()->create(['brand' => $brand]))
                ->create(['price' => $price]);

            $order = $this->paidOrder($price);
            $this->lineOn($order, $unit, $price);
        }

        $brands = $this->actingAs($this->owner())
            ->getJson('/api/reports')
            ->json('data.top_brands');

        $this->assertSame('Dell', $brands[0]['brand']);
        $this->assertSame(900_000, $brands[0]['revenue']);
    }

    /* ---------------------------------------------------------- ageing stock */

    /**
     * The number that matters most for used hardware: capital sitting on a shelf
     * depreciating, in machines that cannot simply be reordered.
     */
    public function test_available_stock_is_bucketed_by_age(): void
    {
        $product = Product::factory()->create();

        $fresh = ProductUnit::factory()->for($product)->create(['price' => 500_000]);
        $stale = ProductUnit::factory()->for($product)->create(['price' => 800_000]);
        $stale->forceFill(['created_at' => now()->subDays(120)])->save();

        $ageing = $this->actingAs($this->owner())
            ->getJson('/api/reports')
            ->json('data.ageing_stock');

        $buckets = collect($ageing['buckets'])->keyBy('label');

        $this->assertSame(1, $buckets['0–30 days']['units']);
        $this->assertSame(1, $buckets['Over 90 days']['units']);
        $this->assertSame(800_000, $buckets['Over 90 days']['value']);
        $this->assertSame(1_300_000, $ageing['total_value']);
        $this->assertNotNull($fresh);
    }

    public function test_sold_machines_are_not_counted_as_ageing_stock(): void
    {
        $unit = ProductUnit::factory()->for(Product::factory())->create(['price' => 500_000]);
        $order = $this->paidOrder(500_000);
        $unit->markSold($order->id, $order->reference);

        $ageing = $this->actingAs($this->owner())
            ->getJson('/api/reports')
            ->json('data.ageing_stock');

        $this->assertSame(0, $ageing['total_units']);
    }

    public function test_the_oldest_machines_are_named_so_the_number_is_actionable(): void
    {
        $unit = ProductUnit::factory()
            ->for(Product::factory()->create(['name' => 'Ancient ThinkPad']))
            ->create(['sku' => 'GG-OLD-1', 'price' => 700_000]);

        $unit->forceFill(['created_at' => now()->subDays(200)])->save();

        $oldest = $this->actingAs($this->owner())
            ->getJson('/api/reports')
            ->json('data.ageing_stock.oldest');

        $this->assertSame('GG-OLD-1', $oldest[0]['sku']);
        $this->assertSame('Ancient ThinkPad', $oldest[0]['name']);
        $this->assertGreaterThanOrEqual(200, $oldest[0]['days']);
    }
}
