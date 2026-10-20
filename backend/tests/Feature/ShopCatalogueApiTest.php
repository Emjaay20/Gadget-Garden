<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\DeliveryZone;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductUnit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * The public catalogue. Unauthenticated by design — the checks that matter are
 * that it shows only what a customer may see, and that it never leaks what they
 * may not.
 */
class ShopCatalogueApiTest extends TestCase
{
    use RefreshDatabase;

    /**
     * A real order to attribute a sale to.
     *
     * `product_units.order_id` is a foreign key, so a sold unit must point at an
     * order that exists — the database refuses an invented id.
     */
    private function soldTo(): Order
    {
        return Order::factory()->create();
    }

    private function laptop(string $slug, array $unitPrices, array $attributes = []): Product
    {
        $product = Product::factory()->create([
            'slug' => $slug,
            'name' => $slug,
        ] + $attributes);

        foreach ($unitPrices as $price) {
            ProductUnit::factory()->for($product)->create(['price' => $price]);
        }

        return $product;
    }

    /* ------------------------------------------------------------- listing */

    public function test_the_catalogue_is_public(): void
    {
        $this->laptop('elitebook', [620_000]);

        $this->getJson('/api/shop/products')
            ->assertOk()
            ->assertJsonStructure(['data', 'meta' => ['total', 'per_page', 'current_page', 'last_page']]);
    }

    /**
     * The paginator-meta trap: handing a paginator to a resource collection that
     * also sets its own meta makes Laravel merge two meta blocks and turn every
     * shared key into a two-element array (`"total": [1, 1]`).
     */
    public function test_meta_total_is_a_number_not_an_array(): void
    {
        $this->laptop('elitebook', [620_000]);

        $total = $this->getJson('/api/shop/products')->json('meta.total');

        $this->assertIsInt($total);
        $this->assertSame(1, $total);
    }

    public function test_an_inactive_product_is_hidden(): void
    {
        $this->laptop('visible', [620_000]);
        $this->laptop('hidden', [500_000], ['is_active' => false]);

        $slugs = collect($this->getJson('/api/shop/products')->json('data'))->pluck('slug');

        $this->assertTrue($slugs->contains('visible'));
        $this->assertFalse($slugs->contains('hidden'));
    }

    /** Nothing available means nothing to sell — it should not be listed at all. */
    public function test_a_listing_whose_units_are_all_sold_is_hidden(): void
    {
        $product = $this->laptop('all-gone', [620_000]);
        $order = $this->soldTo();
        $product->units->each->markSold($order->id, $order->reference);

        $slugs = collect($this->getJson('/api/shop/products')->json('data'))->pluck('slug');

        $this->assertFalse($slugs->contains('all-gone'));
    }

    public function test_a_stocked_product_with_zero_stock_is_hidden(): void
    {
        $product = Product::factory()->stocked(stock: 3)->create(['slug' => 'charger']);
        $product->recordStockMovement(['stock' => 0, 'reason' => 'sale']);

        $slugs = collect($this->getJson('/api/shop/products')->json('data'))->pluck('slug');

        $this->assertFalse($slugs->contains('charger'));
    }

    /* --------------------------------------------------------- pricing shape */

    public function test_from_price_is_the_cheapest_available_unit(): void
    {
        $this->laptop('elitebook', [680_000, 545_000, 620_000]);

        $product = collect($this->getJson('/api/shop/products')->json('data'))
            ->firstWhere('slug', 'elitebook');

        $this->assertSame(545_000, $product['from_price']);
        $this->assertSame(3, $product['available_count']);
        $this->assertTrue($product['price_is_from']);
    }

    /**
     * "from ₦620,000" when ₦620,000 is the only option reads as evasive on a
     * brand that sells on trust.
     */
    public function test_price_is_from_is_false_when_only_one_machine_is_left(): void
    {
        $this->laptop('last-one', [620_000]);

        $product = collect($this->getJson('/api/shop/products')->json('data'))
            ->firstWhere('slug', 'last-one');

        $this->assertFalse($product['price_is_from']);
        $this->assertSame(620_000, $product['from_price']);
    }

    public function test_both_kinds_share_one_response_shape(): void
    {
        $this->laptop('elitebook', [620_000]);
        Product::factory()->stocked(stock: 10, price: 22_000)->create(['slug' => 'charger']);

        $data = collect($this->getJson('/api/shop/products')->json('data'));

        foreach (['elitebook', 'charger'] as $slug) {
            $product = $data->firstWhere('slug', $slug);
            $this->assertArrayHasKey('from_price', $product);
            $this->assertArrayHasKey('available_count', $product);
            $this->assertArrayHasKey('in_stock', $product);
            $this->assertIsInt($product['from_price']);
        }
    }

    /* --------------------------------------------------------------- privacy */

