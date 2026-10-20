import { api, ApiError } from "@/lib/server/api";
import { setToken } from "@/lib/server/session";
import type { StaffUser } from "@/lib/types";

/**
 * POST /api/login
 *
 * Calls Laravel, moves the returned token into an httpOnly cookie, and forwards
 * ONLY the user to the browser. The token is deliberately dropped from the
 * response body — see lib/server/session.ts.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  try {
    const { data } = await api<{ data: { user: StaffUser; token: string } }>(
      "/login",
      { method: "POST", body, anonymous: true },
    );

    await setToken(data.token);

    return Response.json({ data: data.user });
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json(
        { message: error.message, errors: error.errors },
        { status: error.status },
      );
    }

    throw error;
  }
}
