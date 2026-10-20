<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * `cancelled` may carry a `paid_at`.
 *
 * The original constraint partitioned statuses into "never paid" and "definitely
 * paid" and put `cancelled` in the first group. That is wrong, and it made a
 * legitimate operation impossible: cancelling a PAID order — a refund at the
 * counter — was refused by the database, because the row still (correctly)
 * carried the timestamp of when the money arrived.
 *
 * Clearing `paid_at` on cancellation would have been the other way out, and it
 * is worse: it erases the fact that a payment happened, which is exactly the
 * record needed to reconcile the refund.
 *
 * So `cancelled` is now allowed either way, and the two real invariants stand:
 * an order awaiting payment or failed has no `paid_at`, and one in the
 * fulfilment pipeline must have one.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_paid_at_check');

        DB::statement("ALTER TABLE orders ADD CONSTRAINT orders_paid_at_check
            CHECK (
                (status IN ('pending_payment', 'failed') AND paid_at IS NULL)
                OR
                (status IN ('paid', 'processing', 'shipped', 'delivered') AND paid_at IS NOT NULL)
                OR
                -- Cancelled before payment (no timestamp) or refunded after it
                -- (timestamp kept, because the money really did arrive).
                status = 'cancelled'
            )");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_paid_at_check');

        DB::statement("ALTER TABLE orders ADD CONSTRAINT orders_paid_at_check
            CHECK (
                (status IN ('pending_payment', 'failed', 'cancelled') AND paid_at IS NULL)
                OR
                (status IN ('paid', 'processing', 'shipped', 'delivered') AND paid_at IS NOT NULL)
            )");
    }
};
