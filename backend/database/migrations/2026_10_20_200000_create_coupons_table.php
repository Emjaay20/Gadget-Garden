<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('coupons', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('description')->nullable();
            // 'fixed' (whole naira) or 'percent' (percentage)
            $table->string('type')->default('fixed');
            $table->unsignedInteger('value'); // integer whole naira or percent
            $table->unsignedInteger('min_order_amount')->default(0);
            $table->unsignedInteger('max_discount')->nullable();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->unsignedInteger('usage_limit')->nullable();
            $table->unsignedInteger('used_count')->default(0);
            $table->boolean('is_first_order_only')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['code', 'is_active']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->string('coupon_code', 50)->nullable()->after('currency');
            $table->unsignedInteger('discount_amount')->default(0)->after('coupon_code');
        });

        // Update the database constraint on orders to factor in discount_amount
        DB::statement('ALTER TABLE orders DROP CONSTRAINT orders_total_check');
        DB::statement('ALTER TABLE orders ADD CONSTRAINT orders_total_check
            CHECK (total = subtotal + delivery_fee - discount_amount)');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_total_check');
        DB::statement('ALTER TABLE orders ADD CONSTRAINT orders_total_check
            CHECK (total = subtotal + delivery_fee)');

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['coupon_code', 'discount_amount']);
        });

        Schema::dropIfExists('coupons');
    }
};
