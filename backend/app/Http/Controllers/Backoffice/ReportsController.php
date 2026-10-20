<?php

namespace App\Http\Controllers\Backoffice;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\ProductUnit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Sales reporting. Behind `reports.view` — margin exposes what the business
 * paid, which is why it is a separate permission from fulfilment.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT COUNTS AS A SALE
 *
 * Only orders that reached `paid` or beyond, dated by `paid_at` rather than
 * `placed_at`. An order placed on the 31st and paid on the 1st belongs to the
 * new month's revenue — that is when the money arrived, and it is what the
 * business will reconcile against its bank statement.
 *
 * Cancelled and failed orders are excluded outright. A refunded (cancelled)
 * order keeps its `paid_at`, so filtering on the timestamp alone would count
 * money that was given back.
 * ─────────────────────────────────────────────────────────────────────────────
 */
class ReportsController extends Controller
{
    /** Statuses that represent money the business actually kept. */
    private const EARNED = [
        Order::PAID,
        Order::PROCESSING,
        Order::SHIPPED,
        Order::DELIVERED,
    ];

    /**
     * GET /api/reports  ?from=&to=
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            // A rolling window, which is what the dashboard's range buttons
            // actually mean. Owning it here keeps "today" a server concept —
            // a caller computing the range from its own clock would disagree
            // across timezones, and computing it during a React render is
            // impure besides.
            'days' => ['nullable', 'integer', 'min:1', 'max:730'],
        ]);

        $to = isset($validated['to'])
            ? Carbon::parse($validated['to'])->endOfDay()
            : now()->endOfDay();

        $from = match (true) {
            isset($validated['from']) => Carbon::parse($validated['from'])->startOfDay(),
            isset($validated['days']) => $to->copy()->subDays($validated['days'] - 1)->startOfDay(),
            default => $to->copy()->subDays(29)->startOfDay(),
        };

        return response()->json([
            'data' => [
                'range' => [
                    'from' => $from->toDateString(),
                    'to' => $to->toDateString(),
                    'days' => $from->diffInDays($to) + 1,
                ],
                'summary' => $this->summary($from, $to),
                'revenue_by_day' => $this->revenueByDay($from, $to),
                'top_brands' => $this->topBrands($from, $to),
                'ageing_stock' => $this->ageingStock(),
            ],
        ]);
    }

    /**
     * Headline figures, each with the previous equal-length period beside it.
     *
     * A revenue number with nothing to compare it against tells you almost
     * nothing — "₦4.2m" is only meaningful next to what last month did.
     *
     * @return array<string, mixed>
     */
    private function summary(Carbon $from, Carbon $to): array
    {
        $length = $from->diffInDays($to) + 1;
        $previousTo = $from->copy()->subSecond();
        $previousFrom = $previousTo->copy()->subDays($length - 1)->startOfDay();

        $current = $this->totalsFor($from, $to);
        $previous = $this->totalsFor($previousFrom, $previousTo);

        return [
            'current' => $current,
            'previous' => $previous,
            'change' => [
                'revenue' => $this->percentChange($previous['revenue'], $current['revenue']),
                'orders' => $this->percentChange($previous['orders'], $current['orders']),
            ],
        ];
    }

