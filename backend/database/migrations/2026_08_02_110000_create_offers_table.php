<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('offers', function (Blueprint $table) {
            $table->id();
            $table->string('reference')->unique();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_unit_id')->nullable()->constrained()->nullOnDelete();

            $table->string('customer_name');
            $table->string('customer_email');
            $table->string('customer_phone');

            // All monetary amounts in whole naira
            $table->unsignedInteger('original_price');
            $table->unsignedInteger('offered_price');
            $table->unsignedInteger('counter_price')->nullable();
            $table->unsignedInteger('agreed_price')->nullable();

            $table->string('status')->default('pending');
            $table->foreignId('responded_by')->nullable()->constrained('users')->nullOnDelete();

            $table->text('customer_note')->nullable();
            $table->text('staff_note')->nullable();

            $table->timestamp('expires_at')->nullable();
            $table->timestamp('converted_at')->nullable();
            $table->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'created_at']);
            $table->index('customer_phone');
        });

        DB::statement("ALTER TABLE offers ADD CONSTRAINT offers_status_check
            CHECK (status IN ('pending', 'countered', 'accepted', 'declined', 'expired', 'converted'))");

        DB::statement('ALTER TABLE offers ADD CONSTRAINT offers_prices_check
            CHECK (offered_price > 0 AND (counter_price IS NULL OR counter_price > 0) AND (agreed_price IS NULL OR agreed_price > 0))');
    }

    public function down(): void
    {
        Schema::dropIfExists('offers');
    }
};
