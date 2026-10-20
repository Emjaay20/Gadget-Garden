<?php

namespace Database\Seeders;

use App\Models\User;
use App\Support\Permissions;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $this->call(RolePermissionSeeder::class);

        $this->seedStaff();

        $this->call(CatalogueSeeder::class);
    }

    /**
     * Local dev logins, one per role, so every permission path can be exercised
     * by hand without editing the database.
     *
     * `updateOrCreate` on email keeps a re-run from colliding on the unique
     * index, and the password is reset each time so a forgotten local change
     * cannot lock the developer out of their own seed data.
     *
     * These are DEV fixtures. Production staff are created through
     * `POST /api/staff`, which generates a random password — nothing here should
     * ever reach a live database, which is why the passwords are obviously fake.
     */
    private function seedStaff(): void
    {
        $staff = [
            ['Habeeb Anifowose', 'owner@gadgetsgarden.test', Permissions::OWNER],
            ['Shop Manager', 'manager@gadgetsgarden.test', Permissions::MANAGER],
            ['Front Desk', 'sales@gadgetsgarden.test', Permissions::SALES],
        ];

        foreach ($staff as [$name, $email, $role]) {
            /*
             | Fetch-then-fill rather than `updateOrCreate`, because `password`
             | is deliberately not mass-assignable (see the User model) and the
             | column is NOT NULL — so `updateOrCreate` would try to INSERT a row
             | with no password and fail on the constraint.
             */
            $user = User::firstOrNew(['email' => $email]);

            $user->fill([
                'name' => $name,
                'is_active' => true,
            ]);

            $user->email_verified_at = now();
            $user->password = Hash::make('password');
            $user->save();

            $user->syncRoles([$role]);
        }
    }
}
