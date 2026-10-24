import { api, ApiError } from "@/lib/server/api";

/**
 * PATCH /admin/api/me — update personal profile and password
 */
export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));

  try {
    const result = await api("/me", {
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
    const msg = error instanceof Error ? error.message : "Failed to update profile.";
    return Response.json({ message: msg }, { status: 500 });
  }
}
