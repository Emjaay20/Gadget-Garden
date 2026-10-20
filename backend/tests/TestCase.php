<?php

namespace Tests;

use App\Models\User;
use App\Support\Permissions;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Spatie\Permission\PermissionRegistrar;

abstract class TestCase extends BaseTestCase
{
    /**
     * Roles and permissions must exist before any test that touches them, and
     * `RefreshDatabase` wipes them between tests — so they are re-seeded here
     * instead of in every test class.
     */
    protected function setUp(): void
    {
        parent::setUp();

        if (in_array(RefreshDatabase::class, class_uses_recursive($this), true)) {
            $this->seed(RolePermissionSeeder::class);
        }
    }

    protected function owner(array $attributes = []): User
    {
        return $this->staff(Permissions::OWNER, $attributes);
    }

    protected function manager(array $attributes = []): User
    {
        return $this->staff(Permissions::MANAGER, $attributes);
    }

    protected function sales(array $attributes = []): User
    {
        return $this->staff(Permissions::SALES, $attributes);
    }

    protected function staff(string $role, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $user->syncRoles([$role]);

        // The registrar caches the permission map per request. In production
        // every request builds a fresh container so this is free; inside one
        // test the container is reused, and a role assigned after an earlier
        // permission check would otherwise go unseen.
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return $user->fresh();
    }

    /**
     * Forget the user Sanctum already resolved for this test.
     *
     * Sanctum's RequestGuard MEMOISES the user it authenticated. In production
     * each request builds a fresh container, so this never bites. Inside a
     * single test the container is reused, and a second request sent with
     * DIFFERENT credentials silently reuses the first request's user — which
     * makes "the revoked token is rejected" pass for entirely the wrong reason.
     *
     * Call this between requests whenever the acting user or token changes.
     */
    protected function forgetAuth(): void
    {
        $this->app['auth']->forgetGuards();
    }
}
