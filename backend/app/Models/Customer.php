<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A buyer. Not a login — see the migration.
 */
#[Fillable(['name', 'email', 'phone', 'source', 'note'])]
class Customer extends Model
{
    use HasFactory;

    public const SOURCE_SHOP = 'shop';

    public const SOURCE_WALK_IN = 'walk_in';

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class)->latest('placed_at');
    }

    public function addresses(): HasMany
    {
        return $this->hasMany(Address::class);
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
