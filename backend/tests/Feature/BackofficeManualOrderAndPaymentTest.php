<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\DeliveryZone;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductUnit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BackofficeManualOrderAndPaymentTest extends TestCase
{
    use RefreshDatabase;

    private function laptopWithUnit(int $price = 650_000): array
    {
        $product = Product::factory()->create([
            'is_active' => true,
            'kind' => Product::KIND_UNIT,
        ]);

        $unit = ProductUnit::factory()->create([
            'product_id' => $product->id,
            'price' => $price,
            'status' => 'available',
        ]);

        return [$product, $unit];
    }

    public function test_sales_can_create_manual_pickup_order_and_receive_whatsapp_link(): void
    {
        [$product, $unit] = $this->laptopWithUnit(700_000);
        $sales = $this->sales();

        $response = $this->actingAs($sales)
            ->postJson('/api/orders/manual', [
                'contact_name' => 'Chinedu Eze',
                'contact_email' => 'chinedu@example.test',
                'contact_phone' => '08012345678',
                'delivery_type' => 'pickup',
                'items' => [
                    ['product_id' => $product->id, 'sku' => $unit->sku],
                ],
                'staff_note' => 'Walk-in customer at Computer Village shop',
            ])
            ->assertStatus(201);

        $response->assertJsonPath('data.status', 'pending_payment');
        $response->assertJsonPath('data.total', 700_000);
        $this->assertNotEmpty($response->json('pay_url'));
        $this->assertNotEmpty($response->json('whatsapp_url'));

        // Unit is reserved
        $this->assertSame('reserved', $unit->fresh()->status);

        // Audit log created
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'order.manual_created',
            'user_id' => $sales->id,
        ]);
    }

    public function test_sales_can_verify_offline_bank_transfer_payment(): void
    {
        [$product, $unit] = $this->laptopWithUnit(500_000);
        $sales = $this->sales();

        $createRes = $this->actingAs($sales)->postJson('/api/orders/manual', [
            'contact_name' => 'Amina Bello',
            'contact_email' => 'amina@example.test',
            'contact_phone' => '08098765432',
            'delivery_type' => 'pickup',
            'items' => [
                ['product_id' => $product->id, 'sku' => $unit->sku],
            ],
        ])->assertStatus(201);

        $reference = $createRes->json('data.reference');

        // Now reconcile/verify the bank transfer
        $verifyRes = $this->actingAs($sales)->postJson("/api/orders/{$reference}/verify-offline-payment", [
            'method' => 'bank_transfer',
            'transaction_reference' => 'STANBIC-SESSION-998822',
            'amount_paid' => 500_000,
            'bank_name' => 'Stanbic IBTC',
            'account_name' => 'Amina Bello',
            'note' => 'Verified on bank app',
        ])->assertOk();

        $verifyRes->assertJsonPath('data.status', Order::PAID);
        $this->assertSame('sold', $unit->fresh()->status);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'order.offline_payment_verified',
            'user_id' => $sales->id,
        ]);
    }

    public function test_sales_can_create_immediate_paid_pos_order(): void
    {
        [$product, $unit] = $this->laptopWithUnit(850_000);
        $sales = $this->sales();

        $response = $this->actingAs($sales)->postJson('/api/orders/manual', [
            'contact_name' => 'Tunde Bakare',
            'contact_email' => 'tunde@example.test',
            'contact_phone' => '08123456789',
            'delivery_type' => 'pickup',
            'items' => [
                ['product_id' => $product->id, 'sku' => $unit->sku],
            ],
            'immediate_payment' => true,
            'payment_method' => 'pos_terminal',
            'transaction_reference' => 'POS-STANBIC-7721',
            'staff_note' => 'Paid with card at counter POS terminal',
        ])->assertStatus(201);

        $response->assertJsonPath('data.status', Order::PAID);
        $this->assertSame('sold', $unit->fresh()->status);
    }
}
