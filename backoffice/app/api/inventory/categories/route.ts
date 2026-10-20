import { api, ApiError } from "@/lib/server/api";

/**
 * GET /api/inventory/categories — Fetch all categories for product creation.
 */
export async function GET() {
  try {
    const result = await api("/inventory/categories");
    return Response.json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json(
        { message: error.message, errors: error.errors },
        { status: error.status },
      );
    }
    return Response.json(
      { message: "Could not load categories." },
      { status: 500 },
    );
  }
}
