<?php

namespace App\Shop;

use App\Models\Address;
use App\Models\Coupon;
use App\Models\Customer;
use App\Models\DeliveryZone;
use App\Models\Offer;
use App\Models\Order;
use App\Models\ProductUnit;
use App\Support\AuditLogger;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Turns a cart into an order.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE RESERVATION RULE, AND WHY IT DIFFERS BY STOCK TYPE
 *
 * Quantity stock (chargers, bags) is NOT held at checkout. Decrementing before
 * payment would let anyone empty the shop by filling carts they never pay for,
 * and there is no harm in two people reaching the pay screen for the twelfth
 * charger — the stock decrement happens on payment, and either both succeed or
 * one is short and the ledger records it.
 *
 * Serialized stock is the opposite. There is exactly ONE of each machine, so two
 * customers reaching the pay screen for the same ₦1.9m laptop means one of them
 * pays for something that cannot ship. So a unit is RESERVED here, at order
 * creation, with a `reserved_until`, and `orders:expire-unpaid` releases it if
 * the money never arrives.
 *
 * The race is closed by `ProductUnit::reserveFor()`, which re-reads the row
 * under `lockForUpdate` inside its own transaction: the second caller blocks
 * until the first commits, then sees `reserved` and is refused.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Money is recomputed here from the database and never read from the request.
 */
class PlacesOrders
{
    public function __construct(private readonly ResolvesCart $cart) {}

    /**
     * @param  array<int, array<string, mixed>>  $items
     * @param  array{name: string, email: string, phone: string}  $contact
     * @param  array{line1: string, city: string, state: string, landmark?: ?string, note?: ?string}  $address
     *
     * @throws CartUnavailableException
     */
    public function place(
        array $items,
        array $contact,
        array $address,
        DeliveryZone $zone,
        ?string $offerReference = null,
        ?string $couponCode = null,
        string $paymentMode = Order::PAYMENT_MODE_FULL,
    ): Order {
        // Resolved OUTSIDE the transaction first, so an obviously dead cart is
        // rejected without taking any locks.
        $lines = $this->cart->resolve($items);

        if ($lines->isEmpty()) {
            throw new CartUnavailableException([]);
        }

        if ($lines->contains(fn (CartLine $line) => ! $line->isAvailable())) {
            throw new CartUnavailableException($lines->map->toArray()->all());
        }

        $offer = null;
        if ($offerReference) {
            $offer = Offer::where('reference', strtoupper($offerReference))
                ->where('status', Offer::STATUS_ACCEPTED)
                ->first();

            if (! $offer || $offer->isExpired()) {
                throw new CartUnavailableException([
                    ['problem' => 'The agreed offer is either expired or invalid.'],
                ]);
            }
        }

        $coupon = null;
        if ($couponCode) {
            $coupon = Coupon::where('code', strtoupper(trim($couponCode)))
                ->where('is_active', true)
                ->first();

            if (! $coupon) {
                throw new CartUnavailableException([
                    ['problem' => 'The coupon code entered is invalid or inactive.'],
                ]);
            }
        }

        try {
            if ($paymentMode === Order::PAYMENT_MODE_LAYAWAY) {
                $this->assertLayawayEligible($lines);
            }

            return $this->placeInTransaction($lines, $contact, $address, $zone, $offer, $coupon, $paymentMode);
        } catch (UnitTakenException) {
            /*
             | Someone else got the machine between our availability check and
             | our lock. The transaction has already rolled back by the time we
             | are here, so the cart is re-resolved against CURRENT state —
             | inside the doomed transaction it would have reported stale rows.
             */
            throw new CartUnavailableException(
                $this->cart->resolve($this->itemsFromLines($lines))->map->toArray()->all(),
            );
        }
    }

