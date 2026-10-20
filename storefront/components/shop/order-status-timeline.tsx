"use client";

import {
  CheckCircle2,
  CircleDashed,
  Clock,
  Laptop,
  MapPin,
  MessageCircle,
  Package,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUSINESS } from "@/lib/business";
import { cn } from "@/lib/utils";

type Props = {
  status: string;
  reference: string;
  deliveryZone?: string;
  isPaid?: boolean;
};

export function OrderStatusTimeline({
  status,
  reference,
  deliveryZone,
  isPaid = false,
}: Props) {
  // Map internal order status to 5-step milestone
  const currentStep = getStepNumber(status);

  const steps = [
    {
      step: 1,
      title: "Order Placed & Machine Reserved",
      description: "Unit taken off shelf; serial number locked to your receipt.",
      icon: Laptop,
    },
    {
      step: 2,
      title: "Payment Confirmed",
      description: "Transfer or POS reconciliation verified by finance.",
      icon: CheckCircle2,
    },
    {
      step: 3,
      title: "Showroom QA & Diagnostic Benchmark",
      description: "Battery, thermal, and screen tested at Oshitelu St lab.",
      icon: ShieldCheck,
    },
    {
      step: 4,
      title: deliveryZone?.includes("pickup")
        ? "Ready for In-Store Pickup"
        : "Dispatched with Dispatch Rider",
      description: deliveryZone?.includes("pickup")
        ? "Ready at 12 Oshitelu Street, Computer Village, Ikeja."
        : "Packaged securely with tamper seal & on transit across Lagos.",
      icon: deliveryZone?.includes("pickup") ? MapPin : Truck,
    },
    {
      step: 5,
      title: "Delivered & Warranty Activated",
      description: "Item inspected by buyer; full warranty guarantee active.",
      icon: Package,
    },
  ];

  const whatsappInquiryUrl = `${BUSINESS.whatsappUrl}?text=${encodeURIComponent(
    `Hello Gadgets Garden! I am tracking my order #${reference}. Could you please update me on its progress?`,
  )}`;

  return (
    <div className="rounded-xl border border-border bg-card p-5 text-card-foreground">
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Live Order Status
          </h3>
          <p className="text-sm font-bold text-foreground">
            Reference: <span className="font-mono text-emerald-600 dark:text-emerald-400">{reference}</span>
          </p>
        </div>
        <Button size="sm" variant="outline" asChild className="gap-1.5 text-xs">
          <a href={whatsappInquiryUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="size-3.5 text-emerald-600" />
            WhatsApp Desk
          </a>
        </Button>
      </div>

      <div className="mt-5 space-y-6">
        {steps.map((item, index) => {
          const isDone = item.step < currentStep || (item.step === 2 && isPaid);
          const isCurrent = item.step === currentStep && !(item.step === 2 && isPaid);
          const isPending = item.step > currentStep;

          const StepIcon = item.icon;

          return (
            <div key={item.step} className="relative flex items-start gap-4">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "absolute left-4 top-8 -bottom-4 w-0.5 -translate-x-1/2 transition-colors",
                    isDone ? "bg-emerald-600 dark:bg-emerald-500" : "bg-border",
                  )}
                />
              )}

              {/* Status Circle */}
              <div
                className={cn(
                  "relative z-10 grid size-8 shrink-0 place-items-center rounded-full border text-xs font-medium transition-colors",
                  isDone
                    ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500"
                    : isCurrent
                      ? "border-emerald-600 bg-background text-emerald-600 ring-4 ring-emerald-500/20 dark:border-emerald-400 dark:text-emerald-400"
                      : "border-border bg-muted/40 text-muted-foreground",
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="size-4" />
                ) : isCurrent ? (
                  <StepIcon className="size-4 animate-pulse" />
                ) : (
                  <CircleDashed className="size-4 opacity-50" />
                )}
              </div>

              {/* Step info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4
                    className={cn(
                      "text-sm font-semibold",
                      isCurrent
                        ? "text-emerald-700 dark:text-emerald-400"
                        : isDone
                          ? "text-foreground"
                          : "text-muted-foreground",
                    )}
                  >
                    {item.title}
                  </h4>
                  {isCurrent && (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                      Current stage
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getStepNumber(status: string): number {
  switch (status) {
    case "pending_payment":
      return 1;
    case "paid":
      return 2;
    case "processing":
      return 3;
    case "shipped":
      return 4;
    case "delivered":
      return 5;
    default:
      return 1;
  }
}
