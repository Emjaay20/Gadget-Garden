<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'customer_id', 'delivery_zone_id', 'line1', 'city',
    'state', 'landmark', 'note', 'is_default',
])]
class Address extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return ['is_default' => 'boolean'];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function zone(): BelongsTo
    {
        return $this->belongsTo(DeliveryZone::class, 'delivery_zone_id');
    }

    /** One line, for an order summary or a delivery note. */
    public function oneLine(): string
    {
        return collect([$this->line1, $this->landmark, $this->city, $this->state])
            ->filter()
            ->implode(', ');
    }
}
