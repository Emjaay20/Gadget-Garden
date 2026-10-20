<?php

namespace App\Http\Controllers\Shop;

use App\Http\Controllers\Controller;
use App\Http\Requests\PlaceOrderRequest;
use App\Http\Resources\OrderResource;
use App\Models\DeliveryZone;
use App\Models\Order;
use App\Shop\CartUnavailableException;
use App\Shop\PlacesOrders;
use App\Shop\ResolvesCart;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Cart validation, checkout, and order status. All public — there are no
 * customer accounts.
 */
class OrderController extends Controller
{
    public function __construct(
        private readonly ResolvesCart $cart,
        private readonly PlacesOrders $orders,
    ) {}

    /**
     * POST /api/shop/cart
     *
     * Re-prices and re-checks a cart. The storefront calls this whenever the
     * cart page renders, so a machine somebody else bought is flagged BEFORE
     * checkout rather than after the customer has typed their address.
     *
     * Not a mutation despite the verb: POST because a cart can hold more items
     * than fit comfortably in a query string.
     */
    public function validateCart(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'items' => ['present', 'array', 'max:20'],
            'items.*.product_id' => ['nullable', 'integer'],
            'items.*.product_unit_id' => ['nullable', 'integer'],
            'items.*.quantity' => ['nullable', 'integer', 'min:1', 'max:20'],
            'delivery_zone' => ['nullable', 'string', 'exists:delivery_zones,slug'],
        ]);

        $lines = $this->cart->resolve($validated['items']);

        // Unavailable lines contribute nothing — a total that includes a laptop
        // that has already sold is a number nobody can pay.
        $subtotal = $lines
            ->filter(fn ($line) => $line->isAvailable())
            ->sum(fn ($line) => $line->lineTotal());

        $zone = isset($validated['delivery_zone'])
            ? DeliveryZone::where('slug', $validated['delivery_zone'])->first()
            : null;

        $deliveryFee = $this->cart->deliveryFee($zone, $subtotal);

        return response()->json([
            'data' => [
                'lines' => $lines->map->toArray()->all(),
                'subtotal' => $subtotal,
                'delivery_fee' => $deliveryFee,
                'total' => $subtotal + $deliveryFee,
                'currency' => 'NGN',
                'has_problems' => $lines->contains(fn ($line) => ! $line->isAvailable()),
            ],
        ]);
    }

    /**
     * POST /api/shop/orders
     *
     * Creates the order and reserves any serialized machines in it. Returns 201
     * with the reference the customer then pays against.
     */
    public function store(PlaceOrderRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $zone = DeliveryZone::where('slug', $validated['delivery_zone'])->firstOrFail();

        try {
            $order = $this->orders->place(
                items: $validated['items'],
                contact: $validated['contact'],
                address: $validated['address'],
                zone: $zone,
                offerReference: $validated['offer_reference'] ?? null,
            );
        } catch (CartUnavailableException $e) {
            // 422, not 409: the storefront's error handling already parses this
            // shape, and from the customer's side it IS a problem with what they
            // submitted — just not one they could have known about.
            return response()->json($e->toArray(), 422);
        }

        return response()->json([
            'data' => new OrderResource($order->load('items', 'address.zone')),
        ], 201);
    }

    /**
     * GET /api/shop/orders/{reference}
     *
     * The order status page. Anyone holding the reference can read it, so the
     * resource carries only what the buyer already knows — and the reference is
     * random enough not to be guessable.
     */
    public function show(string $reference): JsonResponse
    {
        $order = Order::query()
            ->where('reference', $reference)
            ->with(['items', 'address.zone'])
            ->firstOrFail();

        return response()->json(['data' => new OrderResource($order)]);
    }
}
