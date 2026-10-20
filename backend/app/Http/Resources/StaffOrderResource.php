<?php

namespace App\Http\Resources;

use App\Models\Order;
use App\Shop\OrderTransitions;
use App\Support\Permissions;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;

/**
 * An order as STAFF see it.
 *
 * Deliberately a separate class from `OrderResource` rather than a flag on it.
 * The customer-facing one is reachable by anyone holding a reference, so the two
 * have opposite defaults: this adds the customer record, the staff note, the
 * payment trail and (behind `reports.view`) margin. Sharing one class would mean
 * one careless `when()` leaks all of that to the public endpoint.
 *
 * @mixin Order
 */
class StaffOrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $canSeeMargin = Gate::allows(Permissions::REPORTS_VIEW);

        return [
            'id' => (string) $this->id,
            'reference' => $this->reference,
            'status' => $this->status,
            'next_statuses' => OrderTransitions::nextFor($this->resource),

            'subtotal' => (int) $this->subtotal,
            'delivery_fee' => (int) $this->delivery_fee,
            'total' => (int) $this->total,
            'currency' => $this->currency,

            'contact_name' => $this->contact_name,
            'contact_email' => $this->contact_email,
            'contact_phone' => $this->contact_phone,

            'placed_at' => $this->placed_at?->toIso8601String(),
            'paid_at' => $this->paid_at?->toIso8601String(),
            'reserved_until' => $this->reserved_until?->toIso8601String(),
            'staff_note' => $this->staff_note,

            'customer' => $this->whenLoaded('customer', fn () => [
                'id' => (string) $this->customer->id,
                'name' => $this->customer->name,
                'email' => $this->customer->email,
                'phone' => $this->customer->phone,
            ]),

            'address' => $this->whenLoaded('address', fn () => [
                'line1' => $this->address->line1,
                'city' => $this->address->city,
                'state' => $this->address->state,
                'landmark' => $this->address->landmark,
                'note' => $this->address->note,
                'zone' => $this->address->relationLoaded('zone')
                    ? $this->address->zone?->name
                    : null,
            ]),

            'items' => $this->whenLoaded('items', fn () => $this->items->map(function ($item) use ($canSeeMargin) {
                $cost = $item->relationLoaded('unit') ? $item->unit?->cost : null;

                return [
                    'id' => (string) $item->id,
                    'name' => $item->name_at_time,
                    'sku' => $item->sku_at_time,
                    'condition' => $item->condition_at_time,
                    'specs' => $item->specs_at_time ?? [],
                    'unit_price' => (int) $item->unit_price_at_time,
                    'quantity' => (int) $item->quantity,
                    'line_total' => (int) $item->line_total,
                    // What the business paid, and therefore what it made. Gated:
                    // a manager fulfils orders without seeing margin.
                    'cost' => $canSeeMargin && $cost !== null ? (int) $cost : null,
                ];
            })->all()),

            'payments' => $this->whenLoaded('payments', fn () => $this->payments->map(fn ($payment) => [
                'provider' => $payment->provider,
                'status' => $payment->status,
                'amount' => (int) $payment->amount,
                'account_number' => $payment->account_number,
                'provider_transaction_id' => $payment->provider_transaction_id,
                'paid_at' => $payment->paid_at?->toIso8601String(),
                // `raw_response` and `raw_webhook` are NEVER serialised — they
                // hold the payer's own bank details. Read them from the database
                // when a human is reconciling a dispute.
            ])->all()),
        ];
    }
}
