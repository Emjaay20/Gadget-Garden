<?php

namespace App\Http\Controllers\Backoffice;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    /**
     * GET /api/audit-logs
     *
     * List system and staff audit logs.
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'action' => ['nullable', 'string', 'max:80'],
            'search' => ['nullable', 'string', 'max:120'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = AuditLog::query()
            ->with(['user'])
            ->latest('id');

        if ($action = $validated['action'] ?? null) {
            $query->where('action', $action);
        }

        if ($search = $validated['search'] ?? null) {
            $term = '%'.str_replace('%', '\%', $search).'%';
            $query->where(function ($q) use ($term) {
                $q->where('description', 'ilike', $term)
                    ->orWhere('action', 'ilike', $term)
                    ->orWhereHas('user', fn ($uq) => $uq->where('name', 'ilike', $term));
            });
        }

        $paginator = $query->paginate($validated['per_page'] ?? 30)->withQueryString();

        return response()->json([
            'data' => $paginator->items(),
            'meta' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }
}
