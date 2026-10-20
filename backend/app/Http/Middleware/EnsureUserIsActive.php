<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Rejects a deactivated staff member on every authenticated request.
 *
 * WHY THIS EXISTS SEPARATELY FROM THE LOGIN CHECK
 *
 * Checking `is_active` at login is not enough on its own. A token issued before
 * deactivation would keep working for its full lifetime, so "revoke Grace's
 * access" would revoke nothing until Grace happened to log out. Two overlapping
 * mechanisms close that:
 *
 *   1. `PATCH /api/staff/{user}` with `is_active: false` deletes that user's
 *      tokens in the same request.
 *   2. This middleware, which also catches a row deactivated directly in the
 *      database — where no controller ran and no token was cleaned up.
 *
 * It answers **401, not 403**. The frontends treat 401 as "your session is over,
 * go to /login", which is the correct outcome; a 403 would strand them on a
 * dashboard that renders but cannot load anything.
 */
class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && ! $user->is_active) {
            // Clean up what the deactivating request could not: any token issued
            // before the row was flipped, including by a direct DB edit.
            $user->tokens()->delete();

            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        return $next($request);
    }
}
