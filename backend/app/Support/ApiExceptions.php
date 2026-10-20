<?php

namespace App\Support;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Http\Request;
use Spatie\Permission\Exceptions\UnauthorizedException as SpatieUnauthorizedException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Normalises error bodies to the four shapes the frontends parse (CLAUDE.md,
 * "API shape"). Wired up in bootstrap/app.php.
 *
 * Laravel's defaults are close but not identical: a missing model surfaces as
 * "No query results for model [App\Models\ProductUnit] 42", which leaks the
 * class name and the id to anyone probing the API and reads like a stack trace
 * in the UI. `LABELS` turns that into "Unit not found."
 *
 * ADD AN ENTRY TO `LABELS` AS EACH MODEL LANDS. A model missing from the map
 * degrades to a generic "Not found." rather than breaking, so the failure is
 * quiet — which is exactly why it is easy to forget.
 */
final class ApiExceptions
{
    /**
     * Model class => the noun a human should see.
     *
     * @var array<class-string, string>
     */
    private const LABELS = [
        User::class => 'Staff member',
        Order::class => 'Order',
        Product::class => 'Product',
        ProductUnit::class => 'Unit',
        Customer::class => 'Customer',
    ];

    public static function register(Exceptions $exceptions): void
    {
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json(['message' => 'Unauthenticated.'], 401);
        });

        $exceptions->render(function (AuthorizationException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json(
                ['message' => 'This action is unauthorized.'],
                403,
            );
        });

        /*
         | spatie's permission middleware throws its OWN UnauthorizedException,
         | not Laravel's AuthorizationException, so the handler above never sees
         | it — and its default body ("User does not have the right
         | permissions.") both differs from what the frontends parse and tells a
         | caller exactly why they were refused. Normalise it to the same
         | deliberately vague 403 as every other authorisation failure.
         */
        $exceptions->render(function (SpatieUnauthorizedException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json(
                ['message' => 'This action is unauthorized.'],
                403,
            );
        });

        $exceptions->render(function (ModelNotFoundException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json(
                ['message' => self::label($e->getModel()).' not found.'],
                404,
            );
        });

        /*
         | Route model binding throws NotFoundHttpException wrapping the
         | ModelNotFoundException, so the handler above never sees it. Unwrap and
         | reuse the same label rather than letting a bound 404 read differently
         | from an explicit findOrFail.
         */
        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            $previous = $e->getPrevious();

            $message = $previous instanceof ModelNotFoundException
                ? self::label($previous->getModel()).' not found.'
                : 'Not found.';

            return response()->json(['message' => $message], 404);
        });
    }

    private static function label(?string $model): string
    {
        if ($model === null) {
            return 'Resource';
        }

        return self::LABELS[$model] ?? class_basename($model);
    }
}
