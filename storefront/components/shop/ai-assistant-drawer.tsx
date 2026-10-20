"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Bot,
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
  ShoppingCart,
  ExternalLink,
  BatteryCharging,
  Cpu,
  Layers,
  HardDrive,
  Monitor,
  Gamepad2,
  Tag,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCart } from "@/lib/cart-store";
import { naira } from "@/lib/format";
import {
  askAiAssistant,
  type AiAssistantResponse,
  type AiRecommendationItem,
} from "@/lib/shop-client";
import { MakeAnOfferModal } from "@/components/shop/make-an-offer-modal";

type ChatMessage = {
  id: string;
  sender: "assistant" | "user";
  text: string;
  timestamp: string;
  recommendations?: AiRecommendationItem[];
  intent?: AiAssistantResponse["detected_intent"];
};

const PROMPT_SUGGESTIONS = [
  {
    label: "💻 Software Engineering (₦500k – ₦750k)",
    prompt: "I need a high performance laptop for software engineering and docker under 750k with at least 16GB RAM.",
  },
  {
    label: "🎮 Gaming & 3D (Blender / Dedicated GPU)",
    prompt: "Looking for a high performance machine with dedicated RTX GPU for gaming and 3D rendering.",
  },
  {
    label: "🔋 90%+ Battery Health for Commute & University",
    prompt: "I need a lightweight laptop with 90%+ battery health for university coding and long commutes.",
  },
  {
    label: "💰 Clean Workhorse Under ₦550,000",
    prompt: "Show me your cleanest Grade A laptop under 550k for office multitasking and Excel.",
  },
];

