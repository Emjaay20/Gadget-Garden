import { proxyJson } from "@/lib/server/proxy";

function auth(request: Request): Record<string, string> {
  const value = request.headers.get("authorization");
  return value ? { Authorization: value } : {};
}

export async function GET(request: Request) {
  return proxyJson("/shop/customer/wishlist", { headers: auth(request) });
}

export async function PATCH(request: Request) {
  return proxyJson("/shop/customer/wishlist", { method: "PATCH", body: await request.json(), headers: auth(request) });
}
