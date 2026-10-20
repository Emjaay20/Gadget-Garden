<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Append-only ledger for `stocked` products (chargers, bags, mice).
 *
 * `products.stock` is a denormalised running total and is NEVER assigned
 * directly — every change writes a row here in the same transaction. That is
 * what makes "who took twelve chargers off the shelf, and why" answerable.
 *
 * The three CHECK constraints hold the invariants in the DATABASE, not only in
 * application code, so a bad write from a console session, a future job, or a
 * migration cannot corrupt the ledger:
 *
 *   delta <> 0                          a movement records a real change
 *   stock_after = stock_before + delta   the arithmetic cannot drift
 *   reason IN (...)                      no free-text reasons
 *
 * Reasons are directional and validated against the sign at the API boundary: a
 * "restock: -4" is a typo, not a restock.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();

            $table->integer('delta');
            $table->integer('stock_before');
            $table->integer('stock_after');

            $table->string('reason');
            $table->text('note')->nullable();

            $table->unsignedBigInteger('order_id')->nullable();
            // Denormalised so the ledger still reads sensibly after an order is
            // soft-deleted — the reference is what a human recognises.
            $table->string('order_reference')->nullable();

            // Null when the shop did it (a paid order decrementing stock) rather
            // than a staff member.
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();

            $table->timestamp('created_at')->useCurrent();

            $table->index(['product_id', 'created_at']);
            $table->index('order_id');
        });

        DB::statement('ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_delta_check
            CHECK (delta <> 0)');

        DB::statement('ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_arithmetic_check
            CHECK (stock_after = stock_before + delta)');

        DB::statement("ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_reason_check
            CHECK (reason IN ('restock', 'sale', 'return', 'damage', 'correction'))");

        DB::statement('ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_not_negative_check
            CHECK (stock_after >= 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};
