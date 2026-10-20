<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * An order.
 *
 * STATUS FLOW: pending_payment → paid → processing → shipped → delivered,
 * plus `failed` and `cancelled`. Only the first transition is automatic; every
 * one after `paid` is a staff action.
 *
 * `contact_*` are SNAPSHOTTED at purchase time rather than read through the
 * customer relation. A buyer who later corrects their phone number must not
 * silently rewrite the number a past delivery was made to — the order is a
 * record of what happened, not a view of current data.
 *
 * `reserved_until` mirrors the hold placed on any serialized units in the order.
 * It lives here as well as on the unit so the sweeper can find expired ORDERS in
 * one indexed query, rather than working backwards from units.
 *
 * Money is integer whole naira, like everywhere else.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();

            // Short, unambiguous, and safe to read down a phone line — the
            // customer quotes this to support. See Order::generateReference().
            $table->string('reference')->unique();

            $table->foreignId('customer_id')->constrained()->restrictOnDelete();
            $table->foreignId('address_id')->nullable()->constrained()->nullOnDelete();

            $table->string('status')->default('pending_payment');

            $table->unsignedInteger('subtotal');
            $table->unsignedInteger('delivery_fee');
            $table->unsignedInteger('total');
            $table->string('currency', 3)->default('NGN');

            $table->string('contact_name');
            $table->string('contact_email');
            $table->string('contact_phone');

            $table->timestamp('placed_at');
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('reserved_until')->nullable();

            $table->text('staff_note')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index('status');
            // The expiry sweeper's query: unpaid orders past their hold.
            $table->index(['status', 'reserved_until']);
            $table->index('customer_id');
        });

        DB::statement("ALTER TABLE orders ADD CONSTRAINT orders_status_check
            CHECK (status IN (
                'pending_payment', 'paid', 'processing',
                'shipped', 'delivered', 'failed', 'cancelled'
            ))");

        /*
         | The arithmetic must hold. Every one of these is recomputed server-side
         | from the database at order creation and never taken from the browser,
         | but a constraint means a future code path cannot quietly write an
         | order whose total does not match what it is made of.
         */
        DB::statement('ALTER TABLE orders ADD CONSTRAINT orders_total_check
            CHECK (total = subtotal + delivery_fee)');

        DB::statement('ALTER TABLE orders ADD CONSTRAINT orders_paid_at_check
            CHECK (
                (status IN (\'pending_payment\', \'failed\', \'cancelled\') AND paid_at IS NULL)
                OR
                (status IN (\'paid\', \'processing\', \'shipped\', \'delivered\') AND paid_at IS NOT NULL)
            )');
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
