<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('payment_mode')->default('full')->after('status');
            $table->unsignedInteger('layaway_paid_amount')->default(0)->after('total');
            $table->unsignedInteger('layaway_minimum_payment')->nullable()->after('layaway_paid_amount');
            $table->timestamp('layaway_due_at')->nullable()->after('reserved_until');
            $table->index(['payment_mode', 'layaway_due_at']);
        });

        DB::statement("ALTER TABLE orders ADD CONSTRAINT orders_payment_mode_check CHECK (payment_mode IN ('full', 'layaway'))");
        DB::statement('ALTER TABLE orders ADD CONSTRAINT orders_layaway_paid_check CHECK (layaway_paid_amount >= 0 AND layaway_paid_amount <= total)');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_layaway_paid_check');
        DB::statement('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_mode_check');
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['payment_mode', 'layaway_due_at']);
            $table->dropColumn(['payment_mode', 'layaway_paid_amount', 'layaway_minimum_payment', 'layaway_due_at']);
        });
    }
};
