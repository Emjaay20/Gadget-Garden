import { proxyJson } from "@/lib/server/proxy";

export async function DELETE(request: Request, context: RouteContext<"/api/customer/wishlist/items/[id]">) {
  const { id } = await context.params;
  const authorization = request.headers.get("authorization");
  return proxyJson(`/shop/customer/wishlist/items/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authorization ? { Authorization: authorization } : {},
  });
}
