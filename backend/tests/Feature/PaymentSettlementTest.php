<?php

namespace Tests\Feature;

use App\Models\DeliveryZone;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\StockMovement;
use App\Models\UnitEvent;
use App\Payments\MockLedger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Settlement, driven end to end through the mock gateway.
 *
 * The guarantees under test are the ones that cost money when they break:
 * settlement happens at most once however many times it is triggered, goods move
 * only on payment, and an underpayment ships nothing.
 */
class PaymentSettlementTest extends TestCase
{
    use RefreshDatabase;

    private DeliveryZone $zone;

    protected function setUp(): void
    {
        parent::setUp();

        config(['shop.provider' => 'mock']);

        $this->zone = DeliveryZone::factory()->create([
            'slug' => 'lagos-mainland',
            'fee' => 3_500,
            'free_above' => 500_000,
        ]);
    }

    /* ------------------------------------------------------------- helpers */

    private function laptop(int $price = 620_000): ProductUnit
    {
        return ProductUnit::factory()
            ->for(Product::factory()->create())
            ->create(['price' => $price]);
    }

    private function placeOrder(array $items): Order
    {
        $reference = $this->postJson('/api/shop/orders', [
            'items' => $items,
            'contact' => [
                'name' => 'Ada Obi',
                'email' => 'ada@example.test',
                'phone' => '08056947271',
            ],
            'delivery_zone' => $this->zone->slug,
            'address' => ['line1' => '12 Oshitelu Street', 'city' => 'Ikeja', 'state' => 'Lagos'],
        ])->assertCreated()->json('data.reference');

        return Order::where('reference', $reference)->firstOrFail();
    }

    private function initialize(Order $order): array
    {
        return $this->postJson('/api/shop/payments/initialize', [
            'reference' => $order->reference,
        ])->assertOk()->json('data');
    }

    private function verify(Order $order): array
    {
        return $this->postJson('/api/shop/payments/verify', [
            'reference' => $order->reference,
        ])->assertOk()->json('data');
    }

    /* -------------------------------------------------------- initialisation */

    public function test_initialising_mints_a_virtual_account(): void
    {
        $order = $this->placeOrder([['product_unit_id' => $this->laptop()->id]]);

        $instruction = $this->initialize($order);

        $this->assertNotEmpty($instruction['account_number']);
        $this->assertSame(620_000, $instruction['amount']);
        $this->assertSame('NGN', $instruction['currency']);
        $this->assertSame('mock', $instruction['provider']);
        $this->assertNotNull($instruction['expires_at']);
    }

    /**
     * A customer who reloads the pay page must not end up with two account
     * numbers and no idea which one to send money to.
     */
    public function test_re_initialising_returns_the_same_account(): void
    {
        $order = $this->placeOrder([['product_unit_id' => $this->laptop()->id]]);

        $first = $this->initialize($order);
        $second = $this->initialize($order);

        $this->assertSame($first['account_number'], $second['account_number']);
        $this->assertSame(1, $order->payments()->count());
    }

    public function test_the_currency_reaches_the_provider(): void
    {
        // Regression: Eloquent does not read database defaults back, so a freshly
        // created order used to carry a null currency in memory.
        $order = $this->placeOrder([['product_unit_id' => $this->laptop()->id]]);

        $this->assertSame('NGN', $order->currency);
        $this->assertSame('NGN', $this->initialize($order)['currency']);
    }

    public function test_an_already_paid_order_is_not_re_initialised(): void
    {
        $order = $this->placeOrder([['product_unit_id' => $this->laptop()->id]]);
        $this->initialize($order);
        $this->settleInProvider($order);
        $this->verify($order);

        $response = $this->initialize($order->fresh());

        $this->assertSame(Order::PAID, $response['status']);
        $this->assertArrayNotHasKey('account_number', $response);
    }

    /* -------------------------------------------------------------- settling */

