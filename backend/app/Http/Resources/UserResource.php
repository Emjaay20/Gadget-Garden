<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The pattern every resource in this app follows:
 *
 *   - `id` cast to STRING. Postgres bigints exceed what JavaScript can hold in a
 *     Number safely, and a frontend comparing `id === "3"` against a numeric 3
 *     fails silently. Strings on the wire, everywhere, no exceptions.
 *   - Flat snake_case. No nested role objects to unwrap.
 *   - Nothing the frontend's type does not declare — and `password` never
 *     appears, which `#[Hidden]` on the model already guarantees but is worth
 *     being deliberate about on the resource too.
 *
 * @mixin User
 */
class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'role' => $this->roleName(),
            'permissions' => $this->permissionNames(),
            'is_active' => $this->is_active,
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
