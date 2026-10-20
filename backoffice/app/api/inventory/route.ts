import { api, ApiError } from "@/lib/server/api";

/**
 * POST /api/inventory — Create a new product catalog definition.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  try {
    const result = await api("/inventory", {
      method: "POST",
      body,
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json(
        { message: error.message, errors: error.errors },
        { status: error.status },
      );
    }
    return Response.json(
      { message: "Could not create product. Please try again." },
      { status: 500 },
    );
  }
}
