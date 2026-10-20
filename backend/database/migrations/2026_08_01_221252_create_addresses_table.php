<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Where an order goes.
 *
 * `delivery_zone_id` is `restrictOnDelete`: a zone that has been used to price a
 * delivery cannot be deleted out from under it, because the fee on the order was
 * computed from that row and a dangling reference would make a past order
 * unexplainable.
 *
 * Ordinary PII, not health data — but it is still never written to logs.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('addresses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('delivery_zone_id')->constrained()->restrictOnDelete();

            $table->string('line1');
            $table->string('city');
            $table->string('state');

            // Lagos addresses are routinely found by landmark rather than by
            // street number; the delivery rider genuinely needs this.
            $table->string('landmark')->nullable();
            $table->text('note')->nullable();

            $table->boolean('is_default')->default(false);
            $table->timestamps();

            $table->index(['customer_id', 'is_default']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('addresses');
    }
};
