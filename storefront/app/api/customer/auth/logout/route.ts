import { proxyJson } from "@/lib/server/proxy";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");

  return proxyJson("/shop/auth/logout", {
    method: "POST",
    headers: authHeader ? { Authorization: authHeader } : {},
  });
}
