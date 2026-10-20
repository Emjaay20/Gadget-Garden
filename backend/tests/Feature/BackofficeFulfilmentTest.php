<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductUnit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Order fulfilment and the transition graph.
 *
 * The graph exists to stop an order going backwards or sideways — see
 * App\Shop\OrderTransitions for why `delivered` is final and why a shipped order
 * cannot be cancelled here.
 */
class BackofficeFulfilmentTest extends TestCase
{
    use RefreshDatabase;

    private function paidOrder(): Order
    {
        $order = Order::factory()->create();
        $order->forceFill([
            'status' => Order::PAID,
            'paid_at' => now(),
            'reserved_until' => null,
        ])->save();

        return $order->fresh();
    }

    /* --------------------------------------------------------------- access */

    public function test_sales_can_fulfil_orders(): void
    {
        $order = $this->paidOrder();

        $this->actingAs($this->sales())
            ->patchJson("/api/orders/{$order->reference}", ['status' => Order::PROCESSING])
            ->assertOk()
            ->assertJsonPath('data.status', Order::PROCESSING);
    }

    public function test_an_anonymous_request_cannot_read_the_queue(): void
    {
        $this->getJson('/api/orders')->assertStatus(401);
    }

    /* ---------------------------------------------------------- transitions */

    public function test_the_happy_path(): void
    {
        $order = $this->paidOrder();
        $sales = $this->sales();

        foreach ([Order::PROCESSING, Order::SHIPPED, Order::DELIVERED] as $status) {
            $this->actingAs($sales)
                ->patchJson("/api/orders/{$order->reference}", ['status' => $status])
                ->assertOk()
                ->assertJsonPath('data.status', $status);
        }

        $this->assertSame(Order::DELIVERED, $order->fresh()->status);
    }

    public function test_an_order_cannot_skip_a_step(): void
    {
        $order = $this->paidOrder();

        $this->actingAs($this->sales())
            ->patchJson("/api/orders/{$order->reference}", ['status' => Order::DELIVERED])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status']);

        $this->assertSame(Order::PAID, $order->fresh()->status);
    }

    public function test_an_order_cannot_go_backwards(): void
    {
        $order = $this->paidOrder();
        $sales = $this->sales();

        $this->actingAs($sales)->patchJson("/api/orders/{$order->reference}", [
            'status' => Order::PROCESSING,
        ])->assertOk();

        $this->forgetAuth();

        $this->actingAs($sales)->patchJson("/api/orders/{$order->reference}", [
            'status' => Order::PAID,
        ])->assertStatus(422);
    }

    /** Staff cannot declare an order paid — only a real payment does that. */
    public function test_staff_cannot_mark_an_unpaid_order_paid(): void
    {
        $order = Order::factory()->create(); // pending_payment

        $this->actingAs($this->owner())
            ->patchJson("/api/orders/{$order->reference}", ['status' => Order::PAID])
            ->assertStatus(422);

        $this->assertSame(Order::PENDING_PAYMENT, $order->fresh()->status);
    }

    /** A delivered order is finished. Anything after it is a return. */
    public function test_a_delivered_order_is_final(): void
    {
        $order = $this->paidOrder();
        $order->forceFill(['status' => Order::DELIVERED])->save();

        foreach ([Order::CANCELLED, Order::SHIPPED, Order::PROCESSING] as $status) {
            $this->actingAs($this->owner())
                ->patchJson("/api/orders/{$order->reference}", ['status' => $status])
                ->assertStatus(422);

            $this->forgetAuth();
        }
    }

    /** The goods are with a courier; "cancelled" would stop matching reality. */
    public function test_a_shipped_order_cannot_be_cancelled(): void
    {
        $order = $this->paidOrder();
        $order->forceFill(['status' => Order::SHIPPED])->save();

        $this->actingAs($this->owner())
            ->patchJson("/api/orders/{$order->reference}", ['status' => Order::CANCELLED])
            ->assertStatus(422);
    }

    /** A double-clicked button is not an error. */
    public function test_transitioning_to_the_current_status_is_a_no_op(): void
    {
        $order = $this->paidOrder();

        $this->actingAs($this->sales())
            ->patchJson("/api/orders/{$order->reference}", ['status' => Order::PAID])
            ->assertOk()
            ->assertJsonPath('data.status', Order::PAID);
    }

    /* -------------------------------------------------------- cancellation */

