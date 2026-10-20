import { api, ApiError } from "@/lib/server/api";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    return Response.json(
      await api(`/offers/${encodeURIComponent(reference)}/counter`, {
        method: "POST",
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