    /**
     * `cost` is what the business paid; `serial`/`imei` identify a specific
     * device. None may ever reach an anonymous caller.
     */
    public function test_cost_and_device_identifiers_never_reach_the_public_api(): void
    {
        $product = $this->laptop('elitebook', [620_000]);
        $product->units->first()->update([
            'cost' => 470_000,
            'serial' => 'SN-SECRET-123',
            'imei' => '350000000000001',
        ]);

        $listing = $this->getJson('/api/shop/products')->assertOk();
        $detail = $this->getJson('/api/shop/products/elitebook')->assertOk();

        foreach ([$listing, $detail] as $response) {
            $body = $response->getContent();
            $this->assertStringNotContainsString('470000', $body);
            $this->assertStringNotContainsString('SN-SECRET', $body);
            $this->assertStringNotContainsString('350000000000001', $body);
            $this->assertStringNotContainsString('"cost"', $body);
        }
    }

    /* ---------------------------------------------------------------- detail */

    public function test_the_detail_page_lists_the_available_machines(): void
    {
        $this->laptop('elitebook', [680_000, 545_000, 620_000]);

        $units = $this->getJson('/api/shop/products/elitebook')
            ->assertOk()
            ->json('data.units');

        $this->assertCount(3, $units);
        // Cheapest first — the picker reads as a price ladder.
        $this->assertSame([545_000, 620_000, 680_000], array_column($units, 'price'));
    }

    public function test_the_detail_page_omits_machines_that_are_not_available(): void
    {
        $product = $this->laptop('elitebook', [620_000, 800_000]);
        $order = $this->soldTo();
        $product->units->first()->markSold($order->id, $order->reference);

        $units = $this->getJson('/api/shop/products/elitebook')->json('data.units');

        $this->assertCount(1, $units);
        $this->assertSame(800_000, $units[0]['price']);
    }

    public function test_an_unknown_slug_reads_as_a_human_sentence(): void
    {
        $this->getJson('/api/shop/products/nope')
            ->assertStatus(404)
            ->assertJsonPath('message', 'Product not found.');
    }

    public function test_an_inactive_product_detail_is_a_404_not_a_preview(): void
    {
        $this->laptop('hidden', [620_000], ['is_active' => false]);

        $this->getJson('/api/shop/products/hidden')->assertStatus(404);
    }

    /* -------------------------------------------------------------- filtering */

    public function test_search_matches_name_and_brand_case_insensitively(): void
    {
        $this->laptop('elitebook-840', [620_000], ['name' => 'HP EliteBook 840', 'brand' => 'HP']);
        $this->laptop('thinkpad-x1', [700_000], ['name' => 'ThinkPad X1', 'brand' => 'Lenovo']);

        $byName = $this->getJson('/api/shop/products?search=ELITEBOOK')->json('data');
        $this->assertCount(1, $byName);

        $byBrand = $this->getJson('/api/shop/products?search=lenovo')->json('data');
        $this->assertCount(1, $byBrand);
        $this->assertSame('thinkpad-x1', $byBrand[0]['slug']);
    }

    public function test_filtering_by_condition(): void
    {
        $used = $this->laptop('used-one', [620_000]);
        $new = Product::factory()->create(['slug' => 'new-one']);
        ProductUnit::factory()->for($new)->create([
            'condition' => ProductUnit::CONDITION_NEW,
            'price' => 600_000,
        ]);

        $slugs = collect($this->getJson('/api/shop/products?condition[]=new')->json('data'))
            ->pluck('slug');

        $this->assertTrue($slugs->contains('new-one'));
        $this->assertFalse($slugs->contains($used->slug));
    }

    /**
     * The json cast trap: `specs->>'ram_gb'` is TEXT, so without an explicit
     * cast Postgres compares '8' >= '16' as strings and answers true.
     */
    public function test_filtering_by_minimum_ram_compares_numerically(): void
    {
        $small = Product::factory()->create(['slug' => 'ram-8']);
        ProductUnit::factory()->for($small)->create([
            'price' => 400_000,
            'specs' => ['cpu' => 'i5', 'ram_gb' => 8, 'storage_gb' => 256],
        ]);

        $big = Product::factory()->create(['slug' => 'ram-32']);
        ProductUnit::factory()->for($big)->create([
            'price' => 900_000,
            'specs' => ['cpu' => 'i9', 'ram_gb' => 32, 'storage_gb' => 1024],
        ]);

        $slugs = collect($this->getJson('/api/shop/products?min_ram=16')->json('data'))
            ->pluck('slug');

        $this->assertTrue($slugs->contains('ram-32'));
        $this->assertFalse($slugs->contains('ram-8'));
    }

