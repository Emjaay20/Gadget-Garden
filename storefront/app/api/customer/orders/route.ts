import { proxyJson } from "@/lib/server/proxy";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");

  return proxyJson("/shop/customer/orders", {
    method: "GET",
    headers: authHeader ? { Authorization: authHeader } : {},
  });
}
