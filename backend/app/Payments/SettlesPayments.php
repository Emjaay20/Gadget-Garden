<?php

namespace App\Payments;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\StockMovement;
use App\Notifications\OrderConfirmed;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use RuntimeException;

/**
 * The single place an order becomes paid.
 *
 * Everything that could settle an order — the webhook, an explicit verify from
 * the order page, a staff-triggered recheck — funnels through `settle()`. Having
 * one path is what makes the two hard guarantees cheap to hold:
 *
 *  - **Idempotent.** A webhook may arrive up to ten times (Xendify retries), and
 *    the customer's browser polls `verify` alongside it. Whichever lands first
 *    wins; the rest are no-ops. Stock moves exactly once because the status
 *    transition and the stock writes share one transaction, and the transaction
 *    begins by re-reading the order under a lock.
 *
 *  - **One shape of evidence.** `settle()` takes a `PaymentResult`, whether it
 *    came from a `verify()` call or from an authenticated webhook body. Deciding
 *    whether a caller is entitled to assert a payment happens before this — in
 *    `authenticateWebhook()` — never here.
 *
 * Underpayment is treated as NOT PAID. A virtual account will happily accept
 * ₦500 against a ₦620,000 order; shipping a laptop on that would be a real loss,
 * so the order stays pending and the shortfall is recorded for a human to chase.
 */
class SettlesPayments
{
    /**
     * @return bool Whether THIS call is what settled the order.
     */
    public function settle(Payment $payment, PaymentResult $result): bool
    {
        if (! $result->isSuccess()) {
            if ($result->status === PaymentResult::FAILED) {
                $this->markFailed($payment, $result);
            }

            return false;
        }

        return DB::transaction(function () use ($payment, $result) {
            /** @var Payment|null $lockedPayment */
            $lockedPayment = Payment::query()->lockForUpdate()->find($payment->id);
            /** @var Order|null $order */
            $order = Order::query()->lockForUpdate()->find($lockedPayment?->order_id);

            // Already settled by the webhook, or by an earlier poll. This is the
            // idempotency guard — everything below runs at most once per order.
            if (! $lockedPayment || $lockedPayment->status === 'success' || ! $order || $order->status !== Order::PENDING_PAYMENT) {
                return false;
            }

            $paid = $result->amount ?? $lockedPayment->amount;

            if ($paid < $lockedPayment->amount) {
                $this->recordShortfall($lockedPayment, $order, $paid, $result);

                return false;
            }

            $lockedPayment->forceFill([
                'status' => 'success',
                'provider_transaction_id' => $result->transactionId ?? $lockedPayment->provider_transaction_id,
                'paid_at' => $result->paidAt ?? now(),
                'raw_response' => $result->raw ?: $lockedPayment->raw_response,
            ])->save();

            if ($order->isLayaway()) {
                $newPaidAmount = min($order->total, $order->layaway_paid_amount + $paid);
                $order->forceFill(['layaway_paid_amount' => $newPaidAmount])->save();

                if ($newPaidAmount < $order->total) {
                    return false;
                }
            }

            $order->forceFill([
                'status' => Order::PAID,
                'paid_at' => $result->paidAt ?? now(),
                /*
                 | The hold is over — these goods are sold, not reserved. Clearing
                 | it matters: a paid order still carrying a past `reserved_until`
                 | looks expired to `orders:expire-unpaid`, and only that command's
                 | own `isOpen()` guard would stop it putting a sold machine back
                 | on the shelf. Two guards, neither relied upon alone.
                 */
                'reserved_until' => null,
            ])->save();

            $this->commitStock($order);

            /*
             | The receipt. Queued, and dispatched only AFTER the transaction
             | commits — a worker must never pick this up before the order is
             | actually paid, nor send a receipt for a transaction that rolled
             | back. `afterCommit` is what guarantees that ordering.
             */
            DB::afterCommit(function () use ($order) {
                Notification::route('mail', $order->contact_email)
                    ->notify(new OrderConfirmed($order->fresh(['items'])));
            });

            return true;
        });
    }

    /**
     * Move the goods, inside the same transaction as the paid transition.
     *
     * ─────────────────────────────────────────────────────────────────────────
     * THE HYBRID SPLIT LANDS HERE.
     *
     * A serialized line is one physical machine: it becomes `sold`, which is a
     * status change plus a `unit_event`, not arithmetic. A stocked line is a
     * quantity: it goes through the ledger as a `sale` movement.
     *
     * Both happen only NOW, on payment — never at cart or order-creation time.
     * Holding quantity stock for unpaid orders would let anyone empty the shop
     * with carts they never pay for. Serialized units are the deliberate
     * exception: they are *reserved* at checkout, because there is only one of
     * each and two people must not both reach the pay screen for it. Payment
     * converts that reservation into a sale.
     * ─────────────────────────────────────────────────────────────────────────
     */
    private function commitStock(Order $order): void
    {
        foreach ($order->items()->with(['unit', 'product'])->get() as $item) {
            if ($item->isUnitLine()) {
                $this->sellUnit($order, $item);

                continue;
            }

            $this->decrementStock($order, $item);
        }
    }

