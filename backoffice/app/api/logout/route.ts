import { api } from "@/lib/server/api";
import { clearToken } from "@/lib/server/session";

/**
 * POST /api/logout
 *
 * Revokes the token server-side, then drops the cookie. The cookie is cleared
 * even if the API call fails: a session the browser cannot use is better than
 * one it thinks it still has.
 */
export async function POST() {
  try {
    await api("/logout", { method: "POST" });
  } catch {
    // Already expired, or the API is down. Clearing locally is still correct.
  }

  await clearToken();

  return Response.json({ data: { message: "Signed out." } });
}