    /**
     * Cancelling an unpaid order must put its machine back on the shelf now —
     * not whenever the sweeper next happens to run.
     */
    public function test_cancelling_an_unpaid_order_releases_its_machine(): void
    {
        $unit = ProductUnit::factory()->for(Product::factory())->create();
        $order = Order::factory()->create();
        $unit->reserveFor($order->id, $order->reference, now()->addDay());

        $this->actingAs($this->owner())
            ->patchJson("/api/orders/{$order->reference}", [
                'status' => Order::CANCELLED,
                'note' => 'Customer changed their mind',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', Order::CANCELLED);

        $unit->refresh();
        $this->assertSame(ProductUnit::STATUS_AVAILABLE, $unit->status);
        $this->assertNull($unit->order_id);
    }

    /**
     * A cancelled PAID order is different: its units are sold and its money has
     * moved. Reversing that is a refund and a return, deliberately not automated
     * — but the cancellation itself must still record.
     */
    public function test_cancelling_a_paid_order_does_not_silently_unsell_the_machine(): void
    {
        $unit = ProductUnit::factory()->for(Product::factory())->create();
        $order = $this->paidOrder();
        $unit->markSold($order->id, $order->reference);

        $this->actingAs($this->owner())
            ->patchJson("/api/orders/{$order->reference}", [
                'status' => Order::CANCELLED,
                'note' => 'Refunded at the counter',
            ])
            ->assertOk();

        $this->assertSame(Order::CANCELLED, $order->fresh()->status);
        // Still sold — putting it back on the shelf would be a silent, untracked
        // reversal of a real sale.
        $this->assertSame(ProductUnit::STATUS_SOLD, $unit->fresh()->status);
    }

    /* --------------------------------------------------------------- notes */

    public function test_a_note_can_be_added_without_a_status_change(): void
    {
        $order = $this->paidOrder();

        $this->actingAs($this->sales(['name' => 'Front Desk']))
            ->patchJson("/api/orders/{$order->reference}", [
                'note' => 'Customer asked for Saturday delivery',
            ])
            ->assertOk();

        $note = $order->fresh()->staff_note;
        $this->assertStringContainsString('Saturday delivery', $note);
        // Signed, so the queue shows who said it.
        $this->assertStringContainsString('Front Desk', $note);
    }

    /* --------------------------------------------------------------- queue */

    public function test_the_open_queue_is_what_is_paid_but_not_yet_shipped(): void
    {
        $this->paidOrder();

        $processing = $this->paidOrder();
        $processing->forceFill(['status' => Order::PROCESSING])->save();

        $shipped = $this->paidOrder();
        $shipped->forceFill(['status' => Order::SHIPPED])->save();

        Order::factory()->create(); // pending_payment

        $response = $this->actingAs($this->sales())
            ->getJson('/api/orders?status=open')
            ->assertOk();

        $this->assertCount(2, $response->json('data'));
        $this->assertSame(2, $response->json('meta.counts.open'));
        $this->assertSame(1, $response->json('meta.counts.shipped'));
    }

    public function test_orders_can_be_searched_by_reference_and_by_customer(): void
    {
        $order = $this->paidOrder();
        $order->forceFill(['contact_name' => 'Ada Obi'])->save();
        $this->paidOrder();

        $sales = $this->sales();

        $byRef = $this->actingAs($sales)
            ->getJson('/api/orders?search='.$order->reference)
            ->json('data');
        $this->assertCount(1, $byRef);

        $this->forgetAuth();

        $byName = $this->actingAs($sales)->getJson('/api/orders?search=Ada')->json('data');
        $this->assertCount(1, $byName);
    }

    public function test_the_detail_view_tells_the_ui_which_transitions_are_legal(): void
    {
        $order = $this->paidOrder();

        $next = $this->actingAs($this->sales())
            ->getJson("/api/orders/{$order->reference}")
            ->assertOk()
            ->json('data.next_statuses');

        $this->assertSame([Order::PROCESSING, Order::CANCELLED], $next);
    }

    public function test_an_unknown_reference_is_a_404(): void
    {
        $this->actingAs($this->sales())
            ->getJson('/api/orders/GG-NOPE99')
            ->assertStatus(404)
            ->assertJsonPath('message', 'Order not found.');
    }

    /* --------------------------------------------------------------- margin */

    public function test_margin_is_hidden_from_staff_without_reports_view(): void
    {
        $unit = ProductUnit::factory()->for(Product::factory())->create(['cost' => 470_000]);
        $order = $this->paidOrder();
        $order->items()->create([
            'product_id' => $unit->product_id,
            'product_unit_id' => $unit->id,
            'name_at_time' => 'HP EliteBook',
            'sku_at_time' => $unit->sku,
            'unit_price_at_time' => 620_000,
            'quantity' => 1,
            'line_total' => 620_000,
        ]);

        $asSales = $this->actingAs($this->sales())
            ->getJson("/api/orders/{$order->reference}")
            ->json('data.items.0.cost');

        $this->assertNull($asSales);

        $this->forgetAuth();

        $asOwner = $this->actingAs($this->owner())
            ->getJson("/api/orders/{$order->reference}")
            ->json('data.items.0.cost');

        $this->assertSame(470_000, $asOwner);
    }

    /** Provider payloads hold the payer's own bank details. */
    public function test_raw_payment_payloads_are_never_serialised(): void
    {
        $order = $this->paidOrder();
        $order->payments()->create([
            'provider' => 'mock',
            'provider_reference' => $order->reference,
            'amount' => $order->total,
            'raw_response' => ['sender_account_number' => '0123456789'],
            'raw_webhook' => ['sender_name' => 'ADA OBI'],
        ]);

        $body = $this->actingAs($this->owner())
            ->getJson("/api/orders/{$order->reference}")
            ->getContent();

        $this->assertStringNotContainsString('0123456789', $body);
        $this->assertStringNotContainsString('raw_response', $body);
        $this->assertStringNotContainsString('raw_webhook', $body);
    }
}