    public function test_sorting_by_price_spans_both_kinds(): void
    {
        $this->laptop('laptop', [620_000]);
        Product::factory()->stocked(stock: 5, price: 22_000)->create(['slug' => 'charger']);

        $asc = collect($this->getJson('/api/shop/products?sort=price_asc')->json('data'))
            ->pluck('slug')->all();

        $this->assertSame(['charger', 'laptop'], $asc);

        $desc = collect($this->getJson('/api/shop/products?sort=price_desc')->json('data'))
            ->pluck('slug')->all();

        $this->assertSame(['laptop', 'charger'], $desc);
    }

    public function test_an_unknown_sort_is_rejected(): void
    {
        $this->getJson('/api/shop/products?sort=cheapest')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['sort']);
    }

    /**
     * A card showing only a name and a price cannot distinguish two ThinkPads
     * ₦200,000 apart. The specs must belong to the SAME machine the price came
     * from, or the card is quietly lying.
     */
    public function test_the_listing_carries_the_specs_of_the_machine_it_prices(): void
    {
        $product = Product::factory()->create(['slug' => 'elitebook']);

        ProductUnit::factory()->for($product)->create([
            'price' => 680_000,
            'specs' => ['cpu' => 'Core i7', 'ram_gb' => 32, 'storage_gb' => 1024],
        ]);
        ProductUnit::factory()->for($product)->create([
            'price' => 545_000,
            'specs' => ['cpu' => 'Core i5', 'ram_gb' => 8, 'storage_gb' => 256],
        ]);

        $card = collect($this->getJson('/api/shop/products')->json('data'))
            ->firstWhere('slug', 'elitebook');

        $this->assertSame(545_000, $card['from_price']);
        // The cheaper machine's specs, not the other one's.
        $this->assertSame(8, $card['summary_specs']['ram_gb']);
        $this->assertSame('Core i5', $card['summary_specs']['cpu']);
    }

    public function test_a_stocked_product_summarises_its_own_base_specs(): void
    {
        Product::factory()->stocked(stock: 5, price: 22_000)->create([
            'slug' => 'charger',
            'base_specs' => ['screen' => 'n/a'],
        ]);

        $card = collect($this->getJson('/api/shop/products')->json('data'))
            ->firstWhere('slug', 'charger');

        $this->assertSame(['screen' => 'n/a'], $card['summary_specs']);
    }

    /* ------------------------------------------------------------ efficiency */

    /**
     * The listing must stay a constant number of queries regardless of how many
     * products are on the page — otherwise a 24-item catalogue becomes ~50
     * round trips and the page crawls on a Lagos mobile connection.
     */
    public function test_the_listing_does_not_run_a_query_per_product(): void
    {
        for ($i = 0; $i < 12; $i++) {
            $this->laptop("laptop-{$i}", [600_000 + $i]);
        }

        DB::enableQueryLog();
        $this->getJson('/api/shop/products')->assertOk();
        $count = count(DB::getQueryLog());
        DB::disableQueryLog();

        $this->assertLessThan(10, $count, "Listing ran {$count} queries — likely an N+1.");
    }

    /* ------------------------------------------------------------- chrome */

    public function test_categories_only_include_ones_with_something_buyable(): void
    {
        $stocked = Category::factory()->create(['slug' => 'laptops']);
        $empty = Category::factory()->create(['slug' => 'empty']);

        $product = Product::factory()->for($stocked)->create();
        ProductUnit::factory()->for($product)->create();

        $slugs = collect($this->getJson('/api/shop/categories')->json('data'))->pluck('slug');

        $this->assertTrue($slugs->contains('laptops'));
        $this->assertFalse($slugs->contains('empty'));
        $this->assertNotNull($empty);
    }

    public function test_delivery_zones_are_public(): void
    {
        DeliveryZone::factory()->create(['slug' => 'lagos', 'fee' => 3_500]);

        $this->getJson('/api/shop/delivery-zones')
            ->assertOk()
            ->assertJsonPath('data.0.fee', 3500);
    }

    public function test_the_facets_reflect_only_available_stock(): void
    {
        $available = $this->laptop('available', [620_000], ['brand' => 'HP']);
        $goneProduct = $this->laptop('gone', [900_000], ['brand' => 'Toshiba']);
        $order = $this->soldTo();
        $goneProduct->units->each->markSold($order->id, $order->reference);

        $brands = $this->getJson('/api/shop/products/filters')->json('data.brands');

        // Offering a filter that returns nothing produces an empty page and a
        // confused buyer.
        $this->assertContains('HP', $brands);
        $this->assertNotContains('Toshiba', $brands);
        $this->assertNotNull($available);
    }

    public function test_the_filters_route_is_not_swallowed_by_the_slug_route(): void
    {
        $this->getJson('/api/shop/products/filters')
            ->assertOk()
            ->assertJsonStructure(['data' => ['brands', 'conditions', 'price_range']]);
    }
}
