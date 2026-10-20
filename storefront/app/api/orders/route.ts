import { proxyJson } from "@/lib/server/proxy";

/**
 * POST /api/orders — place the order and reserve any serialized machines.
 *
 * A 422 from here is routine, not exceptional: with one-of-a-kind stock, someone
 * else taking the laptop mid-checkout is an ordinary Tuesday. The body carries
 * per-line problems for the UI to render.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  return proxyJson("/shop/orders", { method: "POST", body });
}
