<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\Backoffice\AuditLogController;
use App\Http\Controllers\Backoffice\ImageController;
use App\Http\Controllers\Backoffice\InventoryController;
use App\Http\Controllers\Backoffice\OfferController as BackofficeOfferController;
use App\Http\Controllers\Backoffice\OrderController as BackofficeOrderController;
use App\Http\Controllers\Backoffice\ProductEnrichmentController;
use App\Http\Controllers\Backoffice\ReportsController;
use App\Http\Controllers\Shop\AiAssistantController;
use App\Http\Controllers\Shop\CatalogueController;
use App\Http\Controllers\Shop\OfferController as ShopOfferController;
use App\Http\Controllers\Shop\OrderController;
use App\Http\Controllers\Shop\PaymentController;
use App\Http\Controllers\Shop\ProductController;
use App\Http\Controllers\StaffController;
use App\Support\Permissions;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API routes
|--------------------------------------------------------------------------
|
| Two audiences, with opposite trust models:
|
|   - Staff routes (`auth:sanctum` + `active`) — the backoffice.
|   - Public shop routes — unauthenticated by design. There are no customer
|     accounts; buyers become `customers` rows at checkout. Those arrive in
|     phase 2 and must be throttled and CORS-limited to the storefront origin.
|
| Permission strings always come from App\Support\Permissions. Never inline one.
|
*/

/*
| Public storefront. No auth by design — there are no customer accounts.
|
| Throttled because these are the only endpoints an anonymous caller can reach,
| and the catalogue query does real work (correlated subqueries, json extraction
| for the spec filters). 60/minute is far above a human browsing and well below
| anything that would hurt.
*/
Route::middleware('throttle:60,1')->prefix('shop')->group(function () {
    // Before the {slug} route, or "filters" is read as a product slug.
    Route::get('/products/filters', [ProductController::class, 'filters']);
    Route::get('/products', [ProductController::class, 'index']);
    Route::get('/products/{slug}', [ProductController::class, 'show']);

    Route::get('/categories', [CatalogueController::class, 'categories']);
    Route::get('/delivery-zones', [CatalogueController::class, 'deliveryZones']);

    // Re-prices and re-checks a cart. Not a mutation, despite the verb.
    Route::post('/cart', [OrderController::class, 'validateCart']);

    Route::get('/orders/{reference}', [OrderController::class, 'show']);

    // AI Store Assistant (Laptop Matchmaker)
    Route::post('/ai/recommend', [AiAssistantController::class, 'recommend']);
});

/*
| Checkout gets its own, tighter throttle. It writes rows, takes locks and
| reserves real stock, so it must not sit behind the same 60/minute ceiling as
| browsing — a script hammering it would hold machines off the shelf even while
| failing.
*/
Route::middleware('throttle:10,1')->group(function () {
    Route::post('/shop/orders', [OrderController::class, 'store']);

    // Minting a virtual account is an outbound call to the provider.
    Route::post('/shop/payments/initialize', [PaymentController::class, 'initialize']);

    /*
     | Polled by the pay page while the customer transfers, so the ceiling is
     | higher than checkout's — but still bounded, because each call can hit the
     | provider. The storefront polls every 6s, well inside this.
     */
    Route::post('/shop/payments/verify', [PaymentController::class, 'verify'])
        ->withoutMiddleware('throttle:10,1')
        ->middleware('throttle:30,1');

    // Customer offers.
    Route::post('/shop/offers', [ShopOfferController::class, 'store']);
    Route::get('/shop/offers/{reference}', [ShopOfferController::class, 'show']);
    Route::post('/shop/offers/{reference}/accept-counter', [ShopOfferController::class, 'acceptCounter']);

    // DEV ONLY — 404s unless the mock gateway is bound.
    Route::post('/shop/payments/mock-settle', [PaymentController::class, 'mockSettle']);
});

/*
| The provider's collection webhook.
|
| NO THROTTLE. Xendify retries up to ten times, and a 429 would look to them
| like a delivery failure and invite more retries — while a legitimately busy
| moment (several customers paying at once) is exactly when it must not be
| refused. Authentication is the control here, not rate limiting.
*/
Route::post(
    '/shop/payments/webhook/{provider}',
    [PaymentController::class, 'webhook'],
);

