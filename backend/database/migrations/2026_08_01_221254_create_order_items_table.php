<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A line on an order. Carries EITHER a serialized unit or a quantity of a
 * stocked product — the hybrid inventory model, at the point of sale.
 *
 * EVERYTHING IS SNAPSHOTTED. `name_at_time`, `unit_price_at_time` and
 * `specs_at_time` are copies, not lookups, so re-pricing the catalogue or
 * editing a listing never rewrites history. A customer disputing what they paid
 * six months ago is answered from this row, not from today's product table —
 * and for serialized stock the spec snapshot is what proves which machine was
 * actually sold.
 *
 * The product FKs are `nullOnDelete` so a deleted listing cannot take a paid
 * order's line with it; the snapshot is what keeps the row meaningful.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();

            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('product_unit_id')->nullable()->constrained()->nullOnDelete();

            $table->string('name_at_time');
            $table->string('sku_at_time')->nullable();
            $table->json('specs_at_time')->nullable();
            $table->string('condition_at_time')->nullable();

            $table->unsignedInteger('unit_price_at_time');
            $table->unsignedInteger('quantity');
            $table->unsignedInteger('line_total');

            $table->timestamps();

            $table->index('order_id');
            $table->index('product_unit_id');
        });

        DB::statement('ALTER TABLE order_items ADD CONSTRAINT order_items_line_total_check
            CHECK (line_total = unit_price_at_time * quantity)');

        DB::statement('ALTER TABLE order_items ADD CONSTRAINT order_items_quantity_check
            CHECK (quantity > 0)');

        /*
         | A serialized line is ALWAYS exactly one machine. There is only one of
         | it in the world, so a quantity of two is not a valid order — it is a
         | bug that would take payment for something that cannot be shipped.
         */
        DB::statement('ALTER TABLE order_items ADD CONSTRAINT order_items_unit_quantity_check
            CHECK (product_unit_id IS NULL OR quantity = 1)');
    }

    public function down(): void
    {
        Schema::dropIfExists('order_items');
    }
};
