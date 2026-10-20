<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

/**
 * A staff member.
 *
 * `password` is deliberately absent from `#[Fillable]`: staff are created
 * without one (a random temporary password is generated — see StaffController)
 * and it is only ever set explicitly. That way a stray `password` key in a PATCH
 * body cannot silently reset a colleague's credentials.
 */
#[Fillable(['name', 'email', 'phone', 'is_active'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'is_active' => 'boolean',
            'password' => 'hashed',
        ];
    }

    /**
     * This user's single role name.
     *
     * NOT named `role()`. `HasRoles` contributes a `role` QUERY SCOPE, and an
     * instance method of the same name shadows it — `User::role('owner')` then
     * dies at runtime with "cannot be called statically", a long way from the
     * actual cause.
     */
    public function roleName(): ?string
    {
        return $this->roles->first()?->name;
    }

    /**
     * Permissions as a flat array of strings — the shape `/api/me` returns, so
     * the backoffice needs neither a second round trip nor to unwrap role
     * objects to know what it may render.
     *
     * @return list<string>
     */
    public function permissionNames(): array
    {
        return $this->getAllPermissions()
            ->pluck('name')
            ->sort()
            ->values()
            ->all();
    }
}
