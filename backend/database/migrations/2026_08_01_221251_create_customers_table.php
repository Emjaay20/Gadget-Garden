<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A buyer. NOT a login — the storefront has no customer accounts, and adding
 * them would put a password reset flow between someone and a laptop they are
 * ready to pay for.
 *
 * The row is created (or matched) at checkout, so a returning buyer is one
 * record with their full order history rather than a new one each time.
 *
 * `email` is uniquely indexed and nullable: unique because it is the key the
 * checkout upserts on, nullable because a walk-in sale recorded by staff may
 * only have a phone number.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->nullable()->unique();
            $table->string('phone')->nullable();

            // How the record originated, so staff can tell a website order from
            // something they typed in at the counter.
            $table->string('source')->default('shop');

            $table->text('note')->nullable();
            $table->timestamps();

            $table->index('phone');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};
