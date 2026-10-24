import { api, ApiError } from "@/lib/server/api";

/**
 * GET /admin/api/staff  — list all staff members
 * POST /admin/api/staff — create a new staff member (owner only)
 */
export async function GET() {
  try {
    const result = await api("/staff");
    return Response.json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json(
        { message: error.message, errors: error.errors },
        { status: error.status },
      );
    }
    return Response.json({ message: "Could not fetch staff list." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  try {
    const result = await api("/staff", {
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
    const msg = error instanceof Error ? error.message : "Failed to create staff member.";
    return Response.json({ message: msg }, { status: 500 });
  }
}
