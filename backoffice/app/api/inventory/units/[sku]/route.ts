import { api, ApiError } from "@/lib/server/api";

/** PATCH /api/inventory/units/{sku} — correct a machine's details. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sku: string }> },
) {
  const { sku } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    return Response.json(
      await api(`/inventory/units/${encodeURIComponent(sku)}`, {
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
