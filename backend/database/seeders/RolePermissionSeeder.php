<?php

namespace Database\Seeders;

use App\Support\Permissions;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Projects App\Support\Permissions into the database.
 *
 * Idempotent — `firstOrCreate` throughout and `syncPermissions` rather than
 * `givePermissionTo`, so re-running it after a permission is REMOVED from the
 * matrix actually revokes it. A seeder that only ever adds would let a
 * deleted permission linger on live roles forever.
 */
class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        // spatie caches the permission map; a stale cache here means the roles
        // are created correctly and then behave as though they were not.
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (Permissions::all() as $name) {
            Permission::firstOrCreate([
                'name' => $name,
                'guard_name' => 'web',
            ]);
        }

        foreach (Permissions::matrix() as $roleName => $permissions) {
            $role = Role::firstOrCreate([
                'name' => $roleName,
                'guard_name' => 'web',
            ]);

            $role->syncPermissions($permissions);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
