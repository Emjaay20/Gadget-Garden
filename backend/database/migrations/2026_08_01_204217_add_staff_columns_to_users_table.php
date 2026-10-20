<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `users` are staff. There is no customer login on this platform — the
 * storefront is entirely unauthenticated, and buyers become `customers` rows at
 * checkout.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('phone')->nullable()->after('email');

            /*
             | Deactivation, not deletion. A staff member who has handled stock
             | is referenced by movements and unit events for as long as those
             | records exist, so the row has to stay. See EnsureUserIsActive:
             | flipping this false must also cut off tokens already issued, or
             | "revoke their access" revokes nothing until they log out.
             */
            $table->boolean('is_active')->default(true)->after('phone');

            $table->timestamp('last_login_at')->nullable()->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['phone', 'is_active', 'last_login_at']);
        });
    }
};
