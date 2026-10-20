import { proxyJson } from "@/lib/server/proxy";

/**
 * POST /api/cart — re-price and re-check the cart.
 *
 * The storefront calls this every time the cart renders, so a machine somebody
 * else bought is flagged before checkout rather than after.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  return proxyJson("/shop/cart", { method: "POST", body });
}
