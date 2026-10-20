<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GroqEnrichmentService
{
    private string $apiKey;
    private string $model;

    public function __construct()
    {
        $this->apiKey = (string) env('GROQ_API_KEY', '');
        $this->model = (string) env('GROQ_MODEL', 'openai/gpt-oss-120b');
    }

    /**
     * Synthesizes commercial copy, highlights, and SEO tags via Groq LLM.
     *
     * @return array<string, mixed>
     */
    public function generateCopy(Product $product): array
    {
        $categoryName = $product->category?->name ?? 'Electronics';
        $brand = $product->brand ?? 'Genuine';
        $priceFormatted = $product->price ? number_format($product->price) . ' NGN' : 'Variable';
        $warranty = $product->warranty_months > 0 ? "{$product->warranty_months} months warranty" : 'showroom warranty';

        $systemPrompt = <<<PROMPT
You are an expert e-commerce catalog copywriter for 'Gadgets Garden', a premier electronics and computer retailer located at 12 Oshitelu Street, Computer Village, Ikeja, Lagos, Nigeria.

CRITICAL INSTRUCTIONS:
1. Carefully analyze the PRODUCT TYPE from the name, category, and brand.
   - If it is a BAG, BACKPACK, CASE, or SLEEVE (e.g. Targus backpack, laptop bag): Describe storage compartments, padded laptop sleeve, water-resistant weather fabric, ergonomic breathable shoulder straps, sturdy zippers, and daily commute durability. NEVER mention CPUs, RAM, displays, screen refresh rates, graphics cards, thermal paste, or hardware diagnostics!
   - If it is a CHARGER, CABLE, or POWER ADAPTER (e.g. Anker, Baseus GaN charger): Describe charging wattage, GaN efficiency, surge/heat protection, compact plug design, fast power delivery, and multi-device compatibility (MacBook, Windows, smartphones).
   - If it is a MOUSE, KEYBOARD, or PERIPHERAL: Describe silent clicks, ergonomic grip, DPI sensor tracking, long battery life, and wireless range.
   - If it is a USB-C HUB, DOCK, or ADAPTER: Describe port versatility (HDMI 4K, USB 3.0, SD card reader, PD pass-through), aluminum heat dissipation, and plug-and-play ease.
   - If it is a LAPTOP, DESKTOP, or WORKSTATION: Describe processor performance, multi-tasking capabilities, battery longevity, keyboard typing experience, anti-glare display, and our 25-point hardware certification.

2. Tone: Confident, professional, tailored for Nigerian professionals, developers, students, and businesses. Mention Ikeja, Lagos showroom pickup and nationwide doorstep delivery.

Return ONLY a valid JSON object with EXACTLY these keys:
{
  "short_description": "A compelling 1-sentence punchy tagline for the product listing.",
  "description": "2-3 well-structured paragraphs explaining the product features, durability, practical everyday benefits, and warranty assurance.",
  "highlights": [
    "Key feature 1 with tangible benefit",
    "Key feature 2 with tangible benefit",
    "Key feature 3 with tangible benefit",
    "Key feature 4 with tangible benefit"
  ],
  "meta_title": "SEO-optimized title under 65 chars including brand, product name, and Nigeria/Lagos.",
  "meta_description": "Compelling 150-160 char meta description with target keywords and price/value call to action.",
  "seo_keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5"]
}
PROMPT;

        $userPrompt = "Product Name: {$product->name}\nBrand: {$brand}\nCategory: {$categoryName}\nType: {$product->kind}\nWarranty: {$warranty}\nPrice: {$priceFormatted}";
 
        if (empty($this->apiKey)) {
            return $this->fallbackCopy($product);
        }

        try {
            $response = Http::withToken($this->apiKey)
                ->timeout(12)
                ->post('https://api.groq.com/openai/v1/chat/completions', [
                    'model' => $this->model,
                    'messages' => [
                        ['role' => 'system', 'content' => $systemPrompt],
                        ['role' => 'user', 'content' => $userPrompt],
                    ],
                    'response_format' => ['type' => 'json_object'],
                    'temperature' => 0.4,
                ]);

            if ($response->successful()) {
                $content = $response->json('choices.0.message.content');
                if ($content) {
                    $parsed = json_decode($content, true);
                    if (is_array($parsed) && isset($parsed['description'], $parsed['highlights'])) {
                        return [
                            'short_description' => $parsed['short_description'] ?? "Premium {$product->name} available at Gadgets Garden.",
                            'description' => $parsed['description'],
                            'highlights' => is_array($parsed['highlights']) ? array_slice($parsed['highlights'], 0, 5) : [],
                            'meta_title' => $parsed['meta_title'] ?? "{$product->name} - Gadgets Garden Lagos",
                            'meta_description' => $parsed['meta_description'] ?? "Buy {$product->name} at best price in Lagos, Nigeria.",
                            'seo_keywords' => is_array($parsed['seo_keywords'] ?? null) ? $parsed['seo_keywords'] : [],
                        ];
                    }
                }
            } else {
                Log::warning('Groq API error: ' . $response->body());
            }
        } catch (\Throwable $e) {
            Log::error('Groq API connection exception: ' . $e->getMessage());
        }

        // Context-aware fallback if Groq API fails
        return $this->fallbackCopy($product);
    }

    /**
     * Discovers authentic, high-resolution photography candidates tailored to the exact product category.
     *
     * @return array<array<string, string>>
     */
    public function discoverImages(Product $product): array
    {
        $name = strtolower($product->name);
        $brand = strtolower($product->brand ?? '');
        $category = strtolower($product->category?->slug ?? '');

        // 1. BACKPACKS, BAGS & SLEEVES (Official Targus OEM Images)
        if (str_contains($name, 'backpack') || str_contains($name, 'bag') || str_contains($name, 'sleeve') || str_contains($brand, 'targus')) {
            return [
                [
                    'url' => 'https://cdn.shopify.com/s/files/1/0121/0014/1114/files/TSB966GL-92_MAIN2.jpg',
                    'alt' => "{$product->name} Official Targus Showcase Angle",
                    'label' => 'Official Targus Showcase Angle',
                ],
                [
                    'url' => 'https://us.targus.com/cdn/shop/files/TSB966GL-92_FRONT.jpg',
                    'alt' => "{$product->name} Official Front View",
                    'label' => 'Official Front View',
                ],
                [
                    'url' => 'https://cdn.shopify.com/s/files/1/0121/0014/1114/files/TSB966GL_PREMIUM_CAPACITY.jpg',
                    'alt' => "{$product->name} Official Padded Laptop Compartment & Storage",
                    'label' => 'Official Laptop Compartment & Capacity',
                ],
                [
                    'url' => 'https://cdn.shopify.com/s/files/1/0121/0014/1114/files/TSB966GL-92_BACK.jpg',
                    'alt' => "{$product->name} Official Air-Mesh Back Panel & Straps",
                    'label' => 'Official Back Panel & Straps',
                ],
            ];
        }

        // 2. CHARGERS, ADAPTERS & POWER (Official Anker OEM Images)
        if (str_contains($name, 'charger') || str_contains($name, 'adapter') || str_contains($name, 'gan') || str_contains($brand, 'anker') || str_contains($name, '65w')) {
            return [
                [
                    'url' => 'https://cdn.shopify.com/s/files/1/0493/9834/9974/files/A2667113_TD01_V1_1.png',
                    'alt' => "{$product->name} Official Anker 65W GaN Fast Charger",
                    'label' => 'Official Anker 65W GaN Charger',
                ],
                [
                    'url' => 'https://cdn.shopify.com/s/files/1/0493/9834/9974/products/A2667111_TD02_V4.jpg',
                    'alt' => "{$product->name} Official Multi-Port Charging Ports",
                    'label' => 'Official USB-C & USB-A Ports',
                ],
                [
                    'url' => 'https://cdn.shopify.com/s/files/1/0493/9834/9974/products/A2667111_TD03_V4.jpg',
                    'alt' => "{$product->name} Official Compact Size Factor",
                    'label' => 'Official Compact Size Factor',
                ],
                [
                    'url' => 'https://cdn.shopify.com/s/files/1/0493/9834/9974/products/A2667111_TD04_V4.jpg',
                    'alt' => "{$product->name} Official Multi-Device Power Delivery",
                    'label' => 'Official Multi-Device Charging',
                ],
            ];
        }

        // 3. MICE, KEYBOARDS & PERIPHERALS (Official Logitech OEM Images)
        if (str_contains($name, 'mouse') || str_contains($name, 'keyboard') || str_contains($brand, 'logitech')) {
            return [
                [
                    'url' => 'https://resource.logitech.com/w_544,h_466,ar_7:6,c_pad,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/mice/m185/gallery/2025-update-assets/m185-grey-top-angle-1.png',
                    'alt' => "{$product->name} Official Logitech Wireless Mouse Top View",
                    'label' => 'Official Logitech Wireless Top View',
                ],
                [
                    'url' => 'https://resource.logitech.com/c_fill,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/mice/pebble-mouse-2-m350s/2026-refresh/gallery/pebble-mouse-2-m350s-tonal-graphite-top-angle-gallery-1.png',
                    'alt' => "{$product->name} Official Logitech Silent Mouse Profile",
                    'label' => 'Official Silent Mouse Profile',
                ],
            ];
        }

        // 4. USB-C HUBS & DOCKING STATIONS (Official Baseus OEM Images)
        if (str_contains($name, 'hub') || str_contains($name, 'dock') || str_contains($brand, 'baseus')) {
            return [
                [
                    'url' => 'https://cdn.shopify.com/s/files/1/0555/8432/5709/files/B00030708811-00_Baseus_Joystar_7_in_1_USB-C_Hub_1.jpg',
                    'alt' => "{$product->name} Official Baseus Aluminum 7-in-1 Hub",
                    'label' => 'Official Aluminum Hub Showcase',
                ],
                [
                    'url' => 'https://cdn.shopify.com/s/files/1/0555/8432/5709/files/B00030708811-00_Baseus_Joystar_7_in_1_USB-C_Hub_0_02.jpg',
                    'alt' => "{$product->name} Official HDMI & 100W PD Ports",
                    'label' => 'Official 4K HDMI & 100W PD Ports',
                ],
                [
                    'url' => 'https://cdn.shopify.com/s/files/1/0555/8432/5709/files/B00030708811-00_Baseus_Joystar_7_in_1_USB-C_Hub_0_03.jpg',
                    'alt' => "{$product->name} Official SD/TF Card & USB 3.0 Expansion",
                    'label' => 'Official SD/TF Card & USB 3.0 Ports',
                ],
            ];
        }


        // 5. HP ELITEBOOK & SPECTRE
        if (str_contains($name, 'elitebook') || str_contains($name, '840')) {
            return [
                [
                    'url' => 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=1200&q=80',
                    'alt' => "{$product->name} Front View",
                    'label' => 'Front Display & Keyboard',
                ],
                [
                    'url' => 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=1200&q=80',
                    'alt' => "{$product->name} Side Profile",
                    'label' => 'Side Ports & Slim Profile',
                ],
                [
                    'url' => 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80',
                    'alt' => "{$product->name} Open View",
                    'label' => 'Keyboard & Trackpad View',
                ],
            ];
        }

        // 6. DELL LATITUDE & XPS
        if (str_contains($name, 'latitude') || str_contains($name, '7420') || str_contains($name, 'xps') || $brand === 'dell') {
            return [
                [
                    'url' => 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=1200&q=80',
                    'alt' => "{$product->name} Showcase Front",
                    'label' => 'InfinityEdge Display View',
                ],
                [
                    'url' => 'https://images.unsplash.com/photo-1593642702821-c8da6771f0c6?auto=format&fit=crop&w=1200&q=80',
                    'alt' => "{$product->name} Angled View",
                    'label' => 'Angled Workspace View',
                ],
            ];
        }

        // 7. LENOVO THINKPAD
        if (str_contains($name, 'thinkpad') || str_contains($name, 'x1 carbon') || $brand === 'lenovo') {
            return [
                [
                    'url' => 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=1200&q=80',
                    'alt' => "{$product->name} Matte Black Chassis",
                    'label' => 'Signature ThinkPad Chassis',
                ],
                [
                    'url' => 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80',
                    'alt' => "{$product->name} Ergonomic Keyboard",
                    'label' => 'TrackPoint & Keyboard Layout',
                ],
            ];
        }

        // 8. GAMING LAPTOPS & ALIENWARE
        if (str_contains($name, 'alienware') || str_contains($name, 'legion') || str_contains($name, 'gaming') || $category === 'gaming') {
            return [
                [
                    'url' => 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=1200&q=80',
                    'alt' => "{$product->name} High Refresh Display",
                    'label' => 'Gaming Display & Keyboard',
                ],
                [
                    'url' => 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
                    'alt' => "{$product->name} RGB Lighting & Vents",
                    'label' => 'Thermal Exhaust & RGB',
                ],
            ];
        }

        // 9. DEFAULT LAPTOP
        return [
            [
                'url' => 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1200&q=80',
                'alt' => "{$product->name} Clean Front View",
                'label' => 'Front Display View',
            ],
            [
                'url' => 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80',
                'alt' => "{$product->name} Keyboard View",
                'label' => 'Keyboard & Trackpad',
            ],
        ];
    }

    /**
     * Accurate category-specific fallback when Groq is unavailable.
     */
    private function fallbackCopy(Product $product): array
    {
        $name = $product->name;
        $brand = $product->brand ?? 'Genuine';
        $warranty = $product->warranty_months > 0 ? "{$product->warranty_months} months warranty" : 'showroom warranty';
        $lower = strtolower($name);

        if (str_contains($lower, 'backpack') || str_contains($lower, 'bag') || str_contains($lower, 'sleeve')) {
            return [
                'short_description' => "{$name} by {$brand} — water-resistant, padded, and ergonomically built for daily commuting in Lagos.",
                'description' => "The {$name} by {$brand} delivers dependable gear protection and organized storage for professionals, students, and frequent commuters. Featuring a dedicated shock-absorbing laptop compartment and multiple quick-access zip pockets, it keeps your tech and daily essentials secure and neat.\n\nCrafted from durable, weather-resistant fabric with reinforced stress-point stitching and breathable mesh shoulder padding, this bag ensures comfortable all-day wear. Inspected and backed by our Gadgets Garden {$warranty}.",
                'highlights' => [
                    'Dedicated padded compartment for safe laptop and tablet transport',
                    'Weather-resistant outer shell with heavy-duty reinforced zippers',
                    'Multi-pocket organizer for chargers, documents, cables, and pens',
                    'Ergonomic breathable mesh shoulder straps for long commutes',
                ],
                'meta_title' => "{$name} by {$brand} - Buy Online Lagos | Gadgets Garden",
                'meta_description' => "Get the authentic {$name} at Gadgets Garden, Computer Village. Padded protection, weather resistance, and nationwide delivery.",
                'seo_keywords' => ["{$brand} laptop bag", "laptop backpack Lagos", "computer bag Nigeria", "durable backpack Ikeja"],
            ];
        }

        if (str_contains($lower, 'charger') || str_contains($lower, 'adapter')) {
            return [
                'short_description' => "{$name} by {$brand} — high-speed GaN fast charger with multi-device surge and temperature protection.",
                'description' => "Charge your devices rapidly and safely with the {$name}. Built with advanced semiconductor technology, it delivers high-wattage charging in a compact, portable form factor. Engineered with intelligent heat control and over-voltage safeguards to protect your valuable laptops and smartphones.\n\nTested and verified at our Computer Village showroom with {$warranty}.",
                'highlights' => [
                    'Fast high-efficiency power delivery for laptops and smartphones',
                    'Advanced thermal management prevents overheating during peak load',
                    'Compact lightweight form factor ideal for travel and daily carry',
                    'Built-in surge, short-circuit, and over-current device protection',
                ],
                'meta_title' => "{$name} by {$brand} - Fast Charger Nigeria | Gadgets Garden",
                'meta_description' => "Shop original {$name} in Lagos. Fast power delivery, safe GaN technology, and showroom warranty.",
                'seo_keywords' => ["{$brand} charger", "USB-C fast charger Lagos", "laptop charger Computer Village", "GaN charger Nigeria"],
            ];
        }

        // Default laptop copy
        return [
            'short_description' => "{$name} by {$brand} — certified performance with {$warranty} at Gadgets Garden.",
            'description' => "The {$name} is built for demanding workloads, corporate productivity, and creative workflows. Each unit undergoes our comprehensive 25-point hardware diagnostic test in Ikeja, Lagos—verifying battery longevity, display quality, and thermal stability.\n\nBacked by {$warranty} and direct doorstep delivery across Nigeria.",
            'highlights' => [
                'Tested and certified in our Computer Village showroom with verified hardware health',
                'Crisp display engineered for comfortable extended work sessions',
                'Durable chassis built to withstand daily commuting and desk use',
                'Full connectivity suite with USB, HDMI, and fast charging support',
            ],
            'meta_title' => "{$name} - Best Price in Nigeria | Gadgets Garden",
            'meta_description' => "Buy certified {$name} at Gadgets Garden Computer Village. Verified hardware, {$warranty}, and nationwide shipping.",
            'seo_keywords' => ["used laptops Lagos", "{$name} price Nigeria", "Computer Village laptop deals", "refurbished laptops Ikeja"],
        ];
    }
}
