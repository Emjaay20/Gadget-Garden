import { proxyJson } from "@/lib/server/proxy";

type Props = { params: Promise<{ reference: string }> };

export async function GET(request: Request, { params }: Props) {
  const { reference } = await params;
  const authHeader = request.headers.get("authorization");

  return proxyJson(`/shop/customer/orders/${encodeURIComponent(reference)}`, {
    method: "GET",
    headers: authHeader ? { Authorization: authHeader } : {},
  });
}
