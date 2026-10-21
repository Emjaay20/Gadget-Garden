/**
 * Browser-side calls to the storefront's own route handlers.
 *
 * These hit `/api/*` on this origin, which proxies to Laravel — the API host is
 * never in the client bundle. Deliberately NOT `lib/api.ts`, which is
 * `server-only` and would fail the build if imported from a client component.
 */

import type { CartEntry } from "@/lib/cart-store";
import type { Condition, CouponValidationResult, Order, UnitSpecs } from "@/lib/types";

export type ResolvedLine = {
  key: string;
  product_id: string;
  product_slug: string;
  product_unit_id: string | null;
  name: string;
  sku: string | null;
  brand: string | null;
  condition: Condition | null;
  specs: UnitSpecs;
  unit_price: number;
  quantity: number;
  line_total: number;
  is_available: boolean;
  /** A human sentence when the line cannot be bought; null when it can. */
  problem: string | null;
};

export type ResolvedCart = {
  lines: ResolvedLine[];
  subtotal: number;
  delivery_fee: number;
  discount_amount?: number;
  coupon?: {
    code: string;
    description?: string;
    discount_amount?: number;
    error?: string;
    valid?: boolean;
  } | null;
  total: number;
  currency: string;
  has_problems: boolean;
};

export class ShopError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors: Record<string, string[]> = {},
    /** Present on a checkout rejected for availability. */
    public readonly lines?: ResolvedLine[],
  ) {
    super(message);
    this.name = "ShopError";
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ShopError(
      response.status,
      payload.message ?? "Something went wrong. Please try again.",
      payload.errors ?? {},
      payload.lines,
    );
  }

  return payload;
}

/** Re-prices the cart and reports anything that is no longer buyable. */
export async function resolveCart(
  entries: readonly CartEntry[],
  deliveryZone?: string,
  couponCode?: string,
  email?: string,
): Promise<ResolvedCart> {
  const { data } = await post<{ data: ResolvedCart }>("/api/cart", {
    items: entries,
    delivery_zone: deliveryZone,
    coupon_code: couponCode,
    email: email,
  });

  return data;
}

/** Validates a promo code against cart items and returns discount breakdown. */
export async function validateCoupon(
  code: string,
  entries?: readonly CartEntry[],
  deliveryZone?: string,
  email?: string,
): Promise<CouponValidationResult> {
  const res = await post<{ valid: boolean; data: CouponValidationResult }>(
    "/api/coupons/validate",
    {
      code,
      items: entries,
      delivery_zone: deliveryZone,
      email,
    },
  );

  return res.data;
}

export type PlaceOrderInput = {
  items: readonly CartEntry[];
  contact: { name: string; email: string; phone: string };
  delivery_zone: string;
  address: {
    line1: string;
    city: string;
    state: string;
    landmark?: string;
    note?: string;
  };
  offer_reference?: string;
  coupon_code?: string;
  payment_mode?: "full" | "layaway";
};

export type PlacedOrder = {
  reference: string;
  status: string;
  status_label: string;
  subtotal: number;
  delivery_fee: number;
  coupon_code?: string | null;
  discount_amount?: number;
  total: number;
  reserved_until: string | null;
  payment_mode?: "full" | "layaway";
  layaway_paid_amount?: number;
  layaway_balance?: number | null;
  layaway_minimum_payment?: number | null;
  layaway_due_at?: string | null;
};

/**
 * Places the order. Note there is no price anywhere in the input — the server
 * computes every figure from the catalogue.
 */
export async function placeOrder(input: PlaceOrderInput): Promise<PlacedOrder> {
  const { data } = await post<{ data: PlacedOrder }>("/api/orders", input);

  return data;
}

/* ---------------------------------------------------------------- payments */

export type PaymentInstruction = {
  status: string;
  reference?: string;
  amount?: number;
  currency?: string;
  /** Filled by a transfer flow (Xendify). */
  account_number?: string | null;
  account_name?: string | null;
  bank_name?: string | null;
  expires_at?: string | null;
  /** Filled instead by a redirect-style provider. */
  authorization_url?: string | null;
  provider?: string;
  /** Present when the order is already settled. */
  message?: string;
};

/**
 * Asks for the virtual account to transfer to.
 *
 * Safe to call repeatedly: the server returns the SAME account rather than
 * minting another, so a page reload cannot leave a customer holding two account
 * numbers.
 */
export async function initializePayment(
  reference: string,
  amount?: number,
): Promise<PaymentInstruction> {
  const { data } = await post<{ data: PaymentInstruction }>(
    "/api/payments/initialize",
    { reference, amount },
  );

  return data;
}

/**
 * Asks the provider whether the money has landed.
 *
 * This is a read of provider truth, not of local state — which is why it is the
 * thing the pay page polls.
 */
export async function verifyPayment(
  reference: string,
): Promise<{ status: string; order?: Order }> {
  const { data } = await post<{ data: { status: string; order?: Order } }>(
    "/api/payments/verify",
    { reference },
  );

  return data;
}

/**
 * DEV ONLY — pretends the customer completed a bank transfer.
 *
 * 404s once a real provider is bound, which is exactly how the pay page decides
 * whether to render its dev controls.
 */
export async function mockSettle(
  reference: string,
  outcome: "success" | "failed",
  amount?: number,
): Promise<void> {
  await post("/api/payments/mock-settle", { reference, outcome, amount });
}

/* ----------------------------------------------------------- ai assistant */

export type AiRecommendationItem = {
  product_id: string;
  product_slug: string;
  product_name: string;
  brand: string;
  image_url: string | null;
  unit_id: string | null;
  unit_sku: string | null;
  condition: string;
  grade: string;
  price: number;
  specs: Record<string, unknown>;
  match_reasons: string[];
  can_make_offer: boolean;
  checkout_url: string;
};

export type AiAssistantResponse = {
  message: string;
  detected_intent: {
    purpose: string;
    budget_max: number | null;
    min_ram: number | null;
    brand: string | null;
    needs_gpu: boolean;
  };
  is_fallback: boolean;
  recommendations: AiRecommendationItem[];
};

export async function askAiAssistant(input: {
  query: string;
  budget_max?: number;
  brand?: string;
  min_ram?: number;
  purpose?: string;
}): Promise<AiAssistantResponse> {
  return post<AiAssistantResponse>("/api/ai/recommend", input);
}
