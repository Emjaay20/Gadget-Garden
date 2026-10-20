import { proxyJson } from "@/lib/server/proxy";

/** POST /api/payments/initialize — mint (or re-fetch) the virtual account. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  return proxyJson("/shop/payments/initialize", { method: "POST", body });
}
