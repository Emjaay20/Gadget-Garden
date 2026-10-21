import { proxyJson } from "@/lib/server/proxy";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  return proxyJson("/shop/auth/register", { method: "POST", body });
}
