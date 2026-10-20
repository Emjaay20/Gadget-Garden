<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\StockMovement;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

/**
 * The stock ledger's invariants — the ones that make "who took twelve chargers
 * off the shelf, and why" answerable.
 *
 * Several of these assert the DATABASE refuses a bad write, not just the model.
 * That distinction is the point: application code can be bypassed by a console
 * session, a future job, or a migration, and the ledger has to hold anyway.
 */
class StockLedgerTest extends TestCase
{
    use RefreshDatabase;

    private function stocked(int $stock = 10): Product
    {
        return Product::factory()->stocked(stock: $stock)->create();
    }

    public function test_a_movement_records_before_and_after(): void
    {
        $product = $this->stocked(10);

        $movement = $product->recordStockMovement([
            'delta' => 5,
            'reason' => StockMovement::RESTOCK,
        ]);

        $this->assertSame(10, $movement->stock_before);
        $this->assertSame(15, $movement->stock_after);
        $this->assertSame(15, (int) $product->fresh()->stock);
    }

    public function test_an_absolute_count_is_recorded_as_the_delta_it_implies(): void
    {
        $product = $this->stocked(10);

        // A physical stock-take found 7.
        $movement = $product->recordStockMovement([
            'stock' => 7,
            'reason' => StockMovement::CORRECTION,
        ]);

        $this->assertSame(-3, $movement->delta);
        $this->assertSame(10, $movement->stock_before);
        $this->assertSame(7, $movement->stock_after);
    }

    public function test_passing_both_delta_and_absolute_stock_is_refused(): void
    {
        $this->expectException(RuntimeException::class);

        $this->stocked()->recordStockMovement([
            'delta' => 5,
            'stock' => 20,
            'reason' => StockMovement::RESTOCK,
        ]);
    }

    public function test_passing_neither_is_refused(): void
    {
        $this->expectException(RuntimeException::class);

        $this->stocked()->recordStockMovement(['reason' => StockMovement::RESTOCK]);
    }

    public function test_a_zero_delta_movement_is_refused(): void
    {
        $this->expectException(RuntimeException::class);

        $this->stocked(10)->recordStockMovement([
            'stock' => 10, // no change
            'reason' => StockMovement::CORRECTION,
        ]);
    }

    public function test_stock_cannot_go_negative(): void
    {
        $product = $this->stocked(3);

        $this->expectException(RuntimeException::class);

        $product->recordStockMovement([
            'delta' => -4,
            'reason' => StockMovement::SALE,
        ]);
    }

    public function test_a_failed_movement_leaves_the_stock_untouched(): void
    {
        $product = $this->stocked(3);

        try {
            $product->recordStockMovement([
                'delta' => -4,
                'reason' => StockMovement::SALE,
            ]);
        } catch (RuntimeException) {
            // expected
        }

        $this->assertSame(3, (int) $product->fresh()->stock);
        $this->assertSame(0, StockMovement::count());
    }

    /**
     * The database, not the model. A row whose arithmetic does not add up must
     * be impossible to write by ANY path.
     */
    public function test_the_database_refuses_a_row_whose_arithmetic_is_wrong(): void
    {
        $product = $this->stocked(10);

        $this->expectException(QueryException::class);

        StockMovement::create([
            'product_id' => $product->id,
            'delta' => 5,
            'stock_before' => 10,
            'stock_after' => 99, // should be 15
            'reason' => StockMovement::RESTOCK,
        ]);
    }

    public function test_the_database_refuses_a_zero_delta_row(): void
    {
        $product = $this->stocked(10);

        $this->expectException(QueryException::class);

        StockMovement::create([
            'product_id' => $product->id,
            'delta' => 0,
            'stock_before' => 10,
            'stock_after' => 10,
            'reason' => StockMovement::CORRECTION,
        ]);
    }

    public function test_the_database_refuses_an_unknown_reason(): void
    {
        $product = $this->stocked(10);

        $this->expectException(QueryException::class);

        StockMovement::create([
            'product_id' => $product->id,
            'delta' => 1,
            'stock_before' => 10,
            'stock_after' => 11,
            'reason' => 'shrinkage',
        ]);
    }

    /**
     * `restock: -4` is a typo, not a restock. Directionality is what keeps the
     * ledger readable as a story rather than a pile of signed integers.
     */
    public function test_reason_directions(): void
    {
        $this->assertTrue(StockMovement::signMatchesReason(5, StockMovement::RESTOCK));
        $this->assertFalse(StockMovement::signMatchesReason(-5, StockMovement::RESTOCK));

        $this->assertTrue(StockMovement::signMatchesReason(-2, StockMovement::SALE));
        $this->assertFalse(StockMovement::signMatchesReason(2, StockMovement::SALE));

        // A correction may go either way — that is what makes it a correction.
        $this->assertTrue(StockMovement::signMatchesReason(3, StockMovement::CORRECTION));
        $this->assertTrue(StockMovement::signMatchesReason(-3, StockMovement::CORRECTION));
    }

    public function test_a_unit_product_refuses_quantity_movements(): void
    {
        $product = Product::factory()->create(); // unit kind by default

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('unit-tracked');

        $product->recordStockMovement([
            'delta' => 5,
            'reason' => StockMovement::RESTOCK,
        ]);
    }

    /**
     * The kind/price/stock CHECK constraint: a stocked product must carry both,
     * a unit listing neither. Otherwise a laptop's real price sits on its units
     * while a stale number sits on the product and wins.
     */
    public function test_a_stocked_product_cannot_exist_without_a_price(): void
    {
        $this->expectException(QueryException::class);

        $product = Product::factory()->make(['kind' => Product::KIND_STOCKED]);
        $product->forceFill(['price' => null, 'stock' => 5]);
        $product->save();
    }

    public function test_a_unit_product_cannot_carry_its_own_price(): void
    {
        $this->expectException(QueryException::class);

        $product = Product::factory()->make(['kind' => Product::KIND_UNIT]);
        $product->forceFill(['price' => 500_000, 'stock' => null]);
        $product->save();
    }

    public function test_a_compare_at_price_below_the_price_is_refused(): void
    {
        $this->expectException(QueryException::class);

        Product::factory()->stocked(price: 100_000)->create([
            'compare_at_price' => 90_000,
        ]);
    }
}
