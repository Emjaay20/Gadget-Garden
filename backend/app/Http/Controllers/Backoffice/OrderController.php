<?php

namespace App\Http\Controllers\Backoffice;

use App\Http\Controllers\Controller;
use App\Http\Resources\StaffOrderResource;
use App\Models\DeliveryZone;
use App\Models\Order;
use App\Models\Payment;
use App\Models\ProductUnit;
use App\Payments\PaymentResult;
use App\Payments\SettlesPayments;
use App\Shop\OrderTransitions;
use App\Shop\PlacesOrders;
use App\Support\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;

/**
 * Order fulfilment. Behind `orders.view` / `orders.manage`.
 */
class OrderController extends Controller
{
    public function __construct(private readonly OrderTransitions $transitions) {}

    /**
     * GET /api/orders  ?status=&search=&page=
     *
     * The fulfilment queue. Defaults to newest first, because the desk works
     * from the top of the pile.
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'string'],
            'search' => ['nullable', 'string', 'max:120'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Order::query()
            ->with(['customer', 'items', 'address.zone'])
            ->latest('placed_at');

        if ($status = $validated['status'] ?? null) {
            // `open` is the working queue: everything paid but not yet out the
            // door. It is what the desk actually wants when it opens the page.
            $query->when(
                $status === 'open',
                fn ($q) => $q->whereIn('status', [Order::PAID, Order::PROCESSING]),
                fn ($q) => $q->where('status', $status),
            );
        }

        if ($search = $validated['search'] ?? null) {
            $term = '%'.str_replace('%', '\%', $search).'%';

            $query->where(function ($q) use ($term) {
                $q->where('reference', 'ilike', $term)
                    ->orWhere('contact_name', 'ilike', $term)
                    ->orWhere('contact_email', 'ilike', $term)
                    ->orWhere('contact_phone', 'ilike', $term);
            });
        }

        $paginator = $query->paginate($validated['per_page'] ?? 25)->withQueryString();

        return response()->json([
            'data' => StaffOrderResource::collection($paginator->items())->resolve(),
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
        $order = Order::query()
            ->where('reference', strtoupper($reference))
            ->with(['customer', 'address.zone', 'items.unit', 'payments'])
            ->firstOrFail();

        return response()->json(['data' => new StaffOrderResource($order)]);
    }

    /**
     * PATCH /api/orders/{reference}   { status?, note? }
     *
     * The one way an order's status changes by hand. Every transition is checked
     * against the graph in OrderTransitions — see that class for why a shipped
     * order cannot be cancelled here.
     */
    public function update(Request $request, string $reference): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'string'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $order = Order::where('reference', strtoupper($reference))->firstOrFail();

        if (! empty($validated['status'])) {
            try {
                $oldStatus = $order->status;
                $order = $this->transitions->apply(
                    $order,
                    $validated['status'],
                    $request->user(),
                    $validated['note'] ?? null,
                );

                AuditLogger::log(
                    action: 'order.status_changed',
                    description: "Order {$order->reference} status changed from {$oldStatus} to {$order->status}",
                    auditable: $order,
                    oldValues: ['status' => $oldStatus],
                    newValues: ['status' => $order->status, 'note' => $validated['note'] ?? null],
                    user: $request->user(),
                    request: $request,
                );
            } catch (RuntimeException $e) {
                throw ValidationException::withMessages([
                    'status' => [$e->getMessage()],
                ]);
            }
        } elseif (! empty($validated['note'])) {
            // A note on its own, with no status change.
            $order->forceFill([
                'staff_note' => trim(
                    ($order->staff_note ?? '')."\n{$validated['note']} — {$request->user()->name}",
                ),
            ])->save();

            AuditLogger::log(
                action: 'order.note_added',
                description: "Staff note added to order {$order->reference}",
                auditable: $order,
                newValues: ['note' => $validated['note']],
                user: $request->user(),
                request: $request,
            );
        }

