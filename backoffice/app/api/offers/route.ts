import { api, ApiError } from "@/lib/server/api";

/** GET /api/offers — list customer offers for backoffice desk. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const path = query ? `/offers?${query}` : "/offers";

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