export function AiAssistantDrawer() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial-greeting",
      sender: "assistant",
      text: "Hello! I am your Gadgets Garden showroom consultant. Tell me what you need—your workflow (coding, gaming, office), preferred budget, or specs—and I will match you with certified, in-stock machines from our Computer Village inventory.",
      timestamp: "Just now",
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { addUnit, addProduct } = useCart();

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  async function handleSend(promptText?: string) {
    const textToSend = (promptText ?? input).trim();
    if (!textToSend || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: textToSend,
      timestamp: "Just now",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await askAiAssistant({ query: textToSend });

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: "assistant",
        text: response.message,
        timestamp: "Just now",
        recommendations: response.recommendations,
        intent: response.detected_intent,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          sender: "assistant",
          text: "I had trouble scanning our inventory servers just now. Please try again or check our catalogue tab.",
          timestamp: "Just now",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleAddToCart(item: AiRecommendationItem) {
    if (item.unit_id) {
      addUnit(item.unit_id);
      toast.success(`${item.product_name} (${item.unit_sku}) added to cart!`);
    } else {
      addProduct(item.product_id);
      toast.success(`${item.product_name} added to cart!`);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* Floating Trigger Button */}
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open AI Laptop Matchmaker"
          className="group fixed right-5 bottom-6 z-40 flex items-center gap-2.5 rounded-full bg-neutral-900 px-4 py-3 text-sm font-medium text-white shadow-xl ring-1 ring-white/20 transition-all hover:scale-105 hover:bg-neutral-800 active:scale-95 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500 dark:bg-white"></span>
          </span>
          <Sparkles className="size-4 text-emerald-400 dark:text-white" />
          <span className="font-semibold tracking-tight">Ask GG Assistant</span>
        </button>
      </SheetTrigger>

      {/* Slide-over Sheet Content */}
      <SheetContent
        side="right"
        className="flex h-full w-full max-w-full flex-col p-0 sm:max-w-lg md:max-w-xl"
      >
        <SheetHeader className="border-border bg-muted/40 border-b px-5 py-4 text-left">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-emerald-600/10 p-2 text-emerald-600 dark:text-emerald-400">
              <Bot className="size-5" />
            </div>
            <div>
              <SheetTitle className="text-base font-semibold">
                Laptop Matchmaker
              </SheetTitle>
              <SheetDescription className="text-xs">
                Real-time stock consultation for Lagos Computer Village
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Messages Stream */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.sender === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.sender === "user"
                    ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                    : "border-border/60 bg-muted/30 border text-foreground"
                }`}
              >
                <p className="whitespace-pre-line">{msg.text}</p>
              </div>

              {/* Recommendation Cards */}
              {msg.recommendations && msg.recommendations.length > 0 && (
                <div className="mt-3 w-full space-y-3">
                  {msg.recommendations.map((item) => (
                    <div
                      key={item.unit_sku ?? item.product_id}
                      className="border-border bg-card text-card-foreground rounded-xl border p-4 shadow-xs transition hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                              {item.brand}
                            </span>
                            {item.grade && (
                              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
                                Grade {item.grade}
                              </span>
                            )}
                            {item.specs && typeof item.specs.battery_health === "number" && (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                                <BatteryCharging className="size-3" />
                                {item.specs.battery_health}% Battery
                              </span>
                            )}
                          </div>
                          <h4 className="mt-1 font-semibold leading-snug">
                            {item.product_name}
                          </h4>
                          {item.unit_sku && (
                            <span className="text-muted-foreground font-mono text-[11px]">
                              Unit SKU: {item.unit_sku}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                            {naira(item.price)}
                          </span>
                        </div>
                      </div>

                      {/* Specs Pills */}
                      {item.specs && (
                        <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                          {item.specs.cpu ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-muted-foreground">
                              <Cpu className="size-3" />
                              {String(item.specs.cpu)}
                            </span>
                          ) : null}
                          {item.specs.ram_gb ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-muted-foreground">
                              <Layers className="size-3" />
                              {String(item.specs.ram_gb)}GB RAM
                            </span>
                          ) : null}
                          {item.specs.storage_gb ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-muted-foreground">
                              <HardDrive className="size-3" />
                              {String(item.specs.storage_gb)}GB SSD
                            </span>
                          ) : null}
                          {item.specs.screen ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-muted-foreground">
                              <Monitor className="size-3" />
                              {String(item.specs.screen)}
                            </span>
                          ) : null}
                          {item.specs.gpu ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 px-2 py-0.5 text-purple-700 dark:text-purple-300">
                              <Gamepad2 className="size-3" />
                              {String(item.specs.gpu)}
                            </span>
                          ) : null}
                        </div>
                      )}

                      {/* Why it matches */}
                      {item.match_reasons && item.match_reasons.length > 0 && (
                        <div className="mt-3 space-y-1 border-t border-border/50 pt-2.5">
                          {item.match_reasons.map((reason, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-1.5 text-xs text-muted-foreground"
                            >
                              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                              <span>{reason}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="mt-4 flex flex-wrap items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={() => handleAddToCart(item)}
                          className="gap-1.5 text-xs"
                        >
                          <ShoppingCart className="size-3.5" />
                          Add to Cart
                        </Button>

                        {item.can_make_offer && (
                          <MakeAnOfferModal
                            productId={item.product_id}
                            productName={item.product_name}
                            originalPrice={item.price}
                            unitId={item.unit_id}
                            unitSku={item.unit_sku}
                          />
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="gap-1 text-xs"
                        >
                          <Link
                            href={`/product/${item.product_slug}`}
                            onClick={() => setOpen(false)}
                          >
                            Specs
                            <ExternalLink className="size-3" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-emerald-600" />
              <span>Scanning Computer Village showroom inventory & specs…</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        {messages.length <= 2 && (
          <div className="border-t border-border/50 bg-muted/20 px-5 py-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">
              Quick Inquiries:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PROMPT_SUGGESTIONS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleSend(item.prompt)}
                  className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground transition hover:border-emerald-500 hover:bg-emerald-500/5 active:scale-95"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Form */}
        <div className="border-t border-border bg-background p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. Need a laptop for coding under 650k with 16GB RAM..."
              className="text-sm"
              disabled={loading}
            />
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              size="icon"
              className="shrink-0"
              aria-label="Send query"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
