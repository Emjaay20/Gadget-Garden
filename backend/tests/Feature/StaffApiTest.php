<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Permissions;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StaffApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_owner_can_list_staff(): void
    {
        $owner = $this->owner();
        $this->manager();

        $this->actingAs($owner)
            ->getJson('/api/staff')
            ->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonStructure(['data' => [['id', 'name', 'email', 'role', 'permissions']]]);
    }

    public function test_a_manager_cannot_reach_staff_administration(): void
    {
        $this->actingAs($this->manager())
            ->getJson('/api/staff')
            ->assertStatus(403)
            ->assertJsonPath('message', 'This action is unauthorized.');
    }

    public function test_sales_cannot_reach_staff_administration(): void
    {
        $this->actingAs($this->sales())
            ->getJson('/api/staff')
            ->assertStatus(403);
    }

    /**
     * New accounts must not share a predictable password — anyone who knew a
     * colleague's email address could otherwise sign in as them.
     */
    public function test_creating_staff_generates_a_random_temporary_password(): void
    {
        $response = $this->actingAs($this->owner())
            ->postJson('/api/staff', [
                'name' => 'New Colleague',
                'email' => 'new@gadgetsgarden.test',
                'phone' => '08056947271',
                'role' => Permissions::SALES,
            ]);

        $response->assertCreated()
            ->assertJsonPath('data.role', Permissions::SALES)
            ->assertJsonPath('data.is_active', true);

        $temporary = $response->json('meta.temporary_password');
        $this->assertIsString($temporary);
        $this->assertSame(16, strlen($temporary));
        $this->assertNotSame('password', $temporary);

        // And it actually works.
        $this->forgetAuth();
        $this->postJson('/api/login', [
            'email' => 'new@gadgetsgarden.test',
            'password' => $temporary,
        ])->assertOk();
    }

    public function test_two_new_accounts_do_not_share_a_password(): void
    {
        $owner = $this->owner();

        $first = $this->actingAs($owner)->postJson('/api/staff', [
            'name' => 'One', 'email' => 'one@test.test', 'role' => Permissions::SALES,
        ])->json('meta.temporary_password');

        $second = $this->actingAs($owner)->postJson('/api/staff', [
            'name' => 'Two', 'email' => 'two@test.test', 'role' => Permissions::SALES,
        ])->json('meta.temporary_password');

        $this->assertNotSame($first, $second);
    }

    public function test_a_password_in_the_request_body_is_ignored(): void
    {
        $this->actingAs($this->owner())
            ->postJson('/api/staff', [
                'name' => 'Sneaky',
                'email' => 'sneaky@test.test',
                'role' => Permissions::SALES,
                'password' => 'chosen-by-the-caller',
            ])->assertCreated();

        $this->forgetAuth();

        $this->postJson('/api/login', [
            'email' => 'sneaky@test.test',
            'password' => 'chosen-by-the-caller',
        ])->assertStatus(422);
    }

    public function test_deactivating_staff_revokes_their_tokens_in_the_same_request(): void
    {
        $owner = $this->owner();
        $victim = $this->sales();
        $token = $victim->createToken('backoffice')->plainTextToken;

        $this->actingAs($owner)
            ->patchJson("/api/staff/{$victim->id}", ['is_active' => false])
            ->assertOk()
            ->assertJsonPath('data.is_active', false);

        $this->assertSame(0, $victim->tokens()->count());

        $this->forgetAuth();

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/me')
            ->assertStatus(401);
    }

    public function test_a_role_can_be_changed(): void
    {
        $owner = $this->owner();
        $staff = $this->sales();

        $this->actingAs($owner)
            ->patchJson("/api/staff/{$staff->id}", ['role' => Permissions::MANAGER])
            ->assertOk()
            ->assertJsonPath('data.role', Permissions::MANAGER);

        $this->assertTrue($staff->fresh()->can(Permissions::INVENTORY_MANAGE));
    }

    public function test_an_owner_cannot_deactivate_themselves(): void
    {
        $owner = $this->owner();

        $this->actingAs($owner)
            ->patchJson("/api/staff/{$owner->id}", ['is_active' => false])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['is_active']);

        $this->assertTrue($owner->fresh()->is_active);
    }

    /**
     * Demoting the last owner leaves a business with nobody who can create staff
     * or reprice the catalogue — recoverable only by hand-editing the database.
     */
    public function test_the_last_owner_cannot_be_demoted(): void
    {
        $owner = $this->owner();
        $other = $this->owner();

        // Two owners: demoting one is fine.
        $this->actingAs($owner)
            ->patchJson("/api/staff/{$other->id}", ['role' => Permissions::MANAGER])
            ->assertOk();

        $this->forgetAuth();

        // Now there is one left, and it must not be demotable.
        $this->actingAs($owner)
            ->patchJson("/api/staff/{$owner->id}", ['role' => Permissions::MANAGER])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['role']);

        $this->assertSame(Permissions::OWNER, $owner->fresh()->roleName());
    }

    public function test_an_unknown_staff_member_reads_as_a_human_sentence(): void
    {
        $this->actingAs($this->owner())
            ->getJson('/api/staff/999999')
            ->assertStatus(404)
            // Not "No query results for model [App\Models\User] 999999".
            ->assertJsonPath('message', 'Staff member not found.');
    }

    public function test_email_must_be_unique(): void
    {
        $existing = $this->sales(['email' => 'taken@test.test']);

        $this->actingAs($this->owner())
            ->postJson('/api/staff', [
                'name' => 'Clash',
                'email' => 'taken@test.test',
                'role' => Permissions::SALES,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email']);

        $this->assertSame(1, User::where('email', 'taken@test.test')->count());
        $this->assertNotNull($existing);
    }

    public function test_an_unknown_role_is_rejected(): void
    {
        $this->actingAs($this->owner())
            ->postJson('/api/staff', [
                'name' => 'Impostor',
                'email' => 'impostor@test.test',
                'role' => 'superadmin',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['role']);
    }
}
