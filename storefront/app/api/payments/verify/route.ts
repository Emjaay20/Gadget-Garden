import { proxyJson } from "@/lib/server/proxy";

/**
 * POST /api/payments/verify — ask the provider whether the money landed.
 *
 * Polled by the pay page. Authoritative because it asks the PROVIDER; the
 * browser is never trusted to report its own payment.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  return proxyJson("/shop/payments/verify", { method: "POST", body });
}
