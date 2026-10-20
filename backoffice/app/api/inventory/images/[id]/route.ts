import { api, ApiError } from "@/lib/server/api";

/**
 * DELETE /api/inventory/images/{id} — delete image from disk and DB.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const result = await api(`/inventory/images/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    return Response.json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json(
        { message: error.message, errors: error.errors },
        { status: error.status },
      );
    }
    return Response.json(
      { message: "Could not delete image. Please try again." },
      { status: 500 },
    );
  }
}
