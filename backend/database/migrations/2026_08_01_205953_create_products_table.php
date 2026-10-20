<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A product is a LISTING. How it holds stock depends on `kind` — the central
 * decision of this schema.
 *
 *   kind = 'unit'    A model line ("HP EliteBook 840 G8"). Owns no price and no
 *                    stock of its own; both derive from `product_units`, where
 *                    each physical machine is its own row with its own specs,
 *                    condition and price. This is what foreign-used hardware
 *                    actually is: no two units match, so one price would be a
 *                    lie.
 *
 *   kind = 'stocked' A conventional SKU ("65W USB-C charger"). One price, an
 *                    integer `stock`, and a `stock_movements` ledger.
 *
 * The alternative — forcing laptops into SKU+quantity — would mean either one
 * product per machine (a catalogue of near-duplicate listings, unbrowsable) or
 * pretending twelve different EliteBooks are interchangeable (wrong specs shown,
 * wrong machine shipped). Hence the split.
 *
 * MONEY IS INTEGER WHOLE NAIRA. 620000 means ₦620,000, never kobo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('brand')->nullable();
            $table->string('kind');
            $table->foreignId('category_id')->constrained()->restrictOnDelete();

            $table->text('description')->nullable();
            $table->string('short_description')->nullable();

            // Marketing bullets, and specs shared by every unit of this model
            // line (screen size, ports). Per-unit specs live on the unit.
            $table->json('highlights')->nullable();
            $table->json('base_specs')->nullable();

            $table->unsignedSmallInteger('warranty_months')->default(0);

            /*
             | STOCKED-ONLY COLUMNS. Null for `unit` products, where price comes
             | from the cheapest available unit and stock is a count of them.
             | The CHECK constraints below make that structural rather than a
             | convention someone has to remember.
             */
            $table->unsignedInteger('price')->nullable();
            $table->unsignedInteger('compare_at_price')->nullable();
            $table->integer('stock')->nullable();
            $table->unsignedSmallInteger('low_stock_threshold')->default(5);

            $table->string('currency', 3)->default('NGN');
            $table->boolean('is_featured')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['is_active', 'kind']);
            $table->index(['category_id', 'is_active']);
            $table->index('brand');
        });

        DB::statement("ALTER TABLE products ADD CONSTRAINT products_kind_check
            CHECK (kind IN ('unit', 'stocked'))");

        /*
         | A `stocked` product MUST have a price and a stock level; a `unit`
         | product must have NEITHER. Enforced in the database rather than only
         | in the model, because the failure mode is a listing that silently
         | shows ₦0 or a laptop whose real price sits on its units while a stale
         | number sits here and wins.
         */
        DB::statement("ALTER TABLE products ADD CONSTRAINT products_kind_price_check
            CHECK (
                (kind = 'stocked' AND price IS NOT NULL AND stock IS NOT NULL)
                OR
                (kind = 'unit' AND price IS NULL AND stock IS NULL)
            )");

        // A discount that is not a discount is worse than no discount.
        DB::statement('ALTER TABLE products ADD CONSTRAINT products_compare_at_check
            CHECK (compare_at_price IS NULL OR compare_at_price > price)');

        DB::statement('ALTER TABLE products ADD CONSTRAINT products_stock_not_negative
            CHECK (stock IS NULL OR stock >= 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