    /**
     * @param  Collection<int, CartLine>  $lines
     * @param  array{name: string, email: string, phone: string}  $contact
     * @param  array{line1: string, city: string, state: string, landmark?: ?string, note?: ?string}  $address
     */
    private function placeInTransaction(
        $lines,
        array $contact,
        array $address,
        DeliveryZone $zone,
        ?Offer $offer = null,
        ?Coupon $coupon = null,
        string $paymentMode = Order::PAYMENT_MODE_FULL,
    ): Order {
        return DB::transaction(function () use ($lines, $contact, $address, $zone, $offer, $coupon, $paymentMode) {
            $isLayaway = $paymentMode === Order::PAYMENT_MODE_LAYAWAY;
            $reservedUntil = $isLayaway
                ? now()->addDays((int) config('shop.layaway.term_days'))
                : now()->addHours(config('shop.unpaid_order_ttl_hours'));

            $customer = Customer::matchOrCreate(
                $contact['name'],
                $contact['email'],
                $contact['phone'],
            );

            $order = new Order([
                'reference' => Order::generateReference(),
                'customer_id' => $customer->id,
                // Filled in below — the address needs the order's zone, and the
                // order needs the address id. Two steps, one transaction.
                'address_id' => null,
                'subtotal' => 0,
                'delivery_fee' => 0,
                'total' => 0,
                'contact_name' => $contact['name'],
                'contact_email' => $contact['email'],
                'contact_phone' => $contact['phone'],
                'placed_at' => now(),
                'reserved_until' => $reservedUntil,
                'payment_mode' => $paymentMode,
                'layaway_due_at' => $isLayaway ? $reservedUntil : null,
            ]);

            $order->save();

            /*
             | RESERVE FIRST, then price. If a machine is taken between the
             | availability check above and this moment, the whole transaction
             | rolls back and the customer is told which line failed — rather
             | than being handed a payable order for a laptop that is gone.
             */
            foreach ($lines as $line) {
                if (! $line->unit) {
                    continue;
                }

                $reserved = $line->unit->reserveFor(
                    $order->id,
                    $order->reference,
                    $reservedUntil,
                );

                if (! $reserved) {
                    /*
                     | Throw rather than calling DB::rollBack() by hand: the
                     | transaction wrapper owns the rollback, and unwinding it
                     | manually from inside leaves the manager's nesting counter
                     | out of step with reality. The caller catches this and
                     | reports against freshly-read state.
                     */
                    throw new UnitTakenException;
                }
            }

            $addressRow = Address::create([
                'customer_id' => $customer->id,
                'delivery_zone_id' => $zone->id,
                'line1' => $address['line1'],
                'city' => $address['city'],
                'state' => $address['state'],
                'landmark' => $address['landmark'] ?? null,
                'note' => $address['note'] ?? null,
                'is_default' => true,
            ]);

            $subtotal = 0;
            foreach ($lines as $line) {
                $unitPrice = $line->unitPrice;
                if ($offer && ($offer->product_id === $line->product->id) && (! $offer->product_unit_id || $offer->product_unit_id === $line->unit?->id)) {
                    $unitPrice = $offer->agreed_price ?? $offer->offered_price;
                }
                $lineTotal = $unitPrice * $line->quantity;
                $subtotal += $lineTotal;

                $order->items()->create([
                    'product_id' => $line->product->id,
                    'product_unit_id' => $line->unit?->id,
                    'name_at_time' => $line->product->name,
                    'sku_at_time' => $line->unit?->sku,
                    'specs_at_time' => $line->unit?->specs ?? $line->product->base_specs,
                    'condition_at_time' => $line->unit?->condition,
                    'unit_price_at_time' => $unitPrice,
                    'quantity' => $line->quantity,
                    'line_total' => $lineTotal,
                ]);
            }

            $deliveryFee = $this->cart->deliveryFee($zone, $subtotal);

            $discountAmount = 0;
            $appliedCouponCode = null;

            if ($coupon) {
                $validation = $coupon->validateFor($subtotal, $contact['email']);
                if (! $validation['valid']) {
                    throw new CartUnavailableException([
                        ['problem' => $validation['error'] ?? 'Coupon is not applicable.'],
                    ]);
                }
                $discountAmount = $validation['discount'];
                $appliedCouponCode = $coupon->code;
                $coupon->increment('used_count');
            }

            $order->forceFill([
                'address_id' => $addressRow->id,
                'subtotal' => $subtotal,
                'delivery_fee' => $deliveryFee,
                'coupon_code' => $appliedCouponCode,
                'discount_amount' => $discountAmount,
                'total' => $subtotal + $deliveryFee - $discountAmount,
                'layaway_minimum_payment' => $isLayaway
                    ? max(
                        (int) config('shop.layaway.minimum_payment'),
                        (int) ceil(($subtotal + $deliveryFee - $discountAmount) * ((int) config('shop.layaway.deposit_percent') / 100)),
                    )
                    : null,
            ])->save();

            if ($offer) {
                $offer->forceFill([
                    'status' => Offer::STATUS_CONVERTED,
                    'converted_at' => now(),
                    'order_id' => $order->id,
                ])->save();

                AuditLogger::log(
                    action: 'offer.converted_to_order',
                    description: "Offer {$offer->reference} converted to order {$order->reference} at ₦".number_format($offer->agreed_price ?? $offer->offered_price),
                    auditable: $order,
                    newValues: ['order_reference' => $order->reference, 'offer_reference' => $offer->reference],
                );
            }

            return $order->fresh(['items', 'address.zone', 'customer']);
        });
    }

    /** @param Collection<int, CartLine> $lines */
    private function assertLayawayEligible(Collection $lines): void
    {
        if (! config('shop.layaway.enabled') || $lines->count() !== 1 || ! $lines->first()?->unit) {
            throw new CartUnavailableException([
                ['problem' => 'Reserve & pay gradually is available for one serialized laptop at a time.'],
            ]);
        }
    }

    /**
     * Release everything an order was holding, and close it.
     *
     * Driven by `orders:expire-unpaid` and by an explicit cancellation. Only
     * touches units still held BY THIS ORDER — a machine that has since been
     * legitimately sold to someone else is left alone.
     */
    public function release(Order $order, string $status, ?string $note = null): void
    {
        DB::transaction(function () use ($order, $status, $note) {
            /** @var Order $locked */
            $locked = Order::query()->lockForUpdate()->find($order->id);

            /*
             | Only an order that might still be HOLDING stock can be released —
             | awaiting payment, or failed-and-not-yet-retried.
             |
             | A paid order must never reach here: its units are marked `sold`,
             | and releasing those would put a machine somebody owns back on the
             | shelf. `isHoldingStock()` rather than `isOpen()` because a failed
             | payment deliberately keeps its reservation, so the sweeper has to
             | be able to collect it too.
             */
            if (! $locked || ! $locked->isHoldingStock()) {
                return;
            }

            ProductUnit::query()
                ->where('order_id', $locked->id)
                ->where('status', ProductUnit::STATUS_RESERVED)
                ->get()
                ->each(fn (ProductUnit $unit) => $unit->releaseReservation($note));

            $locked->forceFill([
                'status' => $status,
                'reserved_until' => null,
            ])->save();
        });
    }

    /**
     * Rebuild a request-shaped item list from resolved lines, so the failure
     * report can be regenerated against current availability.
     *
     * @param  Collection<int, CartLine>  $lines
     * @return array<int, array<string, mixed>>
     */
    private function itemsFromLines($lines): array
    {
        return $lines->map(fn (CartLine $line) => [
            'product_id' => $line->unit ? null : $line->product->id,
            'product_unit_id' => $line->unit?->id,
            'quantity' => $line->quantity,
        ])->all();
    }
}
