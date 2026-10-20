<?php

namespace Tests\Feature;

use App\Support\Permissions;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Guards the matrix itself, rather than any endpoint.
 *
 * The seeder, the route middleware and the frontend's rendering decisions all
 * read from App\Support\Permissions. These tests assert that what ends up in the
 * database is what the matrix says, so a permission added to a role in code but
 * never seeded — or removed from code but left live on a role — fails here
 * instead of surfacing as a mysterious 403 in the backoffice.
 */
class PermissionMatrixTest extends TestCase
{
    use RefreshDatabase;

    public function test_every_permission_and_role_is_seeded(): void
    {
        foreach (Permissions::all() as $permission) {
            $this->assertDatabaseHas('permissions', ['name' => $permission]);
        }

        foreach (Permissions::roles() as $role) {
            $this->assertDatabaseHas('roles', ['name' => $role]);
        }
    }

    public function test_each_role_holds_exactly_what_the_matrix_grants(): void
    {
        foreach (Permissions::matrix() as $roleName => $expected) {
            $actual = Role::findByName($roleName)
                ->permissions
                ->pluck('name')
                ->sort()
                ->values()
                ->all();

            $this->assertSame(
                collect($expected)->sort()->values()->all(),
                $actual,
                "Role [{$roleName}] does not match the matrix.",
            );
        }
    }

    public function test_the_owner_holds_every_permission(): void
    {
        $this->assertSame(
            collect(Permissions::all())->sort()->values()->all(),
            collect(Permissions::for(Permissions::OWNER))->sort()->values()->all(),
        );
    }

    /**
     * Pricing and stock are separate kinds of trust: a manager receives a
     * shipment, but does not decide what it sells for. If these ever collapse
     * into one permission it should be a deliberate decision, not a drift.
     */
    public function test_a_manager_can_move_stock_but_cannot_reprice_or_see_margin(): void
    {
        $manager = $this->manager();

        $this->assertTrue($manager->can(Permissions::INVENTORY_MANAGE));
        $this->assertTrue($manager->can(Permissions::ORDERS_MANAGE));

        $this->assertFalse($manager->can(Permissions::CATALOGUE_MANAGE));
        $this->assertFalse($manager->can(Permissions::REPORTS_VIEW));
        $this->assertFalse($manager->can(Permissions::STAFF_MANAGE));
    }

    public function test_sales_can_fulfil_orders_but_cannot_touch_stock(): void
    {
        $sales = $this->sales();

        $this->assertTrue($sales->can(Permissions::ORDERS_MANAGE));
        $this->assertTrue($sales->can(Permissions::INVENTORY_VIEW));

        $this->assertFalse($sales->can(Permissions::INVENTORY_MANAGE));
        $this->assertFalse($sales->can(Permissions::CATALOGUE_MANAGE));
        $this->assertFalse($sales->can(Permissions::CUSTOMERS_MANAGE));
    }

    /**
     * Re-running the seeder must REVOKE a permission that has been taken out of
     * the matrix — `syncPermissions`, not `givePermissionTo`. A seeder that only
     * ever adds leaves deleted permissions live on real roles.
     */
    public function test_reseeding_revokes_a_permission_no_longer_in_the_matrix(): void
    {
        $role = Role::findByName(Permissions::SALES);
        $stray = Permission::create(['name' => 'stray.permission', 'guard_name' => 'web']);
        $role->givePermissionTo($stray);

        $this->assertTrue($role->fresh()->hasPermissionTo('stray.permission'));

        $this->seed(RolePermissionSeeder::class);

        $this->assertFalse($role->fresh()->hasPermissionTo('stray.permission'));
    }
}
