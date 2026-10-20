import type { Product, ProductUnit } from "../types.js";

const LARAVEL_API_URL = process.env.LARAVEL_API_URL ?? "http://localhost:8000/api";

/**
 * Tool 1: Search live inventory with filters.
 */
export async function searchInventoryTool(params: {
  search?: string;
  category?: string;
  maxPrice?: number;
}): Promise<Product[]> {
  const url = new URL(`${LARAVEL_API_URL}/shop/products`);
  if (params.search) url.searchParams.set("search", params.search);
  if (params.category) url.searchParams.set("category", params.category);
  if (params.maxPrice) url.searchParams.set("max_price", String(params.maxPrice));

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: Product[] };
    return json.data ?? [];
  } catch {
    return [];
  }
}

/**
 * Tool 2: Get physical unit specifications, condition, and battery health.
 */
export async function getProductDetailsTool(slug: string): Promise<Product | null> {
  const url = `${LARAVEL_API_URL}/shop/products/${encodeURIComponent(slug)}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: Product };
    return json.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Tool 3: Evaluate bargaining floor & probability for an offer.
 * Rules:
 * - < 70% of ask price: Auto-decline
 * - 70% - 94%: Queued for manager review
 * - >= 95%: Auto-accepted on the spot
 */
export function calculateBargainProbabilityTool(originalPrice: number, offeredPrice: number) {
  const ratio = offeredPrice / originalPrice;
  const discountPercent = Math.round((1 - ratio) * 100);

  if (ratio < 0.7) {
    return {
      status: "auto_decline",
      probability: 0,
      discountPercent,
      message: `₦${offeredPrice.toLocaleString()} is below our 30% floor discount limit. The showroom desk will decline this offer.`,
    };
  }

  if (ratio >= 0.95) {
    return {
      status: "auto_accept",
      probability: 100,
      discountPercent,
      message: `₦${offeredPrice.toLocaleString()} meets our 5% immediate auto-accept threshold! You can lock this machine right away.`,
    };
  }

  return {
    status: "review_queue",
    probability: Math.round(((ratio - 0.7) / (0.95 - 0.7)) * 100),
    discountPercent,
    message: `₦${offeredPrice.toLocaleString()} is ${discountPercent}% off ask price. This will be queued to the Computer Village review desk with moderate chance of counter-offer.`,
  };
}

/**
 * Tool 4: Track live order milestones and courier status.
 */
export async function trackOrderTool(reference: string) {
  const url = `${LARAVEL_API_URL}/shop/orders/${encodeURIComponent(reference)}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: Record<string, unknown> };
    return json.data ?? null;
  } catch {
    return null;
  }
}
