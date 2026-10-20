<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Photography, attached to either a product or a single unit.
 *
 * Polymorphic because both are real cases and they mean different things:
 *
 *   - on a PRODUCT — stock imagery for the model line, shown when a unit has no
 *     photos of its own.
 *   - on a UNIT — pictures of THIS machine, scuffs and all. For foreign-used
 *     stock this is what a buyer actually wants, and showing a pristine press
 *     render instead is how disputes start.
 *
 * The resolution order (unit photos, else product photos) lives in the model.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_images', function (Blueprint $table) {
            $table->id();
            $table->morphs('imageable');

            $table->string('path');
            $table->string('alt')->nullable();
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();

            $table->index(['imageable_type', 'imageable_id', 'position'], 'product_images_ordered_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_images');
    }
};
