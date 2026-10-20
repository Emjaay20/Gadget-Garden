<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Append-only history for a single machine — the serialized equivalent of
 * `stock_movements`.
 *
 * `product_units.status` is the current state; this is how it got there. That
 * makes "where did that ThinkPad go, and who moved it" answerable months later,
 * which for one-of-a-kind stock is the whole point: with quantity stock a
 * discrepancy is a number being wrong, but here it is a specific ₦1.9m machine
 * that is unaccounted for.
 *
 * Never updated, never deleted. A correction is a new row.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('unit_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_unit_id')->constrained()->cascadeOnDelete();

            $table->string('event');

            // The transition this row records, so the ledger can be read without
            // replaying every prior event to work out where the unit was.
            $table->string('from_status')->nullable();
            $table->string('to_status')->nullable();

            $table->unsignedBigInteger('order_id')->nullable();
            $table->string('order_reference')->nullable();

            // Null when the shop did it rather than a staff member — an
            // automatic reservation at checkout, or the expiry sweeper.
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();

            $table->text('note')->nullable();

            // Only created_at: an append-only row has nothing to update.
            $table->timestamp('created_at')->useCurrent();

            $table->index(['product_unit_id', 'created_at']);
            $table->index('order_id');
        });

        DB::statement("ALTER TABLE unit_events ADD CONSTRAINT unit_events_event_check
            CHECK (event IN (
                'acquired', 'listed', 'reserved', 'reservation_released',
                'sold', 'returned', 'repaired', 'written_off', 'corrected'
            ))");
    }

    public function down(): void
    {
        Schema::dropIfExists('unit_events');
    }
};
