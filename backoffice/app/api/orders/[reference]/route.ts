import { api, ApiError } from "@/lib/server/api";

/** PATCH /api/orders/{reference} — status transition and/or a staff note. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    return Response.json(
      await api(`/orders/${encodeURIComponent(reference)}`, {
        method: "PATCH",
        body,
      }),
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
