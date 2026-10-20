import {
  searchInventoryTool,
  getProductDetailsTool,
  calculateBargainProbabilityTool,
  trackOrderTool,
} from "../tools/catalog-tools.js";
import type {
  ChatRequest,
  ChatResponse,
  Product,
  ProductUnit,
  RecommendationItem,
} from "../types.js";

export class AgentEngine {
  /**
   * Main entrypoint for customer inquiries.
   */
  async processInquiry(request: ChatRequest): Promise<ChatResponse> {
    const toolsExecuted: string[] = [];
    const query = request.query;

    // 1. Check if user is asking to track an order (e.g. GG-ABC123)
    const orderMatch = query.match(/(?:GG-[A-Z0-9]+|order\s*#?\s*([A-Z0-9-]+))/i);
    if (orderMatch) {
      const ref = orderMatch[0].toUpperCase();
      toolsExecuted.push("trackOrderTool");
      const orderData = await trackOrderTool(ref);

      if (orderData) {
        return {
          message: `I located your order **#${ref}**. Current status: **${String(
            orderData.status_label ?? orderData.status
          )}**.\n\nYour items are tracked in our Lagos system. You can view full delivery progress on your tracking page or message our showroom desk on WhatsApp.`,
          intent: {
            purpose: "order_tracking",
            budgetMax: null,
            minRam: null,
            brand: null,
            needsGpu: false,
          },
          recommendations: [],
          toolsExecuted,
          timestamp: new Date().toISOString(),
        };
      }
    }

    // 2. Parse natural language intent from query
    const intent = this.extractIntent(query, request);

    // 3. Execute search tool against inventory
    toolsExecuted.push("searchInventoryTool");
    const products = await searchInventoryTool({
      search: intent.brand ?? undefined,
      maxPrice: intent.budgetMax ? Math.round(intent.budgetMax * 1.05) : undefined,
    });

    // 4. Fetch unit-level details for top candidates
    const recommendations: RecommendationItem[] = [];

    for (const product of products.slice(0, 5)) {
      toolsExecuted.push(`getProductDetailsTool:${product.slug}`);
      const detailed = await getProductDetailsTool(product.slug);
      const units = detailed?.units ?? [];

      if (units.length > 0) {
        for (const unit of units) {
          if (!unit.is_available) continue;
          if (intent.budgetMax && unit.price > intent.budgetMax * 1.05) continue;
          if (intent.minRam && (unit.specs.ram_gb ?? 8) < intent.minRam) continue;

          const matchReasons = this.buildMatchReasons(unit, product, intent);

          recommendations.push({
            productId: product.id,
            productSlug: product.slug,
            productName: product.name,
            brand: product.brand ?? "Genuine",
            price: unit.price,
            condition: unit.condition,
            grade: unit.grade ?? "A",
            batteryHealth: unit.specs.battery_health,
            unitSku: unit.sku,
            unitId: unit.id,
            specs: unit.specs,
            matchReasons,
            canMakeOffer: true,
          });

          if (recommendations.length >= 3) break;
        }
      } else if (product.from_price) {
        // Stocked product (accessories/chargers)
        recommendations.push({
          productId: product.id,
          productSlug: product.slug,
          productName: product.name,
          brand: product.brand ?? "Official",
          price: product.from_price,
          condition: "new",
          grade: "Sealed",
          specs: product.summary_specs ?? {},
          matchReasons: [
            "Backed by full showroom warranty",
            "Ready for immediate dispatch across Lagos",
          ],
          canMakeOffer: false,
        });
      }

      if (recommendations.length >= 3) break;
    }

    // 5. Generate consultant response message
    const message = this.synthesizeResponse(recommendations, intent);

    return {
      message,
      intent,
      recommendations,
      toolsExecuted,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Evaluates a bargain offer using Tool 3.
   */
  evaluateOffer(originalPrice: number, offeredPrice: number) {
    return calculateBargainProbabilityTool(originalPrice, offeredPrice);
  }

  private extractIntent(query: string, request: ChatRequest) {
    const normalized = query.toLowerCase();

    // Budget
    let budgetMax = request.budgetMax ?? null;
    if (!budgetMax) {
      const match = normalized.match(
        /(?:under|below|budget(?:\s*of)?|max(?:\s*of)?|<)\s*(?:₦|ngn)?\s*(\d+(?:[.,]\d+)?)\s*(k|m|million|thousand)?/i
      );
      if (match) {
        const num = parseFloat(match[1].replace(/,/g, ""));
        const unit = (match[2] ?? "").toLowerCase();
        if (unit === "k" || unit === "thousand") budgetMax = Math.round(num * 1000);
        else if (unit === "m" || unit === "million") budgetMax = Math.round(num * 1000000);
        else if (num < 5000) budgetMax = Math.round(num * 1000);
        else budgetMax = Math.round(num);
      }
    }

    // RAM
    let minRam = request.minRam ?? null;
    if (!minRam) {
      const ramMatch = normalized.match(/(4|8|16|32|64)\s*gb(?:\s*ram)?/i);
      if (ramMatch) minRam = parseInt(ramMatch[1], 10);
    }

    // Brand
    let brand = request.brand ?? null;
    if (!brand) {
      const brands = ["dell", "hp", "lenovo", "apple", "alienware", "asus", "acer"];
      for (const b of brands) {
        if (normalized.includes(b)) {
          brand = b.charAt(0).toUpperCase() + b.slice(1);
          break;
        }
      }
    }

    // Workflow / Purpose
    let purpose = request.purpose ?? "general_computing";
    let needsGpu = false;

    if (/(game|gaming|rtx|gpu|blender|3d|render|video edit)/i.test(normalized)) {
      purpose = "gaming_and_creative";
      needsGpu = true;
    } else if (/(code|coding|developer|software|programming|python|docker)/i.test(normalized)) {
      purpose = "software_development";
    } else if (/(student|school|lightweight|light|travel|battery)/i.test(normalized)) {
      purpose = "portability_and_study";
    }

    return {
      purpose,
      budgetMax,
      minRam,
      brand,
      needsGpu,
    };
  }

  private buildMatchReasons(
    unit: ProductUnit,
    product: Product,
    intent: ReturnType<typeof this.extractIntent>
  ): string[] {
    const reasons: string[] = [];

    if (intent.purpose === "software_development") {
      if ((unit.specs.ram_gb ?? 8) >= 16) {
        reasons.push(`${unit.specs.ram_gb}GB RAM: High headroom for compiling and running Docker containers.`);
      }
      if (unit.specs.cpu) {
        reasons.push(`${unit.specs.cpu} delivers fast code compilation.`);
      }
    } else if (intent.purpose === "gaming_and_creative") {
      if (unit.specs.gpu) {
        reasons.push(`Dedicated ${unit.specs.gpu} GPU accelerates 3D rendering and gaming.`);
      }
    } else if (intent.purpose === "portability_and_study") {
      if ((unit.specs.battery_health ?? 0) >= 90) {
        reasons.push(`Verified ${unit.specs.battery_health}% battery health ensures dependable hours in transit.`);
      }
    }

    if (unit.grade === "A" && reasons.length < 2) {
      reasons.push("Grade A pristine exterior condition with zero chassis defects.");
    }

    if (intent.budgetMax && unit.price <= intent.budgetMax) {
      const diff = intent.budgetMax - unit.price;
      if (diff > 0) {
        reasons.push(`Under your budget by ₦${diff.toLocaleString()}.`);
      }
    }

    reasons.push("Eligible for instant bargain offer or 1-click showroom checkout.");

    return reasons.slice(0, 3);
  }

  private synthesizeResponse(
    recommendations: RecommendationItem[],
    intent: ReturnType<typeof this.extractIntent>
  ): string {
    if (recommendations.length === 0) {
      const budgetText = intent.budgetMax ? ` under ₦${intent.budgetMax.toLocaleString()}` : "";
      return `I scanned our Computer Village showroom stock, but didn't find an available machine matching all those exact parameters${budgetText}. In Lagos Computer Village, high-performance machines usually start slightly higher. Feel free to browse our catalogue or message our sales desk on WhatsApp!`;
    }

    const lead = `I analyzed our physical stock at 12 Oshitelu Street for ${intent.purpose.replace(/_/g, " ")}${
      intent.budgetMax ? ` under ₦${intent.budgetMax.toLocaleString()}` : ""
    }. Here ${recommendations.length === 1 ? "is the top tested machine" : `are ${recommendations.length} top certified machines`} ready for testing:`;

    return lead;
  }
}
