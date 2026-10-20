<?php

namespace App\Http\Controllers;

use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Staff auth. Sanctum TOKEN flow, not cookie/SPA mode — the frontends sit on
 * different origins and proxy through their own route handlers.
 */
class AuthController extends Controller
{
    /**
     * POST /api/login → { data: { user, token } }
     *
     * The token is handed to the backoffice's Next route handler, which moves it
     * into an httpOnly cookie and forwards only `{ data: user }` to the browser.
     * It must never reach client JavaScript.
     */
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $credentials['email'])->first();

        /*
         | ONE failure message, for three different failures: unknown email,
         | wrong password, and deactivated account.
         |
         | Deliberate. Distinguishing them turns this endpoint into an oracle for
         | "who works here" — a stranger could enumerate colleagues by watching
         | which addresses answer differently. A deactivated user in particular
         | gets a 422 here rather than a 403, because a 403 would confirm the
         | account exists.
         */
        if (! $user || ! Hash::check($credentials['password'], $user->password) || ! $user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['These credentials do not match our records.'],
            ]);
        }

        // One token per login, and the old ones stay valid — staff legitimately
        // work from the shop desktop and a phone at the same time.
        $token = $user->createToken('backoffice')->plainTextToken;

        $user->forceFill(['last_login_at' => now()])->save();

        return response()->json([
            'data' => [
                'user' => new UserResource($user->load('roles', 'permissions')),
                'token' => $token,
            ],
        ]);
    }

    /**
     * GET /api/me → { data: user }
     *
     * Carries role and flattened permissions so the backoffice does not need a
     * second round trip to decide what it may render.
     */
    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'data' => new UserResource(
                $request->user()->load('roles', 'permissions'),
            ),
        ]);
    }

    /**
     * POST /api/logout
     *
     * Revokes the CURRENT access token only, not all of the user's tokens —
     * signing out on the shop desktop must not sign them out on their phone.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['data' => ['message' => 'Signed out.']]);
    }
}
