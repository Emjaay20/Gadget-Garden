<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\DeliveryZone;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\StockMovement;
use App\Models\UnitEvent;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * A catalogue that matches how the business really trades.
 *
 * Models and prices are taken from the shop's own Instagram (HP Pavilion 15 at
 * ₦600,000, Alienware X15 R1 at ₦1,900,000) so the storefront is developed
 * against realistic text lengths and figures — "₦1,900,000" and a long CPU
 * string are what break a card layout, not lorem.
 *
 * Two invariants this seeder deliberately obeys rather than shortcutting:
 *
 *   - Opening stock for a `stocked` product is written as a RESTOCK MOVEMENT,
 *     not an assignment, so the ledger is complete from its very first row and
 *     the seeded catalogue is bound by the same rule as everything after it.
 *   - Every unit gets an `acquired` event for the same reason.
 *
 * Idempotent: re-running computes a zero delta and writes nothing, so it cannot
 * stack restocks.
 */
class CatalogueSeeder extends Seeder
{
    public function run(): void
    {
        $categories = $this->seedCategories();
        $this->seedDeliveryZones();
        $this->seedLaptops($categories['laptops']);
        $this->seedAccessories($categories['accessories']);
    }

    /** @return array<string, Category> */
    private function seedCategories(): array
    {
        $rows = [
            ['laptops', 'Laptops', 'Premium new and foreign-used laptops for work, school and gaming.', 1],
            ['gaming', 'Gaming laptops', 'High-refresh machines with discrete graphics.', 2],
            ['accessories', 'Accessories', 'Chargers, bags, mice and everything in between.', 3],
        ];

        $categories = [];

        foreach ($rows as [$slug, $name, $description, $position]) {
            $categories[$slug] = Category::updateOrCreate(
                ['slug' => $slug],
                [
                    'name' => $name,
                    'description' => $description,
                    'position' => $position,
                    'is_active' => true,
                ],
            );
        }

        return $categories;
    }

    /**
     * PLACEHOLDER FEES. The real table is still outstanding from the client
     * (DESIGN.md §6) — these are plausible, not authoritative, and must be
     * replaced before launch.
     */
    private function seedDeliveryZones(): void
    {
        $rows = [
            ['pickup-store', 'In-Store Pickup (12 Oshitelu St, Computer Village)', 0, null, 0],
            ['lagos-mainland', 'Lagos (Mainland)', 3_500, 500_000, 1],
            ['lagos-island', 'Lagos (Island)', 5_000, 500_000, 2],
            ['south-west', 'South West', 7_500, 800_000, 3],
            ['nationwide', 'Other states', 10_000, 1_000_000, 4],
        ];

        foreach ($rows as [$slug, $name, $fee, $freeAbove, $position]) {
            DeliveryZone::updateOrCreate(
                ['slug' => $slug],
                [
                    'name' => $name,
                    'fee' => $fee,
                    'free_above' => $freeAbove,
                    'is_active' => true,
                    'position' => $position,
                ],
            );
        }
    }

