import { api, ApiError } from "@/lib/server/api";

/**
 * PATCH /admin/api/staff/{id} — update staff role, status, or reset password
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    const result = await api(`/staff/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json(
        { message: error.message, errors: error.errors },
        { status: error.status },
      );
    }
    const msg = error instanceof Error ? error.message : "Failed to update staff member.";
    return Response.json({ message: msg }, { status: 500 });
  }
}
