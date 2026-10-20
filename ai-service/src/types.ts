import { z } from "zod";

export type Product = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  kind: "unit" | "stocked";
  from_price: number | null;
  available_count: number;
  in_stock: boolean;
  warranty_months: number;
  summary_specs?: Record<string, unknown>;
  units?: ProductUnit[];
};

export type ProductUnit = {
  id: string;
  sku: string;
  condition: string;
  grade: string | null;
  price: number;
  status: string;
  is_available: boolean;
  specs: {
    cpu?: string | null;
    ram_gb?: number | null;
    storage_gb?: number | null;
    screen?: string | null;
    gpu?: string | null;
    battery_health?: number | null;
  };
};

export type RecommendationItem = {
  productId: string;
  productSlug: string;
  productName: string;
  brand: string;
  price: number;
  condition: string;
  grade: string;
  batteryHealth?: number | null;
  unitSku?: string | null;
  unitId?: string | null;
  specs: Record<string, unknown>;
  matchReasons: string[];
  canMakeOffer: boolean;
};

export const ChatRequestSchema = z.object({
  query: z.string().min(1).max(1000),
  budgetMax: z.number().optional(),
  brand: z.string().optional(),
  minRam: z.number().optional(),
  purpose: z.string().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export type ChatResponse = {
  message: string;
  intent: {
    purpose: string;
    budgetMax: number | null;
    minRam: number | null;
    brand: string | null;
    needsGpu: boolean;
  };
  recommendations: RecommendationItem[];
  toolsExecuted: string[];
  timestamp: string;
};
