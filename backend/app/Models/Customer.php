<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * A customer / buyer.
 *
 * Supports both guest checkouts (password = null) and authenticated shopper
 * accounts (password set) with Sanctum tokens.
 */
#[Fillable(['name', 'email', 'phone', 'source', 'note', 'password'])]
#[Hidden(['password', 'remember_token'])]
class Customer extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    public const SOURCE_SHOP = 'shop';

    public const SOURCE_WALK_IN = 'walk_in';

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'email_verified_at' => 'datetime',
        ];
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class)->latest('placed_at');
    }

    public function addresses(): HasMany
    {
        return $this->hasMany(Address::class);
    }

    public function wishlist(): HasOne
    {
        return $this->hasOne(Wishlist::class);
    }

    /**
     * Match an existing buyer by email, or create one.
     *
     * The name and phone are REFRESHED on every order — people move and change
     * numbers, and the most recent order is the most reliable contact detail.
     * The order itself snapshots them separately, so updating here cannot
     * rewrite what a past delivery was addressed to.
     */
    public static function matchOrCreate(string $name, string $email, string $phone): self
    {
        $customer = self::firstOrNew(['email' => $email]);

        $customer->fill([
            'name' => $name,
            'phone' => $phone,
            'source' => $customer->exists ? $customer->source : self::SOURCE_SHOP,
        ]);

        $customer->save();

        return $customer;
    }
}
