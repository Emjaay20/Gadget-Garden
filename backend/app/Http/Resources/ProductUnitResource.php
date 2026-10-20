<?php

namespace App\Http\Resources;

use App\Models\ProductUnit;
use App\Support\Permissions;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;

/**
 * A single machine, as the storefront sees it.
 *
 * WHAT IS DELIBERATELY ABSENT:
 *
 *   - `cost` — what the business paid. Gated behind `reports.view` and therefore
 *     never present for an anonymous storefront request.
 *   - `serial` / `imei` — device identifiers. They belong to the warranty record
 *     and to a stolen-goods claim, not to a public listing, and publishing them
 *     would let anyone clone a machine's identity in a resale listing.
 *   - `order_id` — who bought it.
 *
 * The staff view adds them back through `forStaff()`, which is the only path.
 *
 * @mixin ProductUnit
 */
class ProductUnitResource extends JsonResource
{
    private bool $staffView = false;

    /**
     * Opt in to the staff fields. Explicit rather than sniffing the request,
     * so a public endpoint cannot leak them by accident of context.
     */
    public function forStaff(): static
    {
        $this->staffView = true;

        return $this;
    }

    public function toArray(Request $request): array
    {
        $payload = [
            'id' => (string) $this->id,
            'sku' => $this->sku,
            'condition' => $this->condition,
            'grade' => $this->grade,
            'specs' => $this->specs ?? [],
            'price' => (int) $this->price,
            'status' => $this->status,
            'is_available' => $this->status === ProductUnit::STATUS_AVAILABLE,
            'images' => ProductImageResource::collection($this->whenLoaded('images')),
        ];

        if (! $this->staffView) {
            return $payload;
        }

        return $payload + [
            'serial' => $this->serial,
            'imei' => $this->imei,
            'note' => $this->note,
            'reserved_until' => $this->reserved_until?->toIso8601String(),
            'order_id' => $this->order_id === null ? null : (string) $this->order_id,
            'created_at' => $this->created_at?->toIso8601String(),

            // Margin data. A manager may move this unit around without being
            // able to see what it cost, so the check is per-field, not per-view.
            'cost' => Gate::allows(Permissions::REPORTS_VIEW)
                ? ($this->cost === null ? null : (int) $this->cost)
                : null,
        ];
    }
}
