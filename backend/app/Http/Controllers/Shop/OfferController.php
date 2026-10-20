<?php

namespace App\Http\Controllers\Shop;

use App\Http\Controllers\Controller;
use App\Http\Resources\OfferResource;
use App\Models\Offer;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Support\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class OfferController extends Controller
{
    /**
     * POST /api/shop/offers
     *
     * Customer submits an offer on a product or unit.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'product_unit_id' => ['nullable', 'integer', 'exists:product_units,id'],
            'customer_name' => ['required', 'string', 'max:120'],
            'customer_email' => ['required', 'email', 'max:120'],
            'customer_phone' => ['required', 'string', 'max:40'],
            'offered_price' => ['required', 'integer', 'min:10000'],
            'customer_note' => ['nullable', 'string', 'max:500'],
        ]);

        $product = Product::with(['units'])->findOrFail($validated['product_id']);

        $unit = null;
        if (! empty($validated['product_unit_id'])) {
            $unit = ProductUnit::where('product_id', $product->id)
                ->where('id', $validated['product_unit_id'])
                ->firstOrFail();

            if ($unit->status !== ProductUnit::STATUS_AVAILABLE) {
                throw ValidationException::withMessages([
                    'product_unit_id' => ['This specific laptop unit is no longer available.'],
                ]);
            }
        }

        $originalPrice = (int) ($unit ? $unit->price : $product->price);
        $offeredPrice = (int) $validated['offered_price'];

        // Automatic Rules:
        // 1. Minimum floor: below 70% of list price is auto-declined
        // 2. Auto-accept: within 5% of list price is auto-accepted immediately
        $status = Offer::STATUS_PENDING;
        $agreedPrice = null;
        $expiresAt = null;
        $staffNote = null;

        if ($offeredPrice < (int) ($originalPrice * 0.70)) {
            $status = Offer::STATUS_DECLINED;
            $staffNote = 'Auto-declined: Offer is below our minimum wholesale/retail margin threshold.';
        } elseif ($offeredPrice >= (int) ($originalPrice * 0.95)) {
            $status = Offer::STATUS_ACCEPTED;
            $agreedPrice = $offeredPrice;
            $expiresAt = now()->addHours(2);
            $staffNote = 'Auto-accepted: Offer within pre-approved discount ceiling (5%).';
        }

        $offer = Offer::create([
            'reference' => Offer::generateReference(),
            'product_id' => $product->id,
            'product_unit_id' => $unit?->id,
            'customer_name' => $validated['customer_name'],
            'customer_email' => $validated['customer_email'],
            'customer_phone' => $validated['customer_phone'],
            'original_price' => $originalPrice,
            'offered_price' => $offeredPrice,
            'agreed_price' => $agreedPrice,
            'status' => $status,
            'customer_note' => $validated['customer_note'] ?? null,
            'staff_note' => $staffNote,
            'expires_at' => $expiresAt,
        ]);

        AuditLogger::log(
            action: 'offer.submitted',
            description: "Offer {$offer->reference} submitted by {$offer->customer_name} for {$product->name} (Offered: ₦".number_format($offeredPrice).", Original: ₦".number_format($originalPrice).", Status: {$status})",
            auditable: $offer,
            newValues: ['reference' => $offer->reference, 'status' => $status, 'offered_price' => $offeredPrice],
        );

        return response()->json([
            'data' => new OfferResource($offer->load(['product', 'unit'])),
            'message' => match ($status) {
                Offer::STATUS_ACCEPTED => 'Congratulations! Your offer was accepted immediately. Complete checkout within 2 hours.',
                Offer::STATUS_DECLINED => 'Your offer is below our minimum threshold for this machine. Please consider submitting a revised offer.',
                default => 'Your offer has been received and routed to our sales desk. We will respond shortly via WhatsApp/SMS.',
            },
        ], 201);
    }

    /**
     * GET /api/shop/offers/{reference}
     */
    public function show(string $reference): JsonResponse
    {
        $offer = Offer::where('reference', strtoupper($reference))
            ->with(['product', 'unit'])
            ->firstOrFail();

        return response()->json([
            'data' => new OfferResource($offer),
        ]);
    }

    /**
     * POST /api/shop/offers/{reference}/accept-counter
     *
     * Customer accepts a store counter-offer.
     */
    public function acceptCounter(string $reference): JsonResponse
    {
        $offer = Offer::where('reference', strtoupper($reference))
            ->with(['product', 'unit'])
            ->firstOrFail();

        if ($offer->status !== Offer::STATUS_COUNTERED || ! $offer->counter_price) {
            throw ValidationException::withMessages([
                'offer' => ['Only countered offers can be accepted.'],
            ]);
        }

        $offer->forceFill([
            'status' => Offer::STATUS_ACCEPTED,
            'agreed_price' => $offer->counter_price,
            'expires_at' => now()->addHours(2),
        ])->save();

        AuditLogger::log(
            action: 'offer.counter_accepted_by_customer',
            description: "Customer {$offer->customer_name} accepted counter-offer of ₦".number_format($offer->counter_price)." for {$offer->reference}",
            auditable: $offer,
            newValues: ['status' => Offer::STATUS_ACCEPTED, 'agreed_price' => $offer->counter_price],
        );

        return response()->json([
            'data' => new OfferResource($offer->fresh(['product', 'unit'])),
            'message' => 'Counter-offer accepted! Complete checkout within 2 hours.',
        ]);
    }
}
