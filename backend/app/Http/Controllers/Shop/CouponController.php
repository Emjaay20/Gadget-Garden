<?php

namespace App\Http\Controllers\Shop;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use App\Models\DeliveryZone;
use App\Shop\ResolvesCart;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CouponController extends Controller
{
    public function __construct(private readonly ResolvesCart $cart) {}

    /**
     * POST /api/shop/coupons/validate
     */
    public function validateCoupon(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:50'],
            'email' => ['nullable', 'email'],
            'items' => ['nullable', 'array', 'max:20'],
            'delivery_zone' => ['nullable', 'string', 'exists:delivery_zones,slug'],
        ]);

        $coupon = Coupon::where('code', strtoupper(trim($validated['code'])))->first();

        if (! $coupon) {
            return response()->json([
                'valid' => false,
                'message' => 'The promo code entered does not exist.',
            ], 422);
        }

        $subtotal = 0;
        if (! empty($validated['items'])) {
            $lines = $this->cart->resolve($validated['items']);
            $subtotal = $lines
                ->filter(fn ($line) => $line->isAvailable())
                ->sum(fn ($line) => $line->lineTotal());
        }

        $check = $coupon->validateFor($subtotal, $validated['email'] ?? null);

        if (! $check['valid']) {
            return response()->json([
                'valid' => false,
                'message' => $check['error'],
            ], 422);
        }

        $zone = isset($validated['delivery_zone'])
            ? DeliveryZone::where('slug', $validated['delivery_zone'])->first()
            : null;
        $deliveryFee = $this->cart->deliveryFee($zone, $subtotal);
        $total = max(0, $subtotal + $deliveryFee - $check['discount']);

        return response()->json([
            'valid' => true,
            'data' => [
                'code' => $coupon->code,
                'description' => $coupon->description,
                'type' => $coupon->type,
                'value' => $coupon->value,
                'discount_amount' => $check['discount'],
                'subtotal' => $subtotal,
                'delivery_fee' => $deliveryFee,
                'total' => $total,
            ],
        ]);
    }
}
