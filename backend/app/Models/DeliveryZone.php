<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['slug', 'name', 'fee', 'free_above', 'is_active', 'position'])]
class DeliveryZone extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /**
     * What this zone costs for a given order subtotal.
     *
     * Computed server-side at checkout from the zone row, never from anything
     * the browser sends.
     */
    public function feeFor(int $subtotal): int
    {
        if ($this->free_above !== null && $subtotal >= $this->free_above) {
            return 0;
        }

        return (int) $this->fee;
    }

    /** @param  Builder<DeliveryZone>  $query */
    public function scopeActive(Builder $query): void
    {
        $query->where('is_active', true);
    }

    /** @param  Builder<DeliveryZone>  $query */
    public function scopeOrdered(Builder $query): void
    {
        $query->orderBy('position')->orderBy('name');
    }
}
