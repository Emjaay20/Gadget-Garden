<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreStaffRequest;
use App\Http\Requests\UpdateStaffRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Staff administration. Every route here sits behind `staff.manage` (owner only).
 */
class StaffController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $staff = User::query()
            ->with('roles', 'permissions')
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => UserResource::collection($staff)->resolve(),
            'meta' => ['total' => $staff->count()],
        ]);
    }

    /**
     * POST /api/staff
     *
     * The create-staff form collects name, email, role and phone — there is no
     * password field. Rather than filling that gap with a default (anyone who
     * knew a new colleague's email could then sign in as them), a random
     * 16-character password is generated and returned ONCE in
     * `meta.temporary_password` for the owner to hand over in person.
     *
     * This is a stopgap. The destination is an emailed invitation carrying a
     * single-use set-your-password token, which belongs with the mail work in
     * phase 8 — at which point `meta.temporary_password` should disappear rather
     * than linger.
     */
    public function store(StoreStaffRequest $request): JsonResponse
    {
        $data = $request->validated();
        $temporary = ! empty($data['password']) ? $data['password'] : Str::password(16);

        $user = new User([
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
            'is_active' => true,
        ]);

        $user->password = Hash::make($temporary);
        $user->save();

        $user->syncRoles([$data['role']]);

        return response()->json([
            'data' => new UserResource($user->load('roles', 'permissions')),
            'meta' => ['temporary_password' => $temporary],
        ], 201);
    }

    public function show(User $staff): JsonResponse
    {
        return response()->json([
            'data' => new UserResource($staff->load('roles', 'permissions')),
        ]);
    }

    public function update(UpdateStaffRequest $request, User $staff): JsonResponse
    {
        $data = $request->validated();

        $this->guardSelfLockout($request, $staff, $data);

        $staff->fill(array_intersect_key($data, array_flip([
            'name', 'email', 'phone', 'is_active',
        ])));

        if (! empty($data['password'])) {
            $staff->password = Hash::make($data['password']);
        }

        $deactivating = $staff->isDirty('is_active') && ! $staff->is_active;

        $staff->save();

        if (isset($data['role'])) {
            $staff->syncRoles([$data['role']]);
        }

        /*
         | Cut off live sessions in the SAME request that deactivates the account.
         | Without this, an already-issued token keeps working for its full
         | lifetime and "revoke their access" revokes nothing until they happen
         | to log out. EnsureUserIsActive is the backstop for rows changed
         | directly in the database; this is the fast path.
         */
        if ($deactivating) {
            $staff->tokens()->delete();
        }

        return response()->json([
            'data' => new UserResource($staff->fresh()->load('roles', 'permissions')),
        ]);
    }

    /**
     * Stop the last owner locking everyone out of the system.
     *
     * An owner deactivating themselves, or demoting themselves when they are the
     * only owner, leaves a business with no one who can create staff or reprice
     * the catalogue — recoverable only by editing the database by hand. Cheap to
     * prevent, expensive to explain at 9pm on a Saturday.
     *
     * @param  array<string, mixed>  $data
     */
    private function guardSelfLockout(Request $request, User $staff, array $data): void
    {
        $isSelf = $request->user()->is($staff);

        if ($isSelf && array_key_exists('is_active', $data) && ! $data['is_active']) {
            throw ValidationException::withMessages([
                'is_active' => ['You cannot deactivate your own account.'],
            ]);
        }

        $losingOwner = $staff->hasRole(Permissions::OWNER)
            && isset($data['role'])
            && $data['role'] !== Permissions::OWNER;

        $deactivatingOwner = $staff->hasRole(Permissions::OWNER)
            && array_key_exists('is_active', $data)
            && ! $data['is_active'];

        if (! $losingOwner && ! $deactivatingOwner) {
            return;
        }

        $otherActiveOwners = User::role(Permissions::OWNER)
            ->where('is_active', true)
            ->whereKeyNot($staff->getKey())
            ->count();

        if ($otherActiveOwners === 0) {
            throw ValidationException::withMessages([
                'role' => ['This is the last active owner — promote someone else first.'],
            ]);
        }
    }
}
