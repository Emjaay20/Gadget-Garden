<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Delivery pricing. The business ships nationwide from Computer Village, Ikeja,
 * so the meaningful split is Lagos vs everywhere else.
 *
 * `free_above` is the order subtotal at which delivery becomes free. On a
 * catalogue where a single item is routinely ₦600,000+, that threshold is
 * effectively "any laptop" — which is the intent.
 *
 * NOTE: the real fee table is still outstanding from the client (DESIGN.md §6).
 * The seeded values are plausible placeholders, and are marked as such there.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delivery_zones', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');

            // Whole naira, like every other money column.
            $table->unsignedInteger('fee');
            $table->unsignedInteger('free_above')->nullable();

            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();

            $table->index(['is_active', 'position']);
        });

        DB::statement('ALTER TABLE delivery_zones ADD CONSTRAINT delivery_zones_free_above_check
            CHECK (free_above IS NULL OR free_above > 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_zones');
    }
};