    private function sellUnit(Order $order, OrderItem $item): void
    {
        $unit = $item->unit;

        if (! $unit) {
            // The unit row is gone — deleted from under a paid order. Nothing to
            // move, but somebody needs to know: a machine was paid for and can no
            // longer be accounted for.
            Log::error('Paid order references a unit that no longer exists.', [
                'order' => $order->reference,
                'sku' => $item->sku_at_time,
            ]);

            return;
        }

        try {
            $unit->markSold($order->id, $order->reference);
        } catch (RuntimeException $e) {
            /*
             | THE MONEY IS ALREADY TAKEN, so this must not roll back a real
             | payment. `markSold` throws only when the machine is already sold on
             | a DIFFERENT order — a genuine oversell, meaning two customers have
             | paid for one laptop. That needs a human today, not an exception
             | that voids a payment the bank has already processed.
             */
            Log::critical('Paid order could not take its unit — possible oversell.', [
                'order' => $order->reference,
                'sku' => $unit->sku,
                'unit_status' => $unit->status,
                'error' => $e->getMessage(),
            ]);

            $this->appendStaffNote(
                $order,
                "Unit {$unit->sku} could not be marked sold (status: {$unit->status}) — check for an oversell.",
            );
        }
    }

    private function decrementStock(Order $order, OrderItem $item): void
    {
        $product = $item->product;

        if (! $product) {
            Log::warning('Paid order references a deleted product.', [
                'order' => $order->reference,
                'name' => $item->name_at_time,
            ]);

            return;
        }

        // Clamp rather than refuse: the money is already taken, so a race that
        // oversold by one must not roll back a real payment. This records what
        // actually moved and leaves the shortfall visible in the ledger.
        $wanted = (int) $item->quantity;
        $delta = -min($wanted, max(0, (int) $product->stock));

        if ($delta === 0) {
            Log::warning('Paid order could not decrement stock — none left.', [
                'order' => $order->reference,
                'product' => $product->slug,
                'wanted' => $wanted,
            ]);

            $this->appendStaffNote(
                $order,
                "{$item->name_at_time}: paid for {$wanted} but none in stock.",
            );

            return;
        }

        $product->recordStockMovement([
            'delta' => $delta,
            'reason' => StockMovement::SALE,
            'order_id' => $order->id,
            'order_reference' => $order->reference,
            'user_id' => null, // the shop, not a staff member
        ]);

        if (abs($delta) !== $wanted) {
            $this->appendStaffNote(
                $order,
                "{$item->name_at_time}: only ".abs($delta)." of {$wanted} available — short.",
            );
        }
    }

    private function recordShortfall(Payment $payment, Order $order, int $paid, PaymentResult $result): void
    {
        $payment->forceFill([
            'provider_transaction_id' => $result->transactionId ?? $payment->provider_transaction_id,
            'raw_response' => $result->raw ?: $payment->raw_response,
        ])->save();

        $short = $payment->amount - $paid;

        $this->appendStaffNote(
            $order,
            "Underpaid: ₦{$paid} received against payment request ₦{$payment->amount} — ₦{$short} short.",
        );

        Log::warning('Order underpaid.', [
            'order' => $order->reference,
            'expected' => $payment->amount,
            'received' => $paid,
        ]);
    }

    private function markFailed(Payment $payment, PaymentResult $result): void
    {
        DB::transaction(function () use ($payment, $result) {
            /** @var Order|null $order */
            $order = Order::query()->lockForUpdate()->find($payment->order_id);

            // Only an order still waiting can fail. A paid order that later sees
            // a failed lookup is a provider glitch, not a refund.
            if (! $order || $order->status !== Order::PENDING_PAYMENT) {
                return;
            }

            $payment->forceFill([
                'status' => 'failed',
                'raw_response' => $result->raw ?: $payment->raw_response,
            ])->save();

            if ($order->isLayaway()) {
                return;
            }

            /*
             | The order is marked failed but its RESERVATIONS ARE LEFT IN PLACE,
             | to expire on their own schedule. Deliberate: a failed transfer is
             | very often retried within minutes, and releasing the machine
             | immediately would mean the customer who just tried to pay loses it
             | to somebody else. `orders:expire-unpaid` collects it if they never
             | come back.
             */
            $order->forceFill(['status' => Order::FAILED])->save();
        });
    }

    private function appendStaffNote(Order $order, string $note): void
    {
        $order->forceFill([
            'staff_note' => trim(($order->staff_note ?? '')."\n".$note),
        ])->save();
    }
}