    private function seedLaptops(Category $laptops): void
    {
        $listings = [
            [
                'slug' => 'hp-elitebook-840-g8',
                'name' => 'HP EliteBook 840 G8',
                'brand' => 'HP',
                'warranty' => 6,
                'short' => 'Business ultrabook — light, fast, and built to survive a commute.',
                'highlights' => [
                    '14" FHD anti-glare display',
                    'Backlit keyboard and fingerprint reader',
                    'Thunderbolt 4, HDMI and USB-A — no dongle required',
                ],
                'units' => [
                    ['GG-EB840-001', 620_000, 470_000, 'A', ['cpu' => 'Core i7-1165G7', 'ram_gb' => 16, 'storage_gb' => 512, 'storage_type' => 'SSD', 'screen' => '14" FHD', 'battery_health' => 94]],
                    ['GG-EB840-002', 545_000, 410_000, 'B', ['cpu' => 'Core i5-1135G7', 'ram_gb' => 16, 'storage_gb' => 256, 'storage_type' => 'SSD', 'screen' => '14" FHD', 'battery_health' => 88]],
                    ['GG-EB840-003', 680_000, 520_000, 'A', ['cpu' => 'Core i7-1165G7', 'ram_gb' => 32, 'storage_gb' => 1024, 'storage_type' => 'SSD', 'screen' => '14" FHD', 'battery_health' => 97]],
                ],
            ],
            [
                'slug' => 'dell-latitude-7420',
                'name' => 'Dell Latitude 7420',
                'brand' => 'Dell',
                'warranty' => 6,
                'short' => 'The reliable workhorse — the one that just keeps going.',
                'highlights' => [
                    '14" FHD display',
                    'Magnesium alloy chassis',
                    'All-day battery',
                ],
                'units' => [
                    ['GG-LAT742-001', 590_000, 445_000, 'A', ['cpu' => 'Core i7-1185G7', 'ram_gb' => 16, 'storage_gb' => 512, 'storage_type' => 'SSD', 'screen' => '14" FHD', 'battery_health' => 91]],
                    ['GG-LAT742-002', 505_000, 380_000, 'B', ['cpu' => 'Core i5-1145G7', 'ram_gb' => 8, 'storage_gb' => 256, 'storage_type' => 'SSD', 'screen' => '14" FHD', 'battery_health' => 82]],
                ],
            ],
            [
                'slug' => 'lenovo-thinkpad-x1-carbon-gen-9',
                'name' => 'Lenovo ThinkPad X1 Carbon Gen 9',
                'brand' => 'Lenovo',
                'warranty' => 6,
                'short' => 'Under 1.2kg, and the best keyboard on any laptop.',
                'highlights' => [
                    '14" WUXGA display',
                    'Carbon fibre chassis, 1.13kg',
                    'MIL-STD-810H tested',
                ],
                'units' => [
                    ['GG-X1C9-001', 785_000, 600_000, 'A', ['cpu' => 'Core i7-1165G7', 'ram_gb' => 16, 'storage_gb' => 512, 'storage_type' => 'SSD', 'screen' => '14" WUXGA', 'battery_health' => 95]],
                ],
            ],
        ];

        foreach ($listings as $listing) {
            $this->seedUnitListing($laptops, $listing);
        }

        $this->seedGamingListing();
    }

    private function seedGamingListing(): void
    {
        $gaming = Category::where('slug', 'gaming')->firstOrFail();

        $this->seedUnitListing($gaming, [
            'slug' => 'alienware-x15-r1',
            'name' => 'Alienware X15 R1',
            'brand' => 'Alienware',
            'warranty' => 3,
            'short' => 'Desktop-class performance in a 15.6" chassis under 16mm thick.',
            'highlights' => [
                '15.6" 360Hz FHD display',
                'RTX 3080 graphics',
                'Cherry MX ultra-low-profile keyboard',
            ],
            'featured' => true,
            'units' => [
                ['GG-AWX15-001', 1_900_000, 1_480_000, 'A', ['cpu' => 'Core i9-11900H', 'ram_gb' => 32, 'storage_gb' => 1024, 'storage_type' => 'SSD', 'screen' => '15.6" 360Hz', 'gpu' => 'RTX 3080 8GB', 'battery_health' => 90]],
            ],
        ]);

        $this->seedUnitListing($gaming, [
            'slug' => 'hp-pavilion-15',
            'name' => 'HP Pavilion 15',
            'brand' => 'HP',
            'warranty' => 12,
            'short' => 'Brand new, sealed — the everyday all-rounder.',
            'featured' => true,
            'short_condition' => ProductUnit::CONDITION_NEW,
            'highlights' => [
                '15.6" FHD display',
                'Sealed retail box with full warranty',
            ],
            'units' => [
                ['GG-PAV15-001', 600_000, 505_000, null, ['cpu' => 'Core i5-1235U', 'ram_gb' => 8, 'storage_gb' => 512, 'storage_type' => 'SSD', 'screen' => '15.6" FHD']],
                ['GG-PAV15-002', 600_000, 505_000, null, ['cpu' => 'Core i5-1235U', 'ram_gb' => 8, 'storage_gb' => 512, 'storage_type' => 'SSD', 'screen' => '15.6" FHD']],
            ],
        ]);
    }

