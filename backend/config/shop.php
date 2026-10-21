<?php

/*
|--------------------------------------------------------------------------
| Shop / payments
|--------------------------------------------------------------------------
|
| `provider` picks the PaymentGateway binding (see PaymentServiceProvider).
| Adding a provider is a new class plus a value here, with no controller changes.
|
*/

return [

    /*
     | `mock` in development, `xendify` in production.
     |
     | The mock authenticates NOTHING, so a local webhook body settles an order on
     | its own. That is the point of it — and the reason it must never be the bound
     | provider anywhere real.
     */
    'provider' => env('SHOP_PAYMENT_PROVIDER', 'mock'),

    /*
     | How long an unpaid order holds its reserved machines before
     | `orders:expire-unpaid` releases them back onto the shelf.
     |
     | A real trade-off. Too short and a customer walking to the bank loses the
     | laptop they were buying; too long and one abandoned cart keeps a ₦1.9m
     | machine off the market for a day. 24 hours matches how the business already
     | works over WhatsApp — "send the transfer today".
     */
    'unpaid_order_ttl_hours' => (int) env('SHOP_UNPAID_ORDER_TTL_HOURS', 24),

    /*
     | Layaway is deliberately a reservation plan, not credit. It is available
     | only for one serialized device, locks the agreed price, and expires after
     | 30 days unless the balance is complete. The first payment is at least 20%
     | of the checkout total; later payments may be any amount of ₦10,000+.
     */
    'layaway' => [
        'enabled' => env('SHOP_LAYAWAY_ENABLED', true),
        'term_days' => (int) env('SHOP_LAYAWAY_TERM_DAYS', 30),
        'deposit_percent' => (int) env('SHOP_LAYAWAY_DEPOSIT_PERCENT', 20),
        'minimum_payment' => (int) env('SHOP_LAYAWAY_MINIMUM_PAYMENT', 10_000),
    ],

    'xendify' => [
        'base_url' => env('SHOP_XENDIFY_BASE_URL', 'https://api.xendify.com/api/v1'),

        // sk_test_… / sk_live_… — sent as a Bearer token when we call THEM.
        'secret_key' => env('SHOP_XENDIFY_SECRET_KEY'),

        /*
         | The key Xendify presents as `Authorization: Bearer …` when it calls our
         | collection webhook. A SEPARATE value from `secret_key`, which is what we
         | present when calling them.
         |
         | Unset means every webhook is rejected — deliberately, since the webhook
         | is the only thing that can settle an order, and a webhook endpoint
         | anyone may POST to is one anyone can take goods with.
         */
        'webhook_key' => env('SHOP_XENDIFY_WEBHOOK_KEY'),

        /*
         | Which bank partner mints the virtual account (safehaven, vfd, …).
         |
         | An implementation detail of the provider, and deliberately NOT the
         | gateway's own `name()` — that returns 'xendify', so the webhook route
         | and the container binding are not keyed on a partner that can change
         | without the integration changing.
         */
        'provider' => env('SHOP_XENDIFY_PROVIDER', 'safehaven'),
    ],

];
