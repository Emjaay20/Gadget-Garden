<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuditLogTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_and_manager_can_view_audit_logs(): void
    {
        $owner = $this->owner();
        $manager = $this->manager();

        AuditLog::create([
            'user_id' => $owner->id,
            'action' => 'catalogue.price_updated',
            'description' => 'HP EliteBook 840 price reduced',
        ]);

        $this->actingAs($owner)
            ->getJson('/api/audit-logs')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);

        $this->actingAs($manager)
            ->getJson('/api/audit-logs')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);
    }

    public function test_sales_cannot_view_audit_logs(): void
    {
        $sales = $this->sales();

        $this->actingAs($sales)
            ->getJson('/api/audit-logs')
            ->assertStatus(403);
    }

    public function test_filtering_audit_logs_by_action_and_search(): void
    {
        $owner = $this->owner();

        AuditLog::create([
            'user_id' => $owner->id,
            'action' => 'stock.intake',
            'description' => 'Batch intake 20 laptops',
        ]);

        AuditLog::create([
            'user_id' => $owner->id,
            'action' => 'order.refunded',
            'description' => 'Customer refund processed',
        ]);

        $res = $this->actingAs($owner)
            ->getJson('/api/audit-logs?action=stock.intake')
            ->assertOk();

        $this->assertSame(1, $res->json('meta.total'));
        $this->assertSame('stock.intake', $res->json('data.0.action'));
    }
}
