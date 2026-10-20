<?php

/*
|--------------------------------------------------------------------------
| Cross-Origin Resource Sharing
|--------------------------------------------------------------------------
|
| Both frontends are on their own origins, so every browser call to this API is
| cross-origin.
|
| `allowed_origins` is an explicit list, never `['*']`. A wildcard here would
| let any site on the internet call the API from a visitor's browser — harmless
| for a public product listing, not harmless for the staff endpoints that share
| the same host.
|
| `supports_credentials` stays FALSE: this is a bearer-token API, not a cookie
| session. The backoffice's own cookie is set by its Next route handlers on
| their origin and never travels here.
|
*/

return [

    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_filter([
        env('STOREFRONT_URL', 'http://localhost:3000'),
        env('BACKOFFICE_URL', 'http://localhost:3001'),
    ])),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
