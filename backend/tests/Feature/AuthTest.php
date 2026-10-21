<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Permissions;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_returns_the_user_and_a_token(): void
    {
        $user = $this->owner(['email' => 'owner@example.test']);
        $user->password = Hash::make('correct-horse');
        $user->save();

        $response = $this->postJson('/api/login', [
            'email' => 'owner@example.test',
            'password' => 'correct-horse',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.user.email', 'owner@example.test')
            ->assertJsonPath('data.user.role', Permissions::OWNER)
            ->assertJsonStructure(['data' => ['user', 'token']]);

        $this->assertNotEmpty($response->json('data.token'));
    }

    public function test_the_id_is_a_string_and_the_password_never_appears(): void
    {
        $user = $this->owner();
        $user->password = Hash::make('correct-horse');
        $user->save();

        $response = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'correct-horse',
        ]);

        // Postgres bigints exceed what JavaScript holds safely in a Number.
        $this->assertIsString($response->json('data.user.id'));
        $this->assertArrayNotHasKey('password', $response->json('data.user'));
    }

    public function test_permissions_come_back_as_a_flat_array_of_strings(): void
    {
        $user = $this->sales();
        $user->password = Hash::make('correct-horse');
        $user->save();

        $permissions = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'correct-horse',
        ])->json('data.user.permissions');

        $this->assertSame(
            collect(Permissions::for(Permissions::SALES))->sort()->values()->all(),
            $permissions,
        );
    }

    /**
     * An unknown email and a wrong password must be indistinguishable, or login
     * becomes a way to enumerate who works here.
     */
    public function test_unknown_email_and_wrong_password_are_indistinguishable(): void
    {
        $user = $this->owner(['email' => 'real@example.test']);
        $user->password = Hash::make('correct-horse');
        $user->save();

        $wrongPassword = $this->postJson('/api/login', [
            'email' => 'real@example.test',
            'password' => 'nope',
        ]);

        $unknownEmail = $this->postJson('/api/login', [
            'email' => 'ghost@example.test',
            'password' => 'nope',
        ]);

        $wrongPassword->assertStatus(422);
        $unknownEmail->assertStatus(422);
        $this->assertSame($wrongPassword->json(), $unknownEmail->json());
    }

    public function test_a_deactivated_user_cannot_log_in_and_looks_the_same_as_a_bad_password(): void
    {
        $user = $this->owner(['is_active' => false]);
        $user->password = Hash::make('correct-horse');
        $user->save();

        $deactivated = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'correct-horse',
        ]);

        $unknown = $this->postJson('/api/login', [
            'email' => 'ghost@example.test',
            'password' => 'correct-horse',
        ]);

        // 422, not 403 — a 403 would confirm the account exists.
        $deactivated->assertStatus(422);
        $this->assertSame($unknown->json(), $deactivated->json());
    }

    public function test_login_is_rate_limited(): void
    {
        $user = $this->owner();

        foreach (range(1, 30) as $ignored) {
            $this->postJson('/api/login', [
                'email' => $user->email,
                'password' => 'wrong',
            ])->assertStatus(422);
        }

        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'wrong',
        ])->assertStatus(429);
    }

    public function test_me_returns_the_authenticated_user(): void
    {
        $user = $this->manager();

        $this->actingAs($user)
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('data.email', $user->email)
            ->assertJsonPath('data.role', Permissions::MANAGER);
    }

    public function test_me_rejects_an_anonymous_request(): void
    {
        $this->getJson('/api/me')
            ->assertStatus(401)
            ->assertJsonPath('message', 'Unauthenticated.');
    }

    public function test_logout_revokes_only_the_current_token(): void
    {
        $user = $this->owner();

        $desktop = $user->createToken('desktop')->plainTextToken;
        $phone = $user->createToken('phone')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$desktop}")
            ->postJson('/api/logout')
            ->assertOk();

        $this->forgetAuth();

        // Signing out at the shop desktop must not sign them out on their phone.
        $this->withHeader('Authorization', "Bearer {$phone}")
            ->getJson('/api/me')
            ->assertOk();

        $this->forgetAuth();

        $this->withHeader('Authorization', "Bearer {$desktop}")
            ->getJson('/api/me')
            ->assertStatus(401);
    }

    /**
     * The reason EnsureUserIsActive exists: a token issued BEFORE deactivation
     * must stop working immediately, not when it eventually expires.
     */
    public function test_a_token_issued_before_deactivation_stops_working(): void
    {
        $user = $this->owner();
        $token = $user->createToken('backoffice')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/me')
            ->assertOk();

        // Straight to the database — no controller runs, so nothing cleans up
        // the token. This is the case the middleware is the only guard against.
        User::whereKey($user->id)->update(['is_active' => false]);

        $this->forgetAuth();

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/me')
            ->assertStatus(401)
            ->assertJsonPath('message', 'Unauthenticated.');

        $this->assertSame(0, $user->tokens()->count());
    }
}