    /**
     * @return array<string, int|null>
     */
    private function totalsFor(Carbon $from, Carbon $to): array
    {
        $orders = Order::query()
            ->whereIn('status', self::EARNED)
            ->whereBetween('paid_at', [$from, $to]);

        $revenue = (int) (clone $orders)->sum('total');
        $count = (clone $orders)->count();

        /*
         | Margin is computed ONLY from serialized units, because only they carry
         | a cost. Accessories have no cost column, so including them would
         | silently report their full price as profit — a number that reads
         | plausible and is wrong. `cost_known_revenue` is returned alongside so
         | the UI can say what share of revenue the margin actually covers.
         */
        $margin = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('product_units', 'product_units.id', '=', 'order_items.product_unit_id')
            ->whereIn('orders.status', self::EARNED)
            ->whereBetween('orders.paid_at', [$from, $to])
            ->whereNotNull('product_units.cost')
            ->selectRaw('
                coalesce(sum(order_items.line_total), 0) as revenue,
                coalesce(sum(product_units.cost * order_items.quantity), 0) as cost
            ')
            ->first();

        $unitsSold = (int) DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->whereIn('orders.status', self::EARNED)
            ->whereBetween('orders.paid_at', [$from, $to])
            ->sum('order_items.quantity');

        return [
            'revenue' => $revenue,
            'orders' => $count,
            'units_sold' => $unitsSold,
            // Integer division would be misleading on a ₦1.9m average; round.
            'average_order' => $count > 0 ? (int) round($revenue / $count) : 0,
            'margin' => (int) ($margin->revenue - $margin->cost),
            'cost_known_revenue' => (int) $margin->revenue,
        ];
    }

    /**
     * Daily revenue, with EVERY day present including the empty ones.
     *
     * A series that skips days with no sales draws a chart that lies — the line
     * jumps straight from Monday to Thursday and reads as continuous trade.
     *
     * @return list<array{date: string, revenue: int, orders: int}>
     */
    private function revenueByDay(Carbon $from, Carbon $to): array
    {
        $rows = Order::query()
            ->whereIn('status', self::EARNED)
            ->whereBetween('paid_at', [$from, $to])
            ->selectRaw('date(paid_at) as day, sum(total) as revenue, count(*) as orders')
            ->groupBy('day')
            ->pluck('revenue', 'day');

        $counts = Order::query()
            ->whereIn('status', self::EARNED)
            ->whereBetween('paid_at', [$from, $to])
            ->selectRaw('date(paid_at) as day, count(*) as orders')
            ->groupBy('day')
            ->pluck('orders', 'day');

        $series = [];

        for ($day = $from->copy(); $day->lte($to); $day->addDay()) {
            $key = $day->toDateString();

            $series[] = [
                'date' => $key,
                'revenue' => (int) ($rows[$key] ?? 0),
                'orders' => (int) ($counts[$key] ?? 0),
            ];
        }

        return $series;
    }

    /**
     * What is actually selling, by brand.
     *
     * @return list<array<string, mixed>>
     */
    private function topBrands(Carbon $from, Carbon $to): array
    {
        return DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->leftJoin('products', 'products.id', '=', 'order_items.product_id')
            ->whereIn('orders.status', self::EARNED)
            ->whereBetween('orders.paid_at', [$from, $to])
            ->selectRaw("
                coalesce(products.brand, 'Other') as brand,
                sum(order_items.line_total) as revenue,
                sum(order_items.quantity) as units
            ")
            ->groupBy('brand')
            ->orderByDesc('revenue')
            ->limit(8)
            ->get()
            ->map(fn ($row) => [
                'brand' => $row->brand,
                'revenue' => (int) $row->revenue,
                'units' => (int) $row->units,
            ])
            ->all();
    }

    /**
     * How long the machines currently on the shelf have been sitting there.
     *
     * THE MOST IMPORTANT NUMBER ON THIS PAGE for a business in used hardware.
     * Every unsold laptop is capital tied up in an asset that depreciates every
     * week, and unlike quantity stock it cannot be reordered — it is a specific
     * machine somebody paid for months ago. A pile in the 90+ bucket is money
     * sitting on a shelf going stale, and it is invisible unless it is counted.
     *
     * @return array<string, mixed>
     */
    private function ageingStock(): array
    {
        $buckets = [
            ['label' => '0–30 days', 'min' => 0, 'max' => 30],
            ['label' => '31–60 days', 'min' => 31, 'max' => 60],
            ['label' => '61–90 days', 'min' => 61, 'max' => 90],
            ['label' => 'Over 90 days', 'min' => 91, 'max' => null],
        ];

        $units = ProductUnit::query()
            ->with('product:id,name,brand,slug')
            ->where('status', ProductUnit::STATUS_AVAILABLE)
            ->get();

        $now = now();

        $summary = collect($buckets)->map(function (array $bucket) use ($units, $now) {
            $matching = $units->filter(function (ProductUnit $unit) use ($bucket, $now) {
                $age = $unit->created_at?->diffInDays($now) ?? 0;

                return $age >= $bucket['min']
                    && ($bucket['max'] === null || $age <= $bucket['max']);
            });

            return [
                'label' => $bucket['label'],
                'units' => $matching->count(),
                // Value at RETAIL, which is what the shelf is worth if it sells
                // — the figure the owner thinks in.
                'value' => (int) $matching->sum('price'),
            ];
        })->all();

        // The specific machines that have been sitting longest, so the number is
        // actionable rather than just alarming.
        $oldest = $units
            ->sortBy(fn (ProductUnit $unit) => $unit->created_at)
            ->take(5)
            ->map(fn (ProductUnit $unit) => [
                'sku' => $unit->sku,
                'name' => $unit->product?->name,
                'slug' => $unit->product?->slug,
                'price' => (int) $unit->price,
                'days' => (int) ($unit->created_at?->diffInDays($now) ?? 0),
            ])
            ->values()
            ->all();

        return [
            'buckets' => $summary,
            'oldest' => $oldest,
            'total_units' => $units->count(),
            'total_value' => (int) $units->sum('price'),
        ];
    }

    /** Null rather than 0% when there is no baseline — "up 100%" from zero is noise. */
    private function percentChange(int $previous, int $current): ?int
    {
        if ($previous === 0) {
            return null;
        }

        return (int) round((($current - $previous) / $previous) * 100);
    }
}
