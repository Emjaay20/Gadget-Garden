<?php

namespace Tests\Feature;

use App\Models\DeliveryZone;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Notifications\OrderConfirmed;
use App\Notifications\OrderStatusChanged;
use App\Shop\OrderTransitions;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * Transactional email.
 *
 * The rule under test is mostly about restraint: an inbox that pings every time
 * somebody opens an order page teaches customers to ignore the emails that
 * matter.
 */
class OrderNotificationsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['shop.provider' => 'mock']);
        Notification::fake();
    }

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

    /* --------------------------------------------------------------- receipt */

    public function test_a_receipt_is_sent_when_payment_clears(): void
    {
        $zone = DeliveryZone::factory()->create(['slug' => 'lagos', 'fee' => 0]);
        $unit = ProductUnit::factory()->for(Product::factory())->create(['price' => 620_000]);

        $reference = $this->postJson('/api/shop/orders', [
            'items' => [['product_unit_id' => $unit->id]],
            'contact' => ['name' => 'Ada Obi', 'email' => 'ada@example.test', 'phone' => '08056947271'],
            'delivery_zone' => $zone->slug,
            'address' => ['line1' => '12 Oshitelu', 'city' => 'Ikeja', 'state' => 'Lagos'],
        ])->assertCreated()->json('data.reference');

        $this->postJson('/api/shop/payments/initialize', ['reference' => $reference]);
        $this->postJson('/api/shop/payments/mock-settle', [
            'reference' => $reference, 'outcome' => 'success',
        ]);

        Notification::assertNothingSent();

        $this->postJson('/api/shop/payments/verify', ['reference' => $reference])->assertOk();

        Notification::assertSentOnDemand(
            OrderConfirmed::class,
            fn ($notification, $channels, $notifiable) => $notifiable->routes['mail'] === 'ada@example.test',
        );
    }

    /**
     * Settlement is idempotent, and so is the receipt — a webhook that retries
     * ten times must not send ten emails.
     */
    public function test_only_one_receipt_is_sent_however_many_times_verify_runs(): void
    {
        $zone = DeliveryZone::factory()->create(['slug' => 'lagos', 'fee' => 0]);
        $unit = ProductUnit::factory()->for(Product::factory())->create(['price' => 620_000]);

        $reference = $this->postJson('/api/shop/orders', [
            'items' => [['product_unit_id' => $unit->id]],
            'contact' => ['name' => 'Ada Obi', 'email' => 'ada@example.test', 'phone' => '08056947271'],
            'delivery_zone' => $zone->slug,
            'address' => ['line1' => '12 Oshitelu', 'city' => 'Ikeja', 'state' => 'Lagos'],
        ])->json('data.reference');

        $this->postJson('/api/shop/payments/initialize', ['reference' => $reference]);
        $this->postJson('/api/shop/payments/mock-settle', [
            'reference' => $reference, 'outcome' => 'success',
        ]);

        foreach (range(1, 4) as $ignored) {
            $this->postJson('/api/shop/payments/verify', ['reference' => $reference]);
        }

        Notification::assertSentOnDemandTimes(OrderConfirmed::class, 1);
    }

    /* -------------------------------------------------------------- updates */

    public function test_a_real_transition_notifies_the_customer(): void
    {
        $order = $this->paidOrder();

        app(OrderTransitions::class)->apply(
            $order,
            Order::PROCESSING,
            $this->sales(),
        );

        Notification::assertSentOnDemandTimes(OrderStatusChanged::class, 1);
    }

    /** A double-clicked button is a no-op, and a no-op must not email anyone. */
    public function test_a_no_op_transition_sends_nothing(): void
    {
        $order = $this->paidOrder();
        $actor = $this->sales();

        app(OrderTransitions::class)->apply($order, Order::PAID, $actor);

        Notification::assertNothingSent();
    }

    /** A note is an internal record, not news for the customer. */
    public function test_adding_only_a_note_sends_nothing(): void
    {
        $order = $this->paidOrder();

        $this->actingAs($this->sales())
            ->patchJson("/api/orders/{$order->reference}", ['note' => 'Called the customer'])
            ->assertOk();

        Notification::assertNothingSent();
    }

    public function test_a_refused_transition_sends_nothing(): void
    {
        $order = $this->paidOrder();

        $this->actingAs($this->sales())
            ->patchJson("/api/orders/{$order->reference}", ['status' => Order::DELIVERED])
            ->assertStatus(422);

        Notification::assertNothingSent();
    }

    public function test_each_step_of_fulfilment_notifies_once(): void
    {
        $order = $this->paidOrder();
        $actor = $this->sales();
        $transitions = app(OrderTransitions::class);

        foreach ([Order::PROCESSING, Order::SHIPPED, Order::DELIVERED] as $status) {
            $order = $transitions->apply($order, $status, $actor);
        }

        Notification::assertSentOnDemandTimes(OrderStatusChanged::class, 3);
    }

    /* -------------------------------------------------------------- content */

    public function test_the_receipt_names_the_exact_machine_that_was_bought(): void
    {
        $unit = ProductUnit::factory()
            ->for(Product::factory()->create(['name' => 'HP EliteBook 840 G8']))
            ->create(['sku' => 'GG-EB840-007', 'price' => 620_000]);

        $order = $this->paidOrder();
        $order->items()->create([
            'product_id' => $unit->product_id,
            'product_unit_id' => $unit->id,
            'name_at_time' => 'HP EliteBook 840 G8',
            'sku_at_time' => 'GG-EB840-007',
            'unit_price_at_time' => 620_000,
            'quantity' => 1,
            'line_total' => 620_000,
        ]);

        $mail = (new OrderConfirmed($order->fresh(['items'])))->toMail($order);
        $rendered = implode("\n", $mail->introLines);

        // The SKU is what support will ask for, and what proves which physical
        // machine was sold.
        $this->assertStringContainsString('GG-EB840-007', $rendered);
        $this->assertStringContainsString('₦620,000', $rendered);
        $this->assertStringContainsString($order->reference, $rendered);
    }

    public function test_status_emails_say_something_specific_per_status(): void
    {
        $order = $this->paidOrder();

        foreach ([
            Order::SHIPPED => 'courier',
            Order::DELIVERED => 'warranty',
            Order::CANCELLED => 'refund',
        ] as $status => $expected) {
            $order->forceFill(['status' => $status])->save();

            $mail = (new OrderStatusChanged($order->fresh()))->toMail($order);
            $body = $mail->subject.' '.implode(' ', $mail->introLines);

            $this->assertStringContainsString(
                $expected,
                strtolower($body),
                "The {$status} email should mention '{$expected}'.",
            );
        }
    }

    /** Queued, so a slow SMTP server never delays a customer's page. */
    public function test_both_notifications_are_queued(): void
    {
        $order = $this->paidOrder();

        $this->assertInstanceOf(
            ShouldQueue::class,
            new OrderConfirmed($order),
        );
        $this->assertInstanceOf(
            ShouldQueue::class,
            new OrderStatusChanged($order),
        );
    }
}
