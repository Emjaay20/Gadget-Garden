<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A payment attempt against an order (backend-CLAUDE.md §14.2, §14.5).
 *
 * With Xendify the flow is a dedicated virtual account rather than a redirect:
 * we ask for an account, the customer transfers to it, and a webhook tells us the
 * money landed. So this row also carries the account details the customer is shown
 * — they ARE the payment instruction, and the customer may come back to the order
 * page hours later still needing to see them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('provider');
            // Our reference sent to the provider — usually the order reference.
            $table->string('provider_reference')->index();
            // The provider's own transaction id, learned from the webhook.
            $table->string('provider_transaction_id')->nullable()->index();
            $table->string('status')->default('pending');
            $table->unsignedInteger('amount');
            $table->string('currency', 3)->default('NGN');

            // --- the virtual account the customer transfers to ---
            $table->string('account_number')->nullable()->index();
            $table->string('account_name')->nullable();
            $table->string('bank_name')->nullable();
            $table->timestamp('expires_at')->nullable();
            // Set for a redirect-style provider instead; null for a transfer flow.
            $table->text('authorization_url')->nullable();

            // Whole provider payloads, for reconciling a disputed payment later.
            // NEVER logged (§10) — read from the database when a human needs them.
            $table->json('raw_response')->nullable();
            $table->json('raw_webhook')->nullable();

            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            $table->index(['order_id', 'status']);
        });

        DB::statement("ALTER TABLE payments ADD CONSTRAINT payments_status_check
            CHECK (status IN ('pending', 'success', 'failed', 'abandoned'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
