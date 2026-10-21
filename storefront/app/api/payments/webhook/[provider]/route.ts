import { proxyWebhook } from "@/lib/server/proxy";

type Props = { params: Promise<{ provider: string }> };

/**
 * Public callback endpoint for payment providers. Configure Xendify with
 * `/api/payments/webhook/xendify` on this storefront domain.
 */
export async function POST(request: Request, { params }: Props) {
  const { provider } = await params;

  return proxyWebhook(`/shop/payments/webhook/${encodeURIComponent(provider)}`, request);
}
