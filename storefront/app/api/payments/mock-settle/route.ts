import { proxyJson } from "@/lib/server/proxy";

/**
 * POST /api/payments/mock-settle — DEV ONLY.
 *
 * Stands in for the customer completing a bank transfer. The backend 404s this
 * the moment a real provider is bound, so it needs no guard of its own.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  return proxyJson("/shop/payments/mock-settle", { method: "POST", body });
}
