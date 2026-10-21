<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Wishlist extends Model
{
    use HasFactory;

    protected $fillable = ['customer_id', 'share_slug', 'title', 'is_public', 'share_expires_at'];

    protected $attributes = [
        'title' => 'My wishlist',
        'is_public' => false,
    ];

    protected function casts(): array
    {
        return ['is_public' => 'boolean', 'share_expires_at' => 'datetime'];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(WishlistItem::class);
    }

    public static function newShareSlug(): string
    {
        do {
            $slug = Str::lower(Str::random(16));
        } while (self::where('share_slug', $slug)->exists());

        return $slug;
    }

    public function canBeViewedPublicly(): bool
    {
        return $this->is_public
            && ($this->share_expires_at === null || $this->share_expires_at->isFuture());
    }
}