    public function test_paying_marks_the_machine_sold(): void
    {
        $unit = $this->laptop();
        $order = $this->placeOrder([['product_unit_id' => $unit->id]]);
        $this->initialize($order);

        $this->assertSame(ProductUnit::STATUS_RESERVED, $unit->fresh()->status);

        $this->settleInProvider($order);
        $result = $this->verify($order);

        $this->assertSame(Order::PAID, $result['status']);

        $unit->refresh();
        $this->assertSame(ProductUnit::STATUS_SOLD, $unit->status);
        $this->assertSame($order->id, (int) $unit->order_id);
        // The hold is over; leaving it set would make a paid order look expired.
        $this->assertNull($unit->reserved_until);
        $this->assertNull($order->fresh()->reserved_until);

        $this->assertDatabaseHas('unit_events', [
            'product_unit_id' => $unit->id,
            'event' => UnitEvent::SOLD,
        ]);
    }

    public function test_paying_decrements_quantity_stock_through_the_ledger(): void
    {
        $product = Product::factory()->stocked(stock: 10, price: 22_000)->create();
        $order = $this->placeOrder([['product_id' => $product->id, 'quantity' => 3]]);
        $this->initialize($order);

        // Nothing has moved yet — quantity stock is not held at checkout.
        $this->assertSame(10, (int) $product->fresh()->stock);

        $this->settleInProvider($order);
        $this->verify($order);

        $this->assertSame(7, (int) $product->fresh()->stock);

        $movement = StockMovement::where('product_id', $product->id)
            ->where('reason', StockMovement::SALE)
            ->firstOrFail();

        $this->assertSame(-3, $movement->delta);
        $this->assertSame(10, $movement->stock_before);
        $this->assertSame(7, $movement->stock_after);
        $this->assertSame($order->id, (int) $movement->order_id);
        // The shop did it, not a staff member.
        $this->assertNull($movement->user_id);
    }

    public function test_a_mixed_order_moves_both_kinds_of_stock(): void
    {
        $unit = $this->laptop();
        $charger = Product::factory()->stocked(stock: 5, price: 22_000)->create();

        $order = $this->placeOrder([
            ['product_unit_id' => $unit->id],
            ['product_id' => $charger->id, 'quantity' => 2],
        ]);

        $this->initialize($order);
        $this->settleInProvider($order);
        $this->verify($order);

        $this->assertSame(ProductUnit::STATUS_SOLD, $unit->fresh()->status);
        $this->assertSame(3, (int) $charger->fresh()->stock);
    }

    /* ----------------------------------------------------------- idempotency */

    /**
     * THE GUARANTEE THAT MATTERS MOST. A webhook may arrive ten times while the
     * browser polls alongside it; goods must move exactly once.
     */
    public function test_settlement_is_idempotent_across_repeated_verifies(): void
    {
        $product = Product::factory()->stocked(stock: 10, price: 22_000)->create();
        $order = $this->placeOrder([['product_id' => $product->id, 'quantity' => 2]]);
        $this->initialize($order);
        $this->settleInProvider($order);

        foreach (range(1, 4) as $ignored) {
            $this->verify($order);
        }

        $this->assertSame(8, (int) $product->fresh()->stock);
        $this->assertSame(
            1,
            StockMovement::where('reason', StockMovement::SALE)->count(),
            'Stock moved more than once.',
        );
    }

    public function test_a_webhook_and_a_poll_together_settle_only_once(): void
    {
        $product = Product::factory()->stocked(stock: 10, price: 22_000)->create();
        $order = $this->placeOrder([['product_id' => $product->id, 'quantity' => 2]]);
        $payment = $order->payments()->create([
            'provider' => 'mock',
            'provider_reference' => $order->reference,
            'amount' => $order->total,
            'account_number' => '1010011220',
        ]);

        $this->settleInProvider($order);

        // The webhook lands…
        $this->postJson('/api/shop/payments/webhook/mock', [
            'reference' => $order->reference,
            'receiving_account' => $payment->account_number,
            'amount' => $order->total,
            'status' => '00',
            'trx' => 'MOCK-TRX-1',
        ])->assertOk();

        // …and the browser polls immediately afterwards.
        $this->verify($order);

        $this->assertSame(Order::PAID, $order->fresh()->status);
        $this->assertSame(8, (int) $product->fresh()->stock);
        $this->assertSame(1, StockMovement::where('reason', StockMovement::SALE)->count());
    }

