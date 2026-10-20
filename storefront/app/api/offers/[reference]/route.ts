import { proxyJson } from "@/lib/server/proxy";

/** GET /api/offers/{reference} — customer retrieves their offer status. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;

  return proxyJson(`/shop/offers/${encodeURIComponent(reference)}`);
}
