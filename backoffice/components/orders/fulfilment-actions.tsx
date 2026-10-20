"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { OrderStatus } from "@/lib/types";

/**
 * The fulfilment controls.
 *
 * The buttons come from `next_statuses`, which the SERVER computes from the
 * transition graph. Deriving them here would mean the graph lived in two places
 * and could drift — and the drift would show up as a button that always errors.
 */
const LABEL: Partial<Record<OrderStatus, string>> = {
  processing: "Start preparing",
  shipped: "Mark shipped",
  delivered: "Mark delivered",
  cancelled: "Cancel order",
};

export function FulfilmentActions({
  reference,
  nextStatuses,
}: {
  reference: string;
  nextStatuses: OrderStatus[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<OrderStatus | "note" | null>(null);
  const [note, setNote] = useState("");

  async function submit(status?: OrderStatus) {
    setBusy(status ?? "note");

    const response = await fetch(`/api/orders/${reference}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, note: note.trim() || undefined }),
    });

    setBusy(null);

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));

      toast.error(
        body.errors?.status?.[0] ?? body.message ?? "That did not work.",
      );

      return;
    }

    setNote("");
    toast.success(status ? `Order marked ${status}.` : "Note added.");
    router.refresh();
  }

  return (
    <section className="rounded-xl border p-4">
      <h2 className="text-xs font-semibold tracking-[0.14em] uppercase">
        Actions
      </h2>

      <div className="mt-3 space-y-2">
        {nextStatuses.length === 0 ? (
          <p className="text-muted-foreground text-sm text-pretty">
            Nothing further to do — this order is closed. Anything after delivery
            is a return, which is handled separately.
          </p>
        ) : (
          nextStatuses.map((status) => (
            <Button
              key={status}
              className="w-full"
              variant={status === "cancelled" ? "outline" : "default"}
              disabled={busy !== null}
              onClick={() => submit(status)}
            >
              {busy === status && <Loader2 className="size-4 animate-spin" />}
              {LABEL[status] ?? status}
            </Button>
          ))
        )}
      </div>

      <div className="mt-4 border-t pt-4">
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Add a note — it is attached to whichever action you take, and signed with your name."
          rows={3}
          className="text-sm"
        />
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full"
          disabled={busy !== null || note.trim().length === 0}
          onClick={() => submit()}
        >
          {busy === "note" && <Loader2 className="size-4 animate-spin" />}
          Save note only
        </Button>
      </div>
    </section>
  );
}
