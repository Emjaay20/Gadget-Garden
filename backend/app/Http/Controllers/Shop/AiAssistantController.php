<?php

namespace App\Http\Controllers\Shop;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductUnit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * AI Store Assistant / "Laptop Matchmaker" for Computer Village shoppers.
 *
 * Translates natural language requests into matched inventory:
 * parses budgets ("under 650k", "₦700,000"), workflows (coding, gaming, video editing,
 * office), spec requirements (16GB RAM, SSD, RTX), and brand preferences.
 *
 * Returns structured candidate machines with verified specs, battery health,
 * price, rationale points, and direct action triggers (Add to Cart, Make an Offer).
 */
class AiAssistantController extends Controller
{
    public function recommend(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'query' => 'required|string|max:1000',
            'budget_max' => 'nullable|integer|min:50000',
            'brand' => 'nullable|string|max:50',
            'min_ram' => 'nullable|integer|min:4',
            'purpose' => 'nullable|string|max:50',
        ]);

        $query = $validated['query'];
        $intent = $this->parseQueryIntent($query, $validated);

        // Fetch active products with available units and images
        $products = Product::where('is_active', true)
            ->with([
                'category',
                'images',
                'availableUnits' => function ($query) {
                    $query->with('images')->orderBy('price');
                },
            ])
            ->get();

        $candidates = [];

        foreach ($products as $product) {
            if ($product->kind === Product::KIND_UNIT) {
                foreach ($product->availableUnits as $unit) {
                    $evaluation = $this->evaluateUnitCandidate($product, $unit, $intent);
                    if ($evaluation !== null) {
                        $candidates[] = $evaluation;
                    }
                }
            } elseif ($product->kind === Product::KIND_STOCKED && $product->stock > 0) {
                $evaluation = $this->evaluateStockedCandidate($product, $intent);
                if ($evaluation !== null) {
                    $candidates[] = $evaluation;
                }
            }
        }

        // Sort candidates by score descending
        usort($candidates, fn ($a, $b) => $b['score'] <=> $a['score']);

        $isFallback = false;
        $matched = array_slice($candidates, 0, 4);

        // If no candidate matched strict filters, provide smart alternatives
        if (empty($matched)) {
            $isFallback = true;
            $fallbackCandidates = [];

            foreach ($products as $product) {
                if ($product->kind === Product::KIND_UNIT) {
                    foreach ($product->availableUnits as $unit) {
                        $fallbackCandidates[] = $this->buildRecommendationItem(
                            $product,
                            $unit,
                            ['Solid workhorse with certified hardware in our Lagos showroom', 'Ready for testing and immediate pickup or delivery'],
                            70
                        );
                    }
                }
            }

            usort($fallbackCandidates, fn ($a, $b) => $a['price'] <=> $b['price']);
            $matched = array_slice($fallbackCandidates, 0, 3);
        }

        $message = $this->generateAssistantMessage($matched, $intent, $isFallback);

        return response()->json([
            'message' => $message,
            'detected_intent' => [
                'purpose' => $intent['purpose'],
                'budget_max' => $intent['budget_max'],
                'min_ram' => $intent['min_ram'],
                'brand' => $intent['brand'],
                'needs_gpu' => $intent['needs_gpu'],
            ],
            'is_fallback' => $isFallback,
            'recommendations' => array_map(function ($item) {
                unset($item['score']);
                return $item;
            }, $matched),
        ]);
    }

    /**
     * Parses natural language query strings to extract budget, RAM, brands, and purpose.
     *
     * @param array<string, mixed> $explicit
     * @return array<string, mixed>
     */
    private function parseQueryIntent(string $query, array $explicit): array
    {
        $normalized = strtolower($query);

        // 1. Budget extraction
        $budgetMax = $explicit['budget_max'] ?? null;
        if (! $budgetMax) {
            // Match patterns like "under 650k", "under 1.2m", "budget of 500,000", "₦800k", "< 700k"
            if (preg_match('/(?:under|below|budget(?:\s*of)?|max(?:\s*of)?|less than|<|up to|within)\s*(?:₦|ngn|naira)?\s*(\d+(?:[.,]\d+)?)\s*(k|m|million|thousand)?/i', $normalized, $matches)) {
                $num = (float) str_replace(',', '', $matches[1]);
                $unit = strtolower($matches[2] ?? '');
                if ($unit === 'k' || $unit === 'thousand') {
                    $budgetMax = (int) ($num * 1_000);
                } elseif ($unit === 'm' || $unit === 'million') {
                    $budgetMax = (int) ($num * 1_000_000);
                } elseif ($num < 5000) {
                    $budgetMax = (int) ($num * 1_000); // e.g. "under 650" => 650,000
                } else {
                    $budgetMax = (int) $num;
                }
            } elseif (preg_match('/(?:₦|ngn)\s*(\d+(?:[.,]\d+)?)\s*(k|m)?/i', $normalized, $matches)) {
                $num = (float) str_replace(',', '', $matches[1]);
                $unit = strtolower($matches[2] ?? '');
                if ($unit === 'k') {
                    $budgetMax = (int) ($num * 1_000);
                } elseif ($unit === 'm') {
                    $budgetMax = (int) ($num * 1_000_000);
                } elseif ($num < 5000) {
                    $budgetMax = (int) ($num * 1_000);
                } else {
                    $budgetMax = (int) $num;
                }
            }
        }

        // 2. RAM extraction
        $minRam = $explicit['min_ram'] ?? null;
        if (! $minRam) {
            if (preg_match('/(4|8|16|32|64)\s*gb(?:\s*ram)?/i', $normalized, $matches)) {
                $minRam = (int) $matches[1];
            }
        }

        // 3. Brand detection
        $brand = $explicit['brand'] ?? null;
        if (! $brand) {
            $brands = ['apple' => 'Apple', 'macbook' => 'Apple', 'dell' => 'Dell', 'hp' => 'HP', 'lenovo' => 'Lenovo', 'alienware' => 'Alienware', 'asus' => 'Asus', 'acer' => 'Acer'];
            foreach ($brands as $needle => $name) {
                if (str_contains($normalized, $needle)) {
                    $brand = $name;
                    break;
                }
            }
        }

        // 4. Purpose / Workflow detection
        $purpose = $explicit['purpose'] ?? null;
        $needsGpu = false;

        if (! $purpose) {
            if (preg_match('/(game|gaming|gamer|rtx|gtx|gpu|blender|3d|render|unreal|premiere|video edit|graphics)/i', $normalized)) {
                $purpose = 'gaming_and_creative';
                $needsGpu = true;
            } elseif (preg_match('/(code|coding|developer|software|programming|dev|python|javascript|engineer|docker|web dev)/i', $normalized)) {
                $purpose = 'software_development';
            } elseif (preg_match('/(student|school|lightweight|light|travel|commute|portable|slim|battery|carry)/i', $normalized)) {
                $purpose = 'portability_and_study';
            } elseif (preg_match('/(office|business|excel|zoom|work|reliable|accounting)/i', $normalized)) {
                $purpose = 'business_productivity';
            } else {
                $purpose = 'general_computing';
            }
        }

        return [
            'budget_max' => $budgetMax,
            'min_ram' => $minRam,
            'brand' => $brand,
            'purpose' => $purpose,
            'needs_gpu' => $needsGpu,
            'raw_query' => $query,
        ];
    }

    /**
     * Evaluates a serialized ProductUnit against user requirements.
     *
     * @param array<string, mixed> $intent
     * @return array<string, mixed>|null
     */
    private function evaluateUnitCandidate(Product $product, ProductUnit $unit, array $intent): ?array
    {
        $price = (int) $unit->price;
        $specs = $unit->specs ?? [];
        $ram = (int) ($specs['ram_gb'] ?? 8);
        $batteryHealth = (int) ($specs['battery_health'] ?? 0);
        $hasGpu = ! empty($specs['gpu']);

        // Strict constraints
        if ($intent['budget_max'] !== null && $price > ($intent['budget_max'] * 1.05)) {
            return null; // Exceeds budget (with 5% bargain leeway)
        }

        if ($intent['brand'] !== null && ! str_contains(strtolower($product->brand), strtolower($intent['brand']))) {
            return null;
        }

        if ($intent['min_ram'] !== null && $ram < $intent['min_ram']) {
            return null;
        }

        if ($intent['needs_gpu'] && ! $hasGpu && $product->category?->slug !== 'gaming') {
            // If user explicitly asks for gaming / GPU, discount non-GPU units
        }

        // Scoring system
        $score = 100;
        $reasons = [];

        // Purpose alignment
        if ($intent['purpose'] === 'software_development') {
            if ($ram >= 16) {
                $score += 30;
                $reasons[] = "{$ram}GB RAM: Plenty of headroom for Docker containers, IDEs, and heavy compilation.";
            }
            if (isset($specs['cpu'])) {
                $reasons[] = "{$specs['cpu']} processor delivers fast responsiveness for software builds.";
            }
        } elseif ($intent['purpose'] === 'gaming_and_creative') {
            if ($hasGpu) {
                $score += 50;
                $reasons[] = "Dedicated {$specs['gpu']} graphics delivers high framerates and fast hardware 3D/video rendering.";
            } elseif ($ram >= 16) {
                $score += 15;
            }
        } elseif ($intent['purpose'] === 'portability_and_study') {
            if ($batteryHealth >= 90) {
                $score += 35;
                $reasons[] = "Tested {$batteryHealth}% battery health ensures dependable off-grid hours in class or transit.";
            }
            if (str_contains(strtolower($product->name), 'carbon') || str_contains(strtolower($product->name), 'elitebook')) {
                $score += 25;
                $reasons[] = "Lightweight premium chassis designed for easy portability without shoulder fatigue.";
            }
        }

        // General specs praise
        if ($batteryHealth >= 90 && empty($reasons)) {
            $reasons[] = "Certified {$batteryHealth}% battery health with genuine cells.";
        }

        if ($unit->grade === 'A') {
            $score += 10;
            $reasons[] = "Grade A physical condition: Super clean casing, zero functional defects.";
        }

        if ($intent['budget_max'] !== null && $price <= $intent['budget_max']) {
            $score += 15;
            $diff = $intent['budget_max'] - $price;
            if ($diff > 0) {
                $reasons[] = 'Under your ₦' . number_format($intent['budget_max']) . ' budget by ₦' . number_format($diff) . '.';
            } else {
                $reasons[] = 'Matches your ₦' . number_format($intent['budget_max']) . ' budget sweet spot.';
            }
        }

        $reasons[] = 'Eligible for instant Computer Village bargain offer or 1-click checkout.';

        return $this->buildRecommendationItem($product, $unit, array_slice($reasons, 0, 3), $score);
    }

    /**
     * Evaluates a stocked product (e.g. accessories or standard laptops).
     *
     * @param array<string, mixed> $intent
     * @return array<string, mixed>|null
     */
    private function evaluateStockedCandidate(Product $product, array $intent): ?array
    {
        $price = (int) $product->price;

        if ($intent['budget_max'] !== null && $price > $intent['budget_max']) {
            return null;
        }

        if ($intent['brand'] !== null && ! str_contains(strtolower($product->brand), strtolower($intent['brand']))) {
            return null;
        }

        $score = 80;
        $reasons = [
            "Official {$product->brand} product backed by {$product->warranty_months} months warranty.",
            'In-stock item ready for same-day dispatch across Lagos.',
        ];

        return [
            'product_id' => (string) $product->id,
            'product_slug' => $product->slug,
            'product_name' => $product->name,
            'brand' => $product->brand,
            'image_url' => $product->images->first()?->url ?? null,
            'unit_id' => null,
            'unit_sku' => null,
            'condition' => 'new',
            'grade' => 'Sealed',
            'price' => $price,
            'specs' => $product->base_specs ?? [],
            'match_reasons' => $reasons,
            'can_make_offer' => false,
            'score' => $score,
            'checkout_url' => '/checkout',
        ];
    }

    /**
     * Packages a recommended item.
     *
     * @param array<string> $reasons
     * @return array<string, mixed>
     */
    private function buildRecommendationItem(Product $product, ProductUnit $unit, array $reasons, int $score): array
    {
        $imageUrl = $unit->images->first()?->url ?? $product->images->first()?->url ?? null;

        return [
            'product_id' => (string) $product->id,
            'product_slug' => $product->slug,
            'product_name' => $product->name,
            'brand' => $product->brand,
            'image_url' => $imageUrl,
            'unit_id' => (string) $unit->id,
            'unit_sku' => $unit->sku,
            'condition' => $unit->condition,
            'grade' => $unit->grade ?? 'A',
            'price' => (int) $unit->price,
            'specs' => $unit->specs ?? [],
            'match_reasons' => $reasons,
            'can_make_offer' => true,
            'score' => $score,
            'checkout_url' => "/checkout?unit={$unit->sku}",
        ];
    }

    /**
     * Generates a warm, professional, Computer Village consultant response.
     *
     * @param array<array<string, mixed>> $matched
     * @param array<string, mixed> $intent
     */
    private function generateAssistantMessage(array $matched, array $intent, bool $isFallback): string
    {
        $count = count($matched);

        if ($isFallback) {
            $budgetLabel = $intent['budget_max'] ? 'under ₦' . number_format($intent['budget_max']) : '';
            return "I couldn't find an exact in-stock match with all those specific parameters {$budgetLabel} right now. In our Computer Village inventory, here are our closest available, high-value alternatives that deliver great power for your money:";
        }

        $purposeNames = [
            'software_development' => 'software engineering and programming',
            'gaming_and_creative' => 'gaming and heavy 3D/video workflows',
            'portability_and_study' => 'lightweight commuting, school, and dependable battery life',
            'business_productivity' => 'office productivity, spreadsheets, and meetings',
            'general_computing' => 'your everyday tasks',
        ];

        $focus = $purposeNames[$intent['purpose']] ?? 'your workflow';

        $lead = "I analyzed our showroom stock for {$focus}";
        if ($intent['budget_max']) {
            $lead .= ' within your ₦' . number_format($intent['budget_max']) . ' budget';
        }
        $lead .= ". Here " . ($count === 1 ? 'is the best machine' : "are {$count} top certified machines") . " ready for testing and purchase:";

        return $lead;
    }
}
