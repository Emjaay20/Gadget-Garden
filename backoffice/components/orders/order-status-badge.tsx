import type { OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Order status, with the tone carrying the meaning at a glance.
 *
 * The label is always rendered — colour alone never says what state an order is
 * in, both for accessibility and because "amber" and "grey" are indistinguishable
 * on a sun-lit phone at a shop counter.
 */
const TONE: Record<OrderStatus, { label: string; className: string }> = {
  pending_payment: {
    label: "Awaiting payment",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  paid: {
    label: "Paid — to prepare",
    className: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  },
  processing: {
    label: "Preparing",
    className: "border-blue-600/30 bg-blue-600/10 text-blue-700 dark:text-blue-400",
  },
  shipped: {
    label: "Shipped",
    className: "border-indigo-600/30 bg-indigo-600/10 text-indigo-700 dark:text-indigo-400",
  },
  delivered: {
    label: "Delivered",
    className: "border-border bg-muted text-muted-foreground",
  },
  failed: {
    label: "Payment failed",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  cancelled: {
    label: "Cancelled",
    className: "border-border bg-muted text-muted-foreground",
  },
};

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  const tone = TONE[status] ?? TONE.pending_payment;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        tone.className,
        className,
      )}
    >
      {tone.label}
    </span>
  );
}
