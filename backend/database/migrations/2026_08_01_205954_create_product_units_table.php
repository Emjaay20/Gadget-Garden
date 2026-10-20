<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * ONE PHYSICAL MACHINE.
 *
 * The heart of the hybrid model. A `unit` product is a model line; this is the
 * actual laptop on the shelf, with its own RAM, its own battery health, its own
 * condition grade and its own price. Two EliteBook 840s in the same listing
 * routinely differ by ₦200,000.
 *
 * ── RESERVATION ─────────────────────────────────────────────────────────────
 * Unlike quantity stock, a unit CANNOT wait for payment to be taken off the
 * shelf. Two customers must not both reach the pay screen for the same machine,
 * so a unit moves to `reserved` at ORDER CREATION with a `reserved_until`, and
 * `orders:expire-unpaid` releases it if the money never arrives. That is a
 * deliberate departure from the quantity rule (decrement on payment only) and
 * the reason `reserved_until` exists.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * `serial` and `imei` are encrypted at rest: they identify a specific device and
 * are what a stolen-goods claim or a warranty dispute turns on.
 *
 * `cost` is what the business paid. It backs the margin reporting and is
 * therefore gated behind `reports.view` — it must never appear in a public
 * resource.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_units', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();

            // Human-readable and printable on a shelf label: GG-EB840-004.
            $table->string('sku')->unique();

            // Encrypted — see the model's casts. Not unique-indexed, because an
            // encrypted column produces a different ciphertext each write and an
            // index over it could never match anyway.
            $table->text('serial')->nullable();
            $table->text('imei')->nullable();

            $table->string('condition');
            $table->string('grade')->nullable();

            // cpu, ram_gb, storage_gb, storage_type, screen, gpu, battery_health
            $table->json('specs')->nullable();

            $table->unsignedInteger('price');
            $table->unsignedInteger('cost')->nullable();

            $table->string('status')->default('available');

            // Set with `reserved`; the sweeper reads it to release stale holds.
            $table->timestamp('reserved_until')->nullable();

            // Which order took it. Nullable so releasing a reservation is a
            // status change plus a null, not a delete.
            $table->unsignedBigInteger('order_id')->nullable();

            $table->text('note')->nullable();
            $table->timestamps();

            // The catalogue's hottest query: available units for a listing,
            // cheapest first, to render "from ₦620,000".
            $table->index(['product_id', 'status', 'price']);
            $table->index('status');
            $table->index('reserved_until');
        });

        DB::statement("ALTER TABLE product_units ADD CONSTRAINT product_units_condition_check
            CHECK (condition IN ('new', 'foreign_used', 'refurbished'))");

        DB::statement("ALTER TABLE product_units ADD CONSTRAINT product_units_grade_check
            CHECK (grade IS NULL OR grade IN ('A', 'B', 'C'))");

        DB::statement("ALTER TABLE product_units ADD CONSTRAINT product_units_status_check
            CHECK (status IN ('available', 'reserved', 'sold', 'returned', 'faulty'))");

        /*
         | A reserved unit must say WHEN the hold expires, and an available one
         | must not be holding a stale timestamp. Without this, a reservation
         | with a null expiry is invisible to the sweeper and the machine is
         | held forever by an order nobody paid for.
         */
        DB::statement("ALTER TABLE product_units ADD CONSTRAINT product_units_reserved_until_check
            CHECK (
                (status = 'reserved' AND reserved_until IS NOT NULL)
                OR
                (status <> 'reserved' AND reserved_until IS NULL)
            )");

        // A sold unit belongs to an order. Anything unsold does not.
        DB::statement("ALTER TABLE product_units ADD CONSTRAINT product_units_sold_has_order_check
            CHECK (status <> 'sold' OR order_id IS NOT NULL)");
    }

    public function down(): void
    {
        Schema::dropIfExists('product_units');
    }
};
