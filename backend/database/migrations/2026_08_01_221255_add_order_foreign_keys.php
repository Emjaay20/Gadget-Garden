<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Close the loop on the three `order_id` columns written before `orders`
 * existed — on `product_units`, `stock_movements` and `unit_events`.
 *
 * They were left unconstrained in phase 2 purely because of migration order.
 * Adding the constraints now means a movement or a unit can never point at an
 * order that is not there.
 *
 * `nullOnDelete` rather than cascade: deleting an order must NOT delete the
 * ledger rows describing what moved. The history of a machine outlives the order
 * that moved it — that is the entire point of an append-only ledger.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_units', function (Blueprint $table) {
            $table->foreign('order_id')->references('id')->on('orders')->nullOnDelete();
        });

        Schema::table('stock_movements', function (Blueprint $table) {
            $table->foreign('order_id')->references('id')->on('orders')->nullOnDelete();
        });

        Schema::table('unit_events', function (Blueprint $table) {
            $table->foreign('order_id')->references('id')->on('orders')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('product_units', function (Blueprint $table) {
            $table->dropForeign(['order_id']);
        });

        Schema::table('stock_movements', function (Blueprint $table) {
            $table->dropForeign(['order_id']);
        });

        Schema::table('unit_events', function (Blueprint $table) {
            $table->dropForeign(['order_id']);
        });
    }
};
