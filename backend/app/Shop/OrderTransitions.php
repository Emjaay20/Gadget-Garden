<?php

namespace App\Shop;

use App\Models\Order;
use App\Models\User;
use App\Notifications\OrderStatusChanged;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use RuntimeException;

/**
 * The fulfilment state machine.
 *
 * Only the first transition is automatic — `pending_payment → paid` belongs to
 * `SettlesPayments` and never happens here. Everything after it is a staff
 * action, and the graph below is what stops those going backwards or sideways:
 *
 *     paid ──▶ processing ──▶ shipped ──▶ delivered
 *       │           │
 *       └───────────┴────────▶ cancelled
 *
 * Two rules worth stating outright:
 *
 *  - **A delivered order is final.** No transition leaves it. If something comes
 *    back, that is a return — a different process with its own money movement,
 *    not an edit to this row.
 *  - **A shipped order cannot be cancelled here.** The goods are with a courier;
 *    "cancelled" would imply nothing left the building, and the ledger would
 *    stop matching reality. That needs a return too.
 */
class OrderTransitions
{
    /**
     * Which statuses may follow which.
     *
     * @return array<string, list<string>>
     */
    public static function graph(): array
    {
        return [
            Order::PAID => [Order::PROCESSING, Order::CANCELLED],
            Order::PROCESSING => [Order::SHIPPED, Order::CANCELLED],
            Order::SHIPPED => [Order::DELIVERED],
            Order::DELIVERED => [],
            Order::CANCELLED => [],
            // Staff cannot mark an order paid — only a real payment does that.
            Order::PENDING_PAYMENT => [Order::CANCELLED],
            Order::FAILED => [Order::CANCELLED],
        ];
    }

    /**
     * @return list<string>
     */
    public static function nextFor(Order $order): array
    {
        return self::graph()[$order->status] ?? [];
    }

    public static function allows(Order $order, string $to): bool
    {
        return in_array($to, self::nextFor($order), true);
    }

    /**
     * Move an order along, or refuse.
     *
     * Re-reads under a lock so two staff members clicking "Mark shipped" at the
     * same moment cannot both succeed from the same starting status.
     */
    public function apply(Order $order, string $to, User $actor, ?string $note = null): Order
    {
        return DB::transaction(function () use ($order, $to, $actor, $note) {
            /** @var Order|null $locked */
            $locked = Order::query()->lockForUpdate()->find($order->id);

            if (! $locked) {
                throw new RuntimeException('Order not found.');
            }

            if ($locked->status === $to) {
                // Idempotent: a double-clicked button is not an error, and
                // treating it as one produces a confusing red toast for a
                // no-op the user already got what they wanted from.
                return $locked;
            }

            if (! self::allows($locked, $to)) {
                throw new RuntimeException(
                    "An order that is {$locked->status} cannot become {$to}."
                );
            }

            /*
             | Cancelling an order that is still holding stock has to put that
             | stock back — otherwise a cancelled order keeps a machine off the
             | shelf until the sweeper happens to run.
             |
             | A cancelled order that was already PAID is different: its units
             | are `sold` and its quantity stock has moved. Reversing that is a
             | refund and a return, which is deliberately not automated here —
             | the note records the decision and a human handles the money.
             */
            if ($to === Order::CANCELLED && $locked->isHoldingStock()) {
                app(PlacesOrders::class)->release(
                    $locked,
                    Order::CANCELLED,
                    $note ?? "Cancelled by {$actor->name}.",
                );

                $this->notify($locked->fresh());

                return $locked->fresh();
            }

            $locked->forceFill(['status' => $to])->save();

            if ($note) {
                $locked->forceFill([
                    'staff_note' => trim(($locked->staff_note ?? '')."\n{$note} — {$actor->name}"),
                ])->save();
            }

            $this->notify($locked->fresh());

            return $locked->fresh();
        });
    }

    /**
     * Tell the customer, once, after the transaction commits.
     *
     * Only reached on a REAL transition — the idempotent no-op above returns
     * before this, so a double-clicked button sends nothing. An inbox that pings
     * every time somebody opens the order page teaches customers to ignore the
     * emails that matter.
     */
    private function notify(Order $order): void
    {
        DB::afterCommit(function () use ($order) {
            Notification::route('mail', $order->contact_email)
                ->notify(new OrderStatusChanged($order));
        });
    }
}