        return response()->json([
            'data' => new StaffOrderResource(
                $order->fresh(['customer', 'address.zone', 'items.unit', 'payments']),
            ),
        ]);
    }

    /**
     * POST /api/orders/{reference}/verify-offline-payment
     *
     * Reconcile an offline bank transfer, cash, or in-store POS payment.
     */
    public function verifyOfflinePayment(
        Request $request,
        string $reference,
        SettlesPayments $settlesPayments,
    ): JsonResponse {
        $validated = $request->validate([
            'method' => ['required', 'string', 'in:bank_transfer,pos_terminal,cash'],
            'transaction_reference' => ['required', 'string', 'max:120'],
            'amount_paid' => ['required', 'integer', 'min:1'],
            'bank_name' => ['nullable', 'string', 'max:100'],
            'account_name' => ['nullable', 'string', 'max:100'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $order = Order::where('reference', strtoupper($reference))
            ->with(['payments'])
            ->firstOrFail();

        if ($order->status !== Order::PENDING_PAYMENT && $order->status !== Order::FAILED) {
            throw ValidationException::withMessages([
                'order' => ["Order {$order->reference} is in status '{$order->status}' and cannot be settled."],
            ]);
        }

        $payment = Payment::create([
            'order_id' => $order->id,
            'provider' => $validated['method'],
            'provider_reference' => $order->reference,
            'provider_transaction_id' => $validated['transaction_reference'],
            'status' => 'pending',
            'amount' => $validated['amount_paid'],
            'currency' => $order->currency ?? 'NGN',
            'bank_name' => $validated['bank_name'] ?? null,
            'account_name' => $validated['account_name'] ?? null,
            'raw_response' => [
                'verified_by_id' => $request->user()->id,
                'verified_by_name' => $request->user()->name,
                'note' => $validated['note'] ?? null,
            ],
        ]);

        $result = new PaymentResult(
            status: PaymentResult::SUCCESS,
            amount: $validated['amount_paid'],
            transactionId: $validated['transaction_reference'],
            paidAt: now(),
            raw: $payment->raw_response ?? [],
        );

        $settled = $settlesPayments->settle($payment, $result);

        if (! $settled) {
            throw ValidationException::withMessages([
                'amount_paid' => ['Settlement failed. Payment amount may be less than the order total.'],
            ]);
        }

        AuditLogger::log(
            action: 'order.offline_payment_verified',
            description: "Offline {$validated['method']} payment of ₦".number_format($validated['amount_paid'])." verified for {$order->reference} (Ref: {$validated['transaction_reference']})",
            auditable: $order,
            newValues: [
                'method' => $validated['method'],
                'amount' => $validated['amount_paid'],
                'ref' => $validated['transaction_reference'],
            ],
            user: $request->user(),
            request: $request,
        );

        return response()->json([
            'data' => new StaffOrderResource(
                $order->fresh(['customer', 'address.zone', 'items.unit', 'payments']),
            ),
            'message' => 'Payment verified and order settled successfully.',
        ]);
    }

    /**
     * POST /api/orders/manual
     *
     * Create a manual order on behalf of a walk-in or WhatsApp customer.
     */
    public function storeManual(
        Request $request,
        PlacesOrders $placesOrders,
        SettlesPayments $settlesPayments,
    ): JsonResponse {
        $validated = $request->validate([
            'contact_name' => ['required', 'string', 'max:120'],
            'contact_email' => ['required', 'email', 'max:120'],
            'contact_phone' => ['required', 'string', 'max:40'],
            'delivery_type' => ['required', 'string', 'in:pickup,delivery'],
            'delivery_zone_id' => ['nullable', 'exists:delivery_zones,id'],
            'line1' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'state' => ['nullable', 'string', 'max:100'],
            'landmark' => ['nullable', 'string', 'max:255'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['nullable', 'integer', 'exists:products,id'],
            'items.*.sku' => ['nullable', 'string'],
            'items.*.quantity' => ['nullable', 'integer', 'min:1'],
            'staff_note' => ['nullable', 'string', 'max:500'],
            'immediate_payment' => ['nullable', 'boolean'],
            'payment_method' => ['required_if:immediate_payment,true', 'nullable', 'string', 'in:bank_transfer,pos_terminal,cash'],
            'transaction_reference' => ['required_if:immediate_payment,true', 'nullable', 'string', 'max:120'],
        ]);

        if ($validated['delivery_type'] === 'pickup') {
            $zone = DeliveryZone::where('slug', 'pickup-store')->first()
                ?? DeliveryZone::firstOrCreate(
                    ['slug' => 'pickup-store'],
                    ['name' => 'In-Store Pickup (Computer Village)', 'fee' => 0, 'is_active' => true, 'position' => 0]
                );
            $address = [
                'line1' => '12 Oshitelu Street, Computer Village',
                'city' => 'Ikeja',
                'state' => 'Lagos',
                'landmark' => 'Adjacent GTBank',
                'note' => 'Store Pickup',
            ];
        } else {
            if (empty($validated['delivery_zone_id']) || empty($validated['line1']) || empty($validated['city']) || empty($validated['state'])) {
                throw ValidationException::withMessages([
                    'delivery_type' => ['Delivery address and zone are required for delivery orders.'],
                ]);
            }
            $zone = DeliveryZone::findOrFail($validated['delivery_zone_id']);
            $address = [
                'line1' => $validated['line1'],
                'city' => $validated['city'],
                'state' => $validated['state'],
                'landmark' => $validated['landmark'] ?? null,
                'note' => null,
            ];
        }

        $contact = [
            'name' => $validated['contact_name'],
            'email' => $validated['contact_email'],
            'phone' => $validated['contact_phone'],
        ];

        $cartItems = collect($validated['items'])->map(function (array $item) {
            if (! empty($item['sku']) && empty($item['product_unit_id'])) {
                $unit = ProductUnit::where('sku', $item['sku'])->first();
                if ($unit) {
                    $item['product_unit_id'] = $unit->id;
                    $item['product_id'] = $unit->product_id;
                }
            }

            return $item;
        })->all();

        $order = $placesOrders->place(
            $cartItems,
            $contact,
            $address,
            $zone,
        );

        if (! empty($validated['staff_note'])) {
            $order->forceFill([
                'staff_note' => trim($validated['staff_note']." — {$request->user()->name}"),
            ])->save();
        }

        AuditLogger::log(
            action: 'order.manual_created',
            description: "Manual order {$order->reference} created for {$order->contact_name} (Total: ₦".number_format($order->total).")",
            auditable: $order,
            newValues: ['reference' => $order->reference, 'total' => $order->total, 'delivery_type' => $validated['delivery_type']],
            user: $request->user(),
            request: $request,
        );

        if (! empty($validated['immediate_payment'])) {
            $payment = Payment::create([
                'order_id' => $order->id,
                'provider' => $validated['payment_method'],
                'provider_reference' => $order->reference,
                'provider_transaction_id' => $validated['transaction_reference'] ?? ('MAN-'.strtoupper(Str::random(8))),
                'status' => 'pending',
                'amount' => $order->total,
                'currency' => $order->currency ?? 'NGN',
                'raw_response' => [
                    'recorded_by' => $request->user()->id,
                    'recorded_by_name' => $request->user()->name,
                ],
            ]);

            $result = new PaymentResult(
                status: PaymentResult::SUCCESS,
                amount: $order->total,
                transactionId: $payment->provider_transaction_id,
                paidAt: now(),
                raw: $payment->raw_response ?? [],
            );

            $settlesPayments->settle($payment, $result);
            $order->refresh();
        }

        $storefrontUrl = config('app.storefront_url', 'http://localhost:3000');
        $payUrl = "{$storefrontUrl}/orders/{$order->reference}";
        $cleanPhone = preg_replace('/[^0-9]/', '', $order->contact_phone);
        if (str_starts_with($cleanPhone, '0')) {
            $cleanPhone = '234'.substr($cleanPhone, 1);
        }
        $waMessage = rawurlencode("Hello {$order->contact_name}, your order with Gadgets Garden ({$order->reference}) for ₦".number_format($order->total)." has been prepared. Complete your payment here: {$payUrl}");
        $waShareUrl = "https://wa.me/{$cleanPhone}?text={$waMessage}";

        return response()->json([
            'data' => new StaffOrderResource(
                $order->fresh(['customer', 'address.zone', 'items.unit', 'payments']),
            ),
            'pay_url' => $payUrl,
            'whatsapp_url' => $waShareUrl,
        ], 201);
    }

    /**
     * How many orders sit in each status — drives the queue tabs.
     *
     * @return array<string, int>
     */
    private function counts(): array
    {
        $rows = Order::query()
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return [
            'pending_payment' => (int) ($rows[Order::PENDING_PAYMENT] ?? 0),
            'paid' => (int) ($rows[Order::PAID] ?? 0),
            'processing' => (int) ($rows[Order::PROCESSING] ?? 0),
            'shipped' => (int) ($rows[Order::SHIPPED] ?? 0),
            'delivered' => (int) ($rows[Order::DELIVERED] ?? 0),
            'open' => (int) ($rows[Order::PAID] ?? 0) + (int) ($rows[Order::PROCESSING] ?? 0),
        ];
    }
}