    /* ------------------------------------------------------------ underpaying */

    /**
     * A virtual account will happily accept ₦500 against a ₦620,000 order.
     * Shipping a laptop on that would be a real loss.
     */
    public function test_an_underpayment_does_not_settle_the_order(): void
    {
        $unit = $this->laptop(620_000);
        $order = $this->placeOrder([['product_unit_id' => $unit->id]]);
        $this->initialize($order);

        // The provider reports a genuine but insufficient transfer.
        MockLedger::settle($order->reference, 'success', 500);

        $result = $this->verify($order);

        $this->assertSame(Order::PENDING_PAYMENT, $result['status']);
        $this->assertSame(ProductUnit::STATUS_RESERVED, $unit->fresh()->status);
        $this->assertStringContainsString('Underpaid', $order->fresh()->staff_note);
    }

    public function test_an_overpayment_settles_normally(): void
    {
        $unit = $this->laptop(620_000);
        $order = $this->placeOrder([['product_unit_id' => $unit->id]]);
        $this->initialize($order);

        MockLedger::settle($order->reference, 'success', 700_000);

        $this->assertSame(Order::PAID, $this->verify($order)['status']);
        $this->assertSame(ProductUnit::STATUS_SOLD, $unit->fresh()->status);
    }

    /* ---------------------------------------------------------------- failing */

    public function test_a_failed_payment_marks_the_order_failed(): void
    {
        $unit = $this->laptop();
        $order = $this->placeOrder([['product_unit_id' => $unit->id]]);
        $this->initialize($order);

        MockLedger::settle($order->reference, 'failed');

        $this->verify($order);

        $this->assertSame(Order::FAILED, $order->fresh()->status);
    }

    /**
     * A failed transfer is very often retried within minutes, so the machine is
     * NOT released immediately — the customer who just tried to pay would
     * otherwise lose it to somebody else.
     */
    public function test_a_failed_payment_keeps_holding_the_machine(): void
    {
        $unit = $this->laptop();
        $order = $this->placeOrder([['product_unit_id' => $unit->id]]);
        $this->initialize($order);

        MockLedger::settle($order->reference, 'failed');
        $this->verify($order);

        $this->assertSame(ProductUnit::STATUS_RESERVED, $unit->fresh()->status);
    }

    /**
     * …but the sweeper MUST still be able to collect it, or one failed payment
     * removes a one-of-a-kind laptop from the catalogue permanently.
     */
    public function test_the_sweeper_releases_a_failed_orders_hold(): void
    {
        $unit = $this->laptop();
        $order = $this->placeOrder([['product_unit_id' => $unit->id]]);
        $this->initialize($order);

        MockLedger::settle($order->reference, 'failed');
        $this->verify($order);

        Order::whereKey($order->id)->update(['reserved_until' => now()->subHour()]);

        $this->artisan('orders:expire-unpaid')->assertSuccessful();

        $this->assertSame(ProductUnit::STATUS_AVAILABLE, $unit->fresh()->status);
        $this->assertSame(Order::CANCELLED, $order->fresh()->status);
    }

    /** A paid order's machine belongs to somebody and must never be released. */
    public function test_the_sweeper_never_touches_a_paid_order(): void
    {
        $unit = $this->laptop();
        $order = $this->placeOrder([['product_unit_id' => $unit->id]]);
        $this->initialize($order);
        $this->settleInProvider($order);
        $this->verify($order);

        // Even with a stale hold forced back on, which should not be possible.
        Order::whereKey($order->id)->update(['reserved_until' => now()->subHour()]);

        $this->artisan('orders:expire-unpaid')->assertSuccessful();

        $this->assertSame(Order::PAID, $order->fresh()->status);
        $this->assertSame(ProductUnit::STATUS_SOLD, $unit->fresh()->status);
    }

