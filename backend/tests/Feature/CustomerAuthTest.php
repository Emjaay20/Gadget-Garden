<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\DeliveryZone;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Notifications\CustomerWelcome;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class CustomerAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_register_and_receives_welcome_notification(): void
    {
        Notification::fake();

        $response = $this->postJson('/api/shop/auth/register', [
            'name' => 'Tunde Bakare',
            'email' => 'tunde@example.test',
            'phone' => '08031234567',
            'password' => 'secret12345',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.customer.name', 'Tunde Bakare')
            ->assertJsonPath('data.customer.email', 'tunde@example.test');

        $this->assertNotNull($response->json('data.token'));

        $customer = Customer::where('email', 'tunde@example.test')->firstOrFail();
        $this->assertNotNull($customer->password);

        Notification::assertSentTo($customer, CustomerWelcome::class);
    }

    public function test_customer_can_login_with_valid_password(): void
    {
        $customer = Customer::create([
            'name' => 'Kemi Ade',
            'email' => 'kemi@example.test',
            'phone' => '08099887766',
            'password' => bcrypt('password123'),
        ]);

        $response = $this->postJson('/api/shop/auth/login', [
            'email' => 'kemi@example.test',
            'password' => 'password123',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.customer.email', 'kemi@example.test');

        $this->assertNotNull($response->json('data.token'));
    }

    public function test_customer_cannot_login_with_invalid_password(): void
    {
        Customer::create([
            'name' => 'Kemi Ade',
            'email' => 'kemi@example.test',
            'phone' => '08099887766',
            'password' => bcrypt('password123'),
        ]);

        $response = $this->postJson('/api/shop/auth/login', [
            'email' => 'kemi@example.test',
            'password' => 'wrong-pass',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_authenticated_customer_can_fetch_profile_and_orders_with_warranty(): void
    {
        $customer = Customer::create([
            'name' => 'Chidi Eze',
            'email' => 'chidi@example.test',
            'phone' => '08011223344',
            'password' => bcrypt('password123'),
        ]);

        $token = $customer->createToken('storefront_customer')->plainTextToken;

        $zone = DeliveryZone::factory()->create(['slug' => 'lagos', 'fee' => 0]);
        $unit = ProductUnit::factory()->for(Product::factory())->create(['price' => 700_000]);

        $order = Order::factory()->create([
            'customer_id' => $customer->id,
            'contact_email' => $customer->email,
            'contact_name' => $customer->name,
            'status' => Order::DELIVERED,
            'paid_at' => now()->subDays(5),
            'placed_at' => now()->subDays(5),
            'subtotal' => 700_000,
            'delivery_fee' => 0,
            'discount_amount' => 0,
            'total' => 700_000,
        ]);

        // Test /api/shop/auth/me
        $this->withToken($token)
            ->getJson('/api/shop/auth/me')
            ->assertOk()
            ->assertJsonPath('data.customer.email', 'chidi@example.test')
            ->assertJsonPath('data.orders_count', 1);

        // Test /api/shop/customer/orders
        $this->withToken($token)
            ->getJson('/api/shop/customer/orders')
            ->assertOk()
            ->assertJsonPath('data.0.reference', $order->reference);

        // Test /api/shop/customer/orders/{reference}
        $orderResponse = $this->withToken($token)
            ->getJson("/api/shop/customer/orders/{$order->reference}")
            ->assertOk();

        $orderResponse->assertJsonPath('data.warranty.is_active', true)
            ->assertJsonPath('data.warranty.duration', '90 Days');
    }
}
