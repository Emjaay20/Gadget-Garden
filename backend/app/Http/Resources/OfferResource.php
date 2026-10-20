<?php

namespace App\Http\Resources;

use App\Models\Offer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Offer
 */
class OfferResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $storefrontUrl = config('app.storefront_url', 'http://localhost:3000');
        $checkoutUrl = ($this->status === Offer::STATUS_ACCEPTED && ! $this->isExpired())
            ? "{$storefrontUrl}/checkout?offer={$this->reference}"
            : null;

        $cleanPhone = preg_replace('/[^0-9]/', '', $this->customer_phone);
        if (str_starts_with($cleanPhone, '0')) {
            $cleanPhone = '234'.substr($cleanPhone, 1);
        }

        $waShareUrl = null;
        if ($this->status === Offer::STATUS_COUNTERED && $this->counter_price) {
            $msg = rawurlencode("Hello {$this->customer_name}, regarding your offer on the {$this->product?->name} at Gadgets Garden: we have countered with ₦".number_format($this->counter_price).". View and accept here: {$storefrontUrl}/offers/{$this->reference}");
            $waShareUrl = "https://wa.me/{$cleanPhone}?text={$msg}";
        } elseif ($this->status === Offer::STATUS_ACCEPTED) {
            $msg = rawurlencode("Hello {$this->customer_name}, your offer of ₦".number_format($this->agreed_price ?? $this->offered_price)." on the {$this->product?->name} has been APPROVED! Complete your 2-hour reserved checkout here: {$checkoutUrl}");
            $waShareUrl = "https://wa.me/{$cleanPhone}?text={$msg}";
        }

        return [
            'id' => (string) $this->id,
            'reference' => $this->reference,
            'status' => $this->status,
            'customer_name' => $this->customer_name,
            'customer_email' => $this->customer_email,
            'customer_phone' => $this->customer_phone,
            'original_price' => (int) $this->original_price,
            'offered_price' => (int) $this->offered_price,
            'counter_price' => $this->counter_price !== null ? (int) $this->counter_price : null,
            'agreed_price' => $this->agreed_price !== null ? (int) $this->agreed_price : null,
            'customer_note' => $this->customer_note,
            'staff_note' => $this->staff_note,
            'expires_at' => $this->expires_at?->toIso8601String(),
            'is_expired' => $this->isExpired(),
            'is_actionable' => $this->isActionable(),
            'created_at' => $this->created_at?->toIso8601String(),
            'checkout_url' => $checkoutUrl,
            'whatsapp_url' => $waShareUrl,
            'product' => $this->whenLoaded('product', fn () => [
                'id' => (string) $this->product->id,
                'name' => $this->product->name,
                'slug' => $this->product->slug,
                'brand' => $this->product->brand,
                'price' => (int) $this->product->price,
            ]),
            'unit' => $this->whenLoaded('unit', fn () => $this->unit ? [
                'id' => (string) $this->unit->id,
                'sku' => $this->unit->sku,
                'condition' => $this->unit->condition,
                'specs' => $this->unit->specs ?? [],
                'price' => (int) $this->unit->price,
                'status' => $this->unit->status,
            ] : null),
        ];
    }
}
