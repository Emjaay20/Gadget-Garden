import { proxyJson } from "@/lib/server/proxy";

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  return proxyJson("/shop/customer/wishlist/items", {
    method: "POST",
    body: await request.json(),
    headers: authorization ? { Authorization: authorization } : {},
  });
}
