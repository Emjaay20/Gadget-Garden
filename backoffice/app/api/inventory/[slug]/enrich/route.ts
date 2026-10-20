import { api, ApiError } from "@/lib/server/api";

/**
 * POST /api/inventory/{slug}/enrich — AI image finder & SEO copy generator.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    const result = await api(`/inventory/${encodeURIComponent(slug)}/enrich`, {
      method: "POST",
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
      { message: "Could not enrich product. Please try again." },
      { status: 500 },
    );
  }
}
