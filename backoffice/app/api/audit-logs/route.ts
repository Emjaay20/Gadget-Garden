import { api, ApiError } from "@/lib/server/api";

/** GET /api/audit-logs — list system and staff audit logs. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const path = query ? `/audit-logs?${query}` : "/audit-logs";

  try {
    return Response.json(await api(path));
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
