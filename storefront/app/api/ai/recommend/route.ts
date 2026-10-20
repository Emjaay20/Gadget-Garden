import { NextResponse } from "next/server";
import { proxyJson } from "@/lib/server/proxy";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:4000";

/**
 * POST /api/ai/recommend — AI Matchmaker recommendations for the storefront assistant.
 *
 * Polyglot Architecture:
 * 1. Delegates to the Node.js + TypeScript Autonomous AI Agent microservice (`/chat`).
 * 2. If the microservice is offline or unreachable, seamlessly degrades to the
 *    Laravel backend engine (`/shop/ai/recommend`).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  // Attempt routing through the Node.js + TypeScript microservice
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const aiRes = await fetch(`${AI_SERVICE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (aiRes.ok) {
      const data = await aiRes.json();
      return NextResponse.json({
        message: data.message,
        detected_intent: {
          purpose: data.intent?.purpose ?? "general",
          budget_max: data.intent?.budgetMax ?? null,
          min_ram: data.intent?.minRam ?? null,
          brand: data.intent?.brand ?? null,
          needs_gpu: Boolean(data.intent?.needsGpu),
        },
        is_fallback: false,
        recommendations: (data.recommendations ?? []).map((rec: Record<string, unknown>) => ({
          product_id: rec.productId,
          product_slug: rec.productSlug,
          product_name: rec.productName,
          brand: rec.brand,
          image_url: rec.imageUrl,
          unit_id: rec.unitId,
          unit_sku: rec.unitSku,
          condition: rec.condition,
          grade: rec.grade,
          price: rec.price,
          specs: rec.specs ?? {},
          match_reasons: rec.matchReasons ?? [],
          can_make_offer: rec.canMakeOffer ?? true,
          checkout_url: rec.checkoutUrl,
        })),
      });
    }
  } catch {
    // Seamless fallback to Laravel backend if Node microservice is not responding
  }

  return proxyJson("/shop/ai/recommend", { method: "POST", body });
}
