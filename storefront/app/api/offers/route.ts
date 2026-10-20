import { proxyJson } from "@/lib/server/proxy";

/** POST /api/offers — submit a customer bargain offer on a laptop or unit. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  return proxyJson("/shop/offers", { method: "POST", body });
}
