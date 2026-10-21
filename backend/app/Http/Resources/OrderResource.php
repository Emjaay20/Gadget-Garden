<?php

namespace App\Http\Resources;

use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * An order, as the customer sees it on the confirmation and status pages.
 *
 * This endpoint is reachable by anyone holding the reference, so it carries only
 * what the buyer already knows: what they ordered, what it cost, where it is
 * going, and what is happening next. No `cost`, no internal notes, no customer
 * id.
 *
 * @mixin Order
 */
class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'reference' => $this->reference,
            'status' => $this->status,
            'status_label' => self::LABELS[$this->status] ?? $this->status,

            'subtotal' => (int) $this->subtotal,
            'delivery_fee' => (int) $this->delivery_fee,
            'coupon_code' => $this->coupon_code,
            'discount_amount' => (int) ($this->discount_amount ?? 0),
            'total' => (int) $this->total,
            'currency' => $this->currency,
            'payment_mode' => $this->payment_mode,
            'layaway_paid_amount' => (int) $this->layaway_paid_amount,
            'layaway_balance' => $this->isLayaway() ? $this->layawayBalance() : null,
            'layaway_minimum_payment' => $this->layaway_minimum_payment === null ? null : (int) $this->layaway_minimum_payment,
            'layaway_due_at' => $this->layaway_due_at?->toIso8601String(),

            'contact_name' => $this->contact_name,
            'contact_email' => $this->contact_email,
            'contact_phone' => $this->contact_phone,

            'placed_at' => $this->placed_at?->toIso8601String(),
            'paid_at' => $this->paid_at?->toIso8601String(),
            // What the pay screen counts down to.
            'reserved_until' => $this->reserved_until?->toIso8601String(),

            'address' => $this->whenLoaded('address', fn () => [
                'line1' => $this->address->line1,
                'city' => $this->address->city,
                'state' => $this->address->state,
                'landmark' => $this->address->landmark,
                'zone' => $this->address->relationLoaded('zone')
                    ? $this->address->zone?->name
                    : null,
            ]),

            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn ($item) => [
                'name' => $item->name_at_time,
                'sku' => $item->sku_at_time,
                'condition' => $item->condition_at_time,
                'specs' => $item->specs_at_time ?? [],
                'unit_price' => (int) $item->unit_price_at_time,
                'quantity' => (int) $item->quantity,
                'line_total' => (int) $item->line_total,
            ])->all()),
        ];
    }

    private const LABELS = [
        Order::PENDING_PAYMENT => 'Awaiting payment',
        Order::PAID => 'Paid',
        Order::PROCESSING => 'Being prepared',
        Order::SHIPPED => 'On its way',
        Order::DELIVERED => 'Delivered',
        Order::FAILED => 'Payment failed',
        Order::CANCELLED => 'Cancelled',
    ];
}