    /* ---------------------------------------------------------------- webhook */

    public function test_a_webhook_for_an_unbound_provider_is_acknowledged_but_ignored(): void
    {
        $order = $this->placeOrder([['product_unit_id' => $this->laptop()->id]]);
        $this->initialize($order);
        $this->settleInProvider($order);

        $this->postJson('/api/shop/payments/webhook/paystack', [
            'reference' => $order->reference,
            'status' => '00',
            'amount' => $order->total,
        ])->assertOk();

        $this->assertSame(Order::PENDING_PAYMENT, $order->fresh()->status);
    }

    public function test_a_webhook_that_identifies_nothing_settles_nothing(): void
    {
        $order = $this->placeOrder([['product_unit_id' => $this->laptop()->id]]);
        $this->initialize($order);

        $this->postJson('/api/shop/payments/webhook/mock', [
            'status' => '00',
            'amount' => $order->total,
        ])->assertOk();

        $this->assertSame(Order::PENDING_PAYMENT, $order->fresh()->status);
    }

    public function test_the_webhook_matches_a_payment_by_its_virtual_account(): void
    {
        $unit = $this->laptop();
        $order = $this->placeOrder([['product_unit_id' => $unit->id]]);
        $instruction = $this->initialize($order);

        $this->postJson('/api/shop/payments/webhook/mock', [
            // No reference at all — only the account that was credited, which is
            // the most reliable key because it was minted for this order alone.
            'receiving_account' => $instruction['account_number'],
            'amount' => $order->total,
            'status' => '00',
            'trx' => 'MOCK-TRX-9',
        ])->assertOk();

        $this->assertSame(Order::PAID, $order->fresh()->status);
        $this->assertSame(ProductUnit::STATUS_SOLD, $unit->fresh()->status);
    }

    public function test_the_webhook_records_the_provider_transaction_id(): void
    {
        $order = $this->placeOrder([['product_unit_id' => $this->laptop()->id]]);
        $instruction = $this->initialize($order);

        $this->postJson('/api/shop/payments/webhook/mock', [
            'receiving_account' => $instruction['account_number'],
            'amount' => $order->total,
            'status' => '00',
            'trx' => 'MOCK-TRX-42',
        ])->assertOk();

        $this->assertSame(
            'MOCK-TRX-42',
            $order->payments()->first()->provider_transaction_id,
        );
    }

    /* ------------------------------------------------------------- dev routes */

    public function test_mock_settle_is_unavailable_once_a_real_provider_is_bound(): void
    {
        $order = $this->placeOrder([['product_unit_id' => $this->laptop()->id]]);

        // Rebind to Xendify, as production would.
        config(['shop.provider' => 'xendify', 'shop.xendify.secret_key' => 'sk_test_x']);
        $this->refreshApplication();
        config(['shop.provider' => 'xendify', 'shop.xendify.secret_key' => 'sk_test_x']);

        $this->postJson('/api/shop/payments/mock-settle', [
            'reference' => $order->reference,
            'outcome' => 'success',
        ])->assertStatus(404);
    }

    public function test_verifying_an_unknown_reference_is_a_404(): void
    {
        $this->postJson('/api/shop/payments/verify', ['reference' => 'GG-NOPE99'])
            ->assertStatus(404)
            ->assertJsonPath('message', 'Order not found.');
    }

    /**
     * Stands in for the customer completing the bank transfer. Goes through the
     * dev-only endpoint rather than poking MockLedger directly, so the route is
     * exercised too.
     */
    private function settleInProvider(Order $order): void
    {
        $this->postJson('/api/shop/payments/mock-settle', [
            'reference' => $order->reference,
            'outcome' => 'success',
        ])->assertOk();
    }
}
