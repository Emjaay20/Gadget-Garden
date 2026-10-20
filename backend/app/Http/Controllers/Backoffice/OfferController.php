<?php

namespace App\Http\Controllers\Backoffice;

use App\Http\Controllers\Controller;
use App\Http\Resources\OfferResource;
use App\Models\Offer;
use App\Support\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class OfferController extends Controller
{
    /**
     * GET /api/offers
     *
     * List customer offers for the backoffice negotiation desk.
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'string'],
            'search' => ['nullable', 'string', 'max:120'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Offer::query()
            ->with(['product', 'unit', 'responder'])
            ->latest('id');

        if ($status = $validated['status'] ?? null) {
            $query->when(
                $status === 'actionable',
                fn ($q) => $q->whereIn('status', [Offer::STATUS_PENDING, Offer::STATUS_COUNTERED]),
                fn ($q) => $q->where('status', $status),
            );
        }

        if ($search = $validated['search'] ?? null) {
            $term = '%'.str_replace('%', '\%', $search).'%';
            $query->where(function ($q) use ($term) {
                $q->where('reference', 'ilike', $term)
                    ->orWhere('customer_name', 'ilike', $term)
                    ->orWhere('customer_phone', 'ilike', $term)
                    ->orWhereHas('product', fn ($pq) => $pq->where('name', 'ilike', $term));
            });
        }

        $paginator = $query->paginate($validated['per_page'] ?? 25)->withQueryString();

        return response()->json([
            'data' => OfferResource::collection($paginator->items())->resolve(),
            'meta' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'counts' => $this->counts(),
            ],
        ]);
    }

    public function show(string $reference): JsonResponse
    {
        $offer = Offer::where('reference', strtoupper($reference))
            ->with(['product', 'unit', 'responder'])
            ->firstOrFail();

        return response()->json([
            'data' => new OfferResource($offer),
        ]);
    }

    /**
     * POST /api/offers/{reference}/accept
     *
     * Staff accepts the customer's offer.
     */
    public function accept(Request $request, string $reference): JsonResponse
    {
        $validated = $request->validate([
            'staff_note' => ['nullable', 'string', 'max:500'],
        ]);

        $offer = Offer::where('reference', strtoupper($reference))
            ->with(['product', 'unit'])
            ->firstOrFail();

        if (! in_array($offer->status, [Offer::STATUS_PENDING, Offer::STATUS_COUNTERED], true)) {
            throw ValidationException::withMessages([
                'status' => ["Offer in status '{$offer->status}' cannot be accepted."],
            ]);
        }

        $offer->forceFill([
            'status' => Offer::STATUS_ACCEPTED,
            'agreed_price' => $offer->offered_price,
            'responded_by' => $request->user()->id,
            'staff_note' => $validated['staff_note'] ?? $offer->staff_note,
            'expires_at' => now()->addHours(2),
        ])->save();

        AuditLogger::log(
            action: 'offer.accepted_by_staff',
            description: "Offer {$offer->reference} accepted by {$request->user()->name} at ₦".number_format($offer->offered_price),
            auditable: $offer,
            newValues: ['status' => Offer::STATUS_ACCEPTED, 'agreed_price' => $offer->offered_price],
            user: $request->user(),
            request: $request,
        );

        return response()->json([
            'data' => new OfferResource($offer->fresh(['product', 'unit', 'responder'])),
            'message' => 'Offer accepted! 2-hour checkout lock is active.',
        ]);
    }

    /**
     * POST /api/offers/{reference}/counter
     *
     * Staff sends a counter-offer.
     */
    public function counter(Request $request, string $reference): JsonResponse
    {
        $validated = $request->validate([
            'counter_price' => ['required', 'integer', 'min:10000'],
            'staff_note' => ['nullable', 'string', 'max:500'],
        ]);

        $offer = Offer::where('reference', strtoupper($reference))
            ->with(['product', 'unit'])
            ->firstOrFail();

        if (! in_array($offer->status, [Offer::STATUS_PENDING, Offer::STATUS_COUNTERED], true)) {
            throw ValidationException::withMessages([
                'status' => ["Offer in status '{$offer->status}' cannot be countered."],
            ]);
        }

        if ($validated['counter_price'] <= $offer->offered_price) {
            throw ValidationException::withMessages([
                'counter_price' => ['Counter-offer must be higher than the customer\'s current offer.'],
            ]);
        }

        $offer->forceFill([
            'status' => Offer::STATUS_COUNTERED,
            'counter_price' => $validated['counter_price'],
            'responded_by' => $request->user()->id,
            'staff_note' => $validated['staff_note'] ?? $offer->staff_note,
        ])->save();

        AuditLogger::log(
            action: 'offer.countered_by_staff',
            description: "Offer {$offer->reference} countered by {$request->user()->name} at ₦".number_format($validated['counter_price']),
            auditable: $offer,
            newValues: ['status' => Offer::STATUS_COUNTERED, 'counter_price' => $validated['counter_price']],
            user: $request->user(),
            request: $request,
        );

        return response()->json([
            'data' => new OfferResource($offer->fresh(['product', 'unit', 'responder'])),
            'message' => 'Counter-offer recorded successfully.',
        ]);
    }

    /**
     * POST /api/offers/{reference}/decline
     *
     * Staff declines the customer's offer.
     */
    public function decline(Request $request, string $reference): JsonResponse
    {
        $validated = $request->validate([
            'staff_note' => ['nullable', 'string', 'max:500'],
        ]);

        $offer = Offer::where('reference', strtoupper($reference))
            ->with(['product', 'unit'])
            ->firstOrFail();

        $offer->forceFill([
            'status' => Offer::STATUS_DECLINED,
            'responded_by' => $request->user()->id,
            'staff_note' => $validated['staff_note'] ?? $offer->staff_note,
        ])->save();

        AuditLogger::log(
            action: 'offer.declined_by_staff',
            description: "Offer {$offer->reference} declined by {$request->user()->name}",
            auditable: $offer,
            newValues: ['status' => Offer::STATUS_DECLINED],
            user: $request->user(),
            request: $request,
        );

        return response()->json([
            'data' => new OfferResource($offer->fresh(['product', 'unit', 'responder'])),
            'message' => 'Offer declined.',
        ]);
    }

    private function counts(): array
    {
        $rows = Offer::query()
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return [
            'pending' => (int) ($rows[Offer::STATUS_PENDING] ?? 0),
            'countered' => (int) ($rows[Offer::STATUS_COUNTERED] ?? 0),
            'accepted' => (int) ($rows[Offer::STATUS_ACCEPTED] ?? 0),
            'declined' => (int) ($rows[Offer::STATUS_DECLINED] ?? 0),
            'actionable' => (int) ($rows[Offer::STATUS_PENDING] ?? 0) + (int) ($rows[Offer::STATUS_COUNTERED] ?? 0),
        ];
    }
}
