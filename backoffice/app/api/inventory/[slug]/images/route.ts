import { api, ApiError } from "@/lib/server/api";

/**
 * POST /api/inventory/{slug}/images — upload file or attach image URL.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const contentType = request.headers.get("content-type") ?? "";

  let body: unknown;
  if (contentType.includes("multipart/form-data")) {
    body = await request.formData();
  } else {
    body = await request.json().catch(() => ({}));
  }

  try {
    const result = await api(`/inventory/${encodeURIComponent(slug)}/images`, {
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
      { message: "Could not upload image. Please try again." },
      { status: 500 },
    );
  }
}
