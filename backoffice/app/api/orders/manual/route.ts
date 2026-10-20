import { api, ApiError } from "@/lib/server/api";

/** POST /api/orders/manual — create a manual / walk-in / WhatsApp order. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  try {
    return Response.json(
      await api("/orders/manual", {
        method: "POST",
        body,
      }),
      { status: 201 },
    );
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
