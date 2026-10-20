<?php

namespace App\Payments;

use Illuminate\Support\Facades\Cache;

/**
 * Where the mock gateway remembers that a tester "transferred".
 *
 * Backed by the cache rather than a table: it is development scaffolding, and it
 * should vanish with a `cache:clear` rather than linger in the schema. In tests the
 * array driver makes it per-test automatically.
 */
final class MockLedger
{
    private const PREFIX = 'mock-payment:';

    private const TTL_MINUTES = 60;

    public static function settle(string $reference, string $outcome, ?int $amount = null): void
    {
        Cache::put(
            self::PREFIX.$reference,
            ['outcome' => $outcome, 'amount' => $amount],
            now()->addMinutes(self::TTL_MINUTES),
        );
    }

    /**
     * @return array{outcome: string, amount: ?int}|null
     */
    public static function get(string $reference): ?array
    {
        return Cache::get(self::PREFIX.$reference);
    }

    public static function forget(string $reference): void
    {
        Cache::forget(self::PREFIX.$reference);
    }
}