    /**
     * @param  array<string, mixed>  $listing
     */
    private function seedUnitListing(Category $category, array $listing): void
    {
        $product = Product::updateOrCreate(
            ['slug' => $listing['slug']],
            [
                'name' => $listing['name'],
                'brand' => $listing['brand'],
                'kind' => Product::KIND_UNIT,
                'category_id' => $category->id,
                'short_description' => $listing['short'],
                'description' => $listing['short'],
                'highlights' => $listing['highlights'],
                'warranty_months' => $listing['warranty'],
                'is_featured' => $listing['featured'] ?? false,
                'is_active' => true,
            ],
        );

        $condition = $listing['short_condition'] ?? ProductUnit::CONDITION_FOREIGN_USED;

        foreach ($listing['units'] as [$sku, $price, $cost, $grade, $specs]) {
            $existing = ProductUnit::where('sku', $sku)->first();

            if ($existing) {
                continue;
            }

            $unit = ProductUnit::create([
                'product_id' => $product->id,
                'sku' => $sku,
                'serial' => Str::upper(Str::random(12)),
                'condition' => $condition,
                'grade' => $grade,
                'specs' => $specs,
                'price' => $price,
                'cost' => $cost,
            ]);

            // The ledger is complete from the unit's first moment.
            $unit->recordEvent(
                UnitEvent::ACQUIRED,
                null,
                ProductUnit::STATUS_AVAILABLE,
                ['note' => 'Seeded opening stock.'],
            );
        }
    }

    private function seedAccessories(Category $accessories): void
    {
        $rows = [
            ['gg-charger-65w', '65W USB-C Charger', 'Anker', 22_000, 28_000, 24, 'Universal 65W GaN charger — one brick for laptop and phone.'],
            ['gg-laptop-bag-15', '15" Laptop Backpack', 'Targus', 18_500, null, 15, 'Padded 15" compartment, water-resistant shell.'],
            ['gg-wireless-mouse', 'Wireless Mouse', 'Logitech', 12_000, 15_000, 40, 'Silent-click wireless mouse, 18-month battery.'],
            ['gg-usb-c-hub', '7-in-1 USB-C Hub', 'Baseus', 26_000, null, 8, 'HDMI, ethernet, SD and three USB-A from one port.'],
        ];

        foreach ($rows as [$slug, $name, $brand, $price, $compareAt, $openingStock, $short]) {
            $product = Product::where('slug', $slug)->first();

            if (! $product) {
                $product = new Product([
                    'slug' => $slug,
                    'name' => $name,
                    'brand' => $brand,
                    'kind' => Product::KIND_STOCKED,
                    'category_id' => $accessories->id,
                    'short_description' => $short,
                    'description' => $short,
                    'warranty_months' => 3,
                    'price' => $price,
                    'compare_at_price' => $compareAt,
                    'low_stock_threshold' => 5,
                    'is_active' => true,
                ]);

                /*
                 | `stock` is not fillable (it belongs to the ledger), but the
                 | CHECK constraint requires a `stocked` product to carry one
                 | from its very first INSERT — so it is forced to 0 BEFORE the
                 | save rather than patched in afterwards, which would try to
                 | insert a NULL and be refused.
                 |
                 | The opening quantity then arrives as a restock MOVEMENT below,
                 | never as an assignment, keeping the ledger continuous from
                 | row one.
                 */
                $product->forceFill(['stock' => 0]);
                $product->save();
            }

            // Idempotent: on a re-run the delta is zero and nothing is written.
            $delta = $openingStock - (int) $product->stock;

            if ($delta !== 0) {
                $product->recordStockMovement([
                    'delta' => $delta,
                    'reason' => StockMovement::RESTOCK,
                    'note' => 'Seeded opening stock.',
                ]);
            }
        }
    }
}
