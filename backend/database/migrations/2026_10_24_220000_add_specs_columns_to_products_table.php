<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('processor')->nullable()->after('brand');
            $table->unsignedInteger('ram_gb')->nullable()->after('processor');
            $table->unsignedInteger('storage_gb')->nullable()->after('ram_gb');
            $table->string('storage_type')->nullable()->default('SSD')->after('storage_gb');
            $table->string('screen_size')->nullable()->after('storage_type');
            $table->string('resolution')->nullable()->after('screen_size');
            $table->string('graphics')->nullable()->after('resolution');
            $table->string('color')->nullable()->after('graphics');
        });

        Schema::table('product_images', function (Blueprint $table) {
            $table->string('type')->default('real_device')->after('alt');
            $table->boolean('is_primary')->default(false)->after('type');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn([
                'processor',
                'ram_gb',
                'storage_gb',
                'storage_type',
                'screen_size',
                'resolution',
                'graphics',
                'color',
            ]);
        });

        Schema::table('product_images', function (Blueprint $table) {
            $table->dropColumn(['type', 'is_primary']);
        });
    }
};
