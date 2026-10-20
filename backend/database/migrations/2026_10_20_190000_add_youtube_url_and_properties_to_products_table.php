<?php

use App\Models\Category;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('youtube_url')->nullable()->after('short_description');
            $table->json('properties')->nullable()->after('highlights');
        });

        // Seed / sync updated catalog categories
        $categories = [
            [
                'slug' => 'workstation',
                'name' => 'Workstation',
                'description' => 'Heavy-duty rendering, CAD and engineering laptops.',
                'position' => 1,
            ],
            [
                'slug' => 'gaming-laptop',
                'name' => 'Gaming laptop',
                'description' => 'High-refresh displays and discrete graphics.',
                'position' => 2,
            ],
            [
                'slug' => 'business-laptop',
                'name' => 'Business laptop',
                'description' => 'Ultrabooks and productivity machines for work and school.',
                'position' => 3,
            ],
            [
                'slug' => 'accessories',
                'name' => 'Accessories',
                'description' => 'Chargers, bags, cables, mice and adapters.',
                'position' => 4,
            ],
        ];

        foreach ($categories as $cat) {
            Category::updateOrCreate(
                ['slug' => $cat['slug']],
                [
                    'name' => $cat['name'],
                    'description' => $cat['description'],
                    'position' => $cat['position'],
                    'is_active' => true,
                ]
            );
        }
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['youtube_url', 'properties']);
        });
    }
};