Route::post('/login', [AuthController::class, 'login'])
    // Brute-force ceiling: generous for a human, useless for a script.
    ->middleware(app()->environment('local') ? 'throttle:60,1' : 'throttle:6,1');

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    /*
    | Inventory. Reading is `inventory.view`; moving stock is `inventory.manage`.
    | Pricing is deliberately NOT here — that is `catalogue.manage`, so a manager
    | can receive a shipment without being able to reprice it.
    */
    Route::middleware('permission:'.Permissions::INVENTORY_VIEW)->group(function () {
        Route::get('/inventory', [InventoryController::class, 'index']);
        Route::get('/inventory/categories', [InventoryController::class, 'categories']);
        Route::get('/inventory/movements', [InventoryController::class, 'movements']);
        Route::get('/inventory/{product:slug}', [InventoryController::class, 'show']);
        Route::get('/inventory/{product:slug}/units', [InventoryController::class, 'units']);
    });

    Route::middleware('permission:'.Permissions::INVENTORY_MANAGE)->group(function () {
        Route::post('/inventory', [InventoryController::class, 'store']);
        Route::patch('/inventory/{product:slug}', [InventoryController::class, 'update']);
        Route::delete('/inventory/{product:slug}', [InventoryController::class, 'destroy']);
        Route::post('/inventory/{product:slug}/units', [InventoryController::class, 'storeUnits']);

        Route::patch('/inventory/units/{unit:sku}', [InventoryController::class, 'updateUnit']);
        Route::delete('/inventory/units/{unit:sku}', [InventoryController::class, 'destroyUnit']);
        Route::post('/inventory/{product:slug}/stock-movements', [InventoryController::class, 'storeMovement']);

        // Photography & Media Management
        Route::post('/inventory/{product:slug}/images', [ImageController::class, 'uploadProductImage']);
        Route::post('/inventory/units/{unit:sku}/images', [ImageController::class, 'uploadUnitImage']);
        Route::delete('/inventory/images/{image}', [ImageController::class, 'destroy']);

        // AI Catalog Auto-Fill & Media Discovery
        Route::post('/inventory/{product:slug}/enrich', [ProductEnrichmentController::class, 'enrich']);
    });

    // Fulfilment.
    Route::middleware('permission:'.Permissions::ORDERS_VIEW)->group(function () {
        Route::get('/orders', [BackofficeOrderController::class, 'index']);
        Route::get('/orders/{reference}', [BackofficeOrderController::class, 'show']);
    });

    Route::middleware('permission:'.Permissions::ORDERS_MANAGE)->group(function () {
        Route::patch('/orders/{reference}', [BackofficeOrderController::class, 'update']);
        Route::post('/orders/manual', [BackofficeOrderController::class, 'storeManual']);
        Route::post('/orders/{reference}/verify-offline-payment', [BackofficeOrderController::class, 'verifyOfflinePayment']);
    });

    // Offer negotiation desk.
    Route::middleware('permission:'.Permissions::OFFERS_MANAGE)->group(function () {
        Route::get('/offers', [BackofficeOfferController::class, 'index']);
        Route::get('/offers/{reference}', [BackofficeOfferController::class, 'show']);
        Route::post('/offers/{reference}/accept', [BackofficeOfferController::class, 'accept']);
        Route::post('/offers/{reference}/counter', [BackofficeOfferController::class, 'counter']);
        Route::post('/offers/{reference}/decline', [BackofficeOfferController::class, 'decline']);
    });

    // Audit trail.
    Route::middleware('permission:'.Permissions::AUDIT_VIEW)->group(function () {
        Route::get('/audit-logs', [AuditLogController::class, 'index']);
    });

    // Revenue and margin. `reports.view` is separate from fulfilment because it
    // exposes what the business paid.
    Route::middleware('permission:'.Permissions::REPORTS_VIEW)->group(function () {
        Route::get('/reports', [ReportsController::class, 'index']);
    });

    Route::middleware('permission:'.Permissions::STAFF_MANAGE)->group(function () {
        Route::get('/staff', [StaffController::class, 'index']);
        Route::post('/staff', [StaffController::class, 'store']);
        Route::get('/staff/{staff}', [StaffController::class, 'show']);
        Route::patch('/staff/{staff}', [StaffController::class, 'update']);
    });
});
