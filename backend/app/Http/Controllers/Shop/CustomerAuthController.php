<?php

namespace App\Http\Controllers\Shop;

use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Address;
use App\Models\Customer;
use App\Models\DeliveryZone;
use App\Models\Order;
use App\Notifications\CustomerWelcome;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class CustomerAuthController extends Controller
{
    /**
     * POST /api/shop/auth/register
     */
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:255'],
            'phone' => ['required', 'string', 'max:32'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        /** @var Customer $customer */
        $customer = Customer::firstOrNew(['email' => $validated['email']]);

        if ($customer->exists && $customer->password !== null) {
            throw ValidationException::withMessages([
                'email' => ['An account with this email already exists. Please sign in.'],
            ]);
        }

        $customer->name = $validated['name'];
        $customer->phone = $validated['phone'];
        $customer->password = Hash::make($validated['password']);
        $customer->source = $customer->exists ? $customer->source : Customer::SOURCE_SHOP;
        $customer->save();

        try {
            $customer->notify(new CustomerWelcome($customer));
        } catch (\Throwable) {
            // Ignore notification failure during registration
        }

        $token = $customer->createToken('storefront_customer')->plainTextToken;

        return response()->json([
            'data' => [
                'customer' => [
                    'id' => $customer->id,
                    'name' => $customer->name,
                    'email' => $customer->email,
                    'phone' => $customer->phone,
                ],
                'token' => $token,
            ],
        ], 201);
    }

    /**
     * POST /api/shop/auth/login
     */
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        /** @var Customer|null $customer */
        $customer = Customer::where('email', $credentials['email'])->first();

        if (! $customer || ! $customer->password || ! Hash::check($credentials['password'], $customer->password)) {
            throw ValidationException::withMessages([
                'email' => ['These credentials do not match our records.'],
            ]);
        }

        $token = $customer->createToken('storefront_customer')->plainTextToken;

        return response()->json([
            'data' => [
                'customer' => [
                    'id' => $customer->id,
                    'name' => $customer->name,
                    'email' => $customer->email,
                    'phone' => $customer->phone,
                ],
                'token' => $token,
            ],
        ]);
    }

    /**
     * GET /api/shop/auth/me
     */
    public function me(Request $request): JsonResponse
    {
        /** @var Customer $customer */
        $customer = $request->user();

        if (! ($customer instanceof Customer)) {
            return response()->json(['message' => 'Unauthorized.'], 401);
        }

        $addresses = $customer->addresses()->with('zone')->get();
        $ordersCount = $customer->orders()->count();

        return response()->json([
            'data' => [
                'customer' => [
                    'id' => $customer->id,
                    'name' => $customer->name,
                    'email' => $customer->email,
                    'phone' => $customer->phone,
                ],
                'addresses' => $addresses,
                'orders_count' => $ordersCount,
            ],
        ]);
    }

    /**
     * POST /api/shop/auth/logout
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(['message' => 'Logged out successfully.']);
    }

    /**
     * GET /api/shop/customer/orders
     */
    public function orders(Request $request): JsonResponse
    {
        /** @var Customer $customer */
        $customer = $request->user();

        if (! ($customer instanceof Customer)) {
            return response()->json(['message' => 'Unauthorized.'], 401);
        }

        $orders = Order::where('customer_id', $customer->id)
            ->with(['items', 'address.zone'])
            ->latest('placed_at')
            ->get();

        return response()->json([
            'data' => OrderResource::collection($orders),
        ]);
    }

    /**
     * GET /api/shop/customer/orders/{reference}
     */
    public function order(Request $request, string $reference): JsonResponse
    {
        /** @var Customer $customer */
        $customer = $request->user();

        if (! ($customer instanceof Customer)) {
            return response()->json(['message' => 'Unauthorized.'], 401);
        }

        $order = Order::where('customer_id', $customer->id)
            ->where('reference', strtoupper($reference))
            ->with(['items', 'address.zone'])
            ->firstOrFail();

        $warrantyStart = $order->paid_at ?? $order->placed_at;
        $warrantyEnd = $warrantyStart ? $warrantyStart->copy()->addDays(90) : null;
        $isWarrantyActive = $warrantyEnd && now()->lt($warrantyEnd);

        $orderData = (new OrderResource($order))->toArray($request);
        $orderData['warranty'] = [
            'is_active' => $isWarrantyActive,
            'duration' => '90 Days',
            'starts_at' => $warrantyStart?->toIso8601String(),
            'expires_at' => $warrantyEnd?->toIso8601String(),
            'terms' => 'Direct hardware warranty covering motherboard, display, and charging systems. Physical/liquid damage excluded.',
            'support_whatsapp' => 'https://wa.me/2348000000000?text=Hello%20Gadgets%20Garden,%20I%20need%20warranty%20support%20for%20order%20'.$order->reference,
        ];

        return response()->json([
            'data' => $orderData,
        ]);
    }

    /**
     * POST /api/shop/customer/addresses
     */
    public function saveAddress(Request $request): JsonResponse
    {
        /** @var Customer $customer */
        $customer = $request->user();

        if (! ($customer instanceof Customer)) {
            return response()->json(['message' => 'Unauthorized.'], 401);
        }

        $validated = $request->validate([
            'delivery_zone_slug' => ['required', 'string', 'exists:delivery_zones,slug'],
            'line1' => ['required', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:120'],
            'state' => ['required', 'string', 'max:120'],
            'landmark' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $zone = DeliveryZone::where('slug', $validated['delivery_zone_slug'])->firstOrFail();

        $address = Address::create([
            'customer_id' => $customer->id,
            'delivery_zone_id' => $zone->id,
            'line1' => $validated['line1'],
            'city' => $validated['city'],
            'state' => $validated['state'],
            'landmark' => $validated['landmark'] ?? null,
            'note' => $validated['note'] ?? null,
            'is_default' => true,
        ]);

        return response()->json([
            'data' => $address->load('zone'),
        ], 201);
    }
}
