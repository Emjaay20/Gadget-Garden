<?php

namespace App\Providers;

use App\Payments\Gateways\MockGateway;
use App\Payments\Gateways\DisabledGateway;
use App\Payments\Gateways\XendifyGateway;
use App\Payments\PaymentGateway;
use Illuminate\Support\ServiceProvider;
use RuntimeException;

/**
 * Binds the configured payment provider. Adding one is a class plus a case.
 */
class PaymentServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(PaymentGateway::class, function () {
            return match (config('shop.provider')) {
                'xendify' => new XendifyGateway,
                'mock' => new MockGateway,
                'disabled' => new DisabledGateway,
                default => throw new RuntimeException(
                    'Unknown SHOP_PAYMENT_PROVIDER ['.config('shop.provider').'].'
                ),
            };
        });
    }
}
