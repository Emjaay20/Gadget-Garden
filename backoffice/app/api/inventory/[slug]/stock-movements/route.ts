import { api, ApiError } from "@/lib/server/api";

/** POST /api/inventory/{slug}/stock-movements — the only way quantity changes. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    return Response.json(
      await api(`/inventory/${encodeURIComponent(slug)}/stock-movements`, {
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
