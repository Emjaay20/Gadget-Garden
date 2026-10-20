<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\ProductUnit;
use App\Shop\PlacesOrders;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * Releases stock held by orders that were never paid for.
 *
 * WITHOUT THIS THE SHOP SLOWLY EMPTIES. Every abandoned checkout takes a
 * one-of-a-kind machine off the market permanently — a customer fills in an
 * address, changes their mind, and a ₦1.9m laptop is invisible to every other
 * buyer forever. On a catalogue of unique items that is the single most damaging
 * failure mode there is.
 *
 * Scheduled hourly. Idempotent, so a double run is harmless.
 */
class ExpireUnpaidOrders extends Command
{
    protected $signature = 'orders:expire-unpaid
                            {--dry-run : List what would be released without touching anything}';

    protected $description = 'Release stock held by unpaid orders past their hold, and close them';

    public function handle(PlacesOrders $orders): int
    {
        $expired = Order::query()->expired()->get();

        if ($expired->isEmpty()) {
            $this->info('Nothing to expire.');

            return self::SUCCESS;
        }

        $dryRun = (bool) $this->option('dry-run');

        foreach ($expired as $order) {
            $held = ProductUnit::query()
                ->where('order_id', $order->id)
                ->where('status', ProductUnit::STATUS_RESERVED)
                ->pluck('sku');

            $this->line(sprintf(
                '%s %s — held %d unit(s)%s',
                $dryRun ? '[dry-run]' : 'Releasing',
                $order->reference,
                $held->count(),
                $held->isNotEmpty() ? ': '.$held->implode(', ') : '',
            ));

            if ($dryRun) {
                continue;
            }

            $orders->release(
                $order,
                Order::CANCELLED,
                'Released automatically — payment not received within the hold period.',
            );

            // Worth a log line: an expiring order is a sale that did not happen,
            // and a sudden cluster of them usually means the payment flow broke
            // rather than that customers changed their minds.
            Log::info('Unpaid order expired.', [
                'order' => $order->reference,
                'total' => $order->total,
                'units_released' => $held->count(),
            ]);
        }

        $this->info(sprintf(
            '%s %d order(s).',
            $dryRun ? 'Would expire' : 'Expired',
            $expired->count(),
        ));

        return self::SUCCESS;
    }
}
