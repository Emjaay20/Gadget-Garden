import { api, ApiError } from "@/lib/server/api";

/**
 * GET /api/inventory/{slug} — Fetch single product details with full images.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  try {
    const result = await api(`/inventory/${encodeURIComponent(slug)}`);
    return Response.json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json(
        { message: error.message, errors: error.errors },
        { status: error.status },
      );
    }
    return Response.json(
      { message: "Could not load product." },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/inventory/{slug} — Update product details, copy, and highlights.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    const result = await api(`/inventory/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      body,
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
      { message: "Could not update product. Please try again." },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/inventory/{slug} — Delete a product catalogue listing.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  try {
    const result = await api(`/inventory/${encodeURIComponent(slug)}`, {
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
      { message: "Could not delete product. Please try again." },
      { status: 500 },
    );
  }
}
