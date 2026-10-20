"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Adjust quantity stock.
 *
 * Two modes, matching the two things that actually happen on a shop floor:
 * something changed by a known amount (a delivery, a breakage), or somebody
 * counted the shelf. The API records a count as the delta it implies, so the
 * ledger stays continuous either way.
 *
 * Reasons are directional and the server enforces it — a "restock" of −4 is a
 * typo, not a restock — so the reason list is filtered to match the mode rather
 * than letting the user pick a combination that will only be refused.
 */
const ADDITIVE = [
  { value: "restock", label: "Restock — new delivery" },
  { value: "return", label: "Return — came back to us" },
];

const SUBTRACTIVE = [
  { value: "sale", label: "Sale — sold off-site" },
  { value: "damage", label: "Damage — broken or lost" },
];

export function StockMovementForm({
  slug,
  currentStock,
}: {
  slug: string;
  currentStock: number;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"change" | "count">("change");
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("restock");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reasons = mode === "count" ? [] : direction === "add" ? ADDITIVE : SUBTRACTIVE;

  function switchDirection(next: "add" | "remove") {
    setDirection(next);
    // Keep the reason valid for the direction, or the server will refuse it.
    setReason(next === "add" ? "restock" : "sale");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const value = Number(amount);

    const body =
      mode === "count"
        ? { stock: value, reason: "correction", note: note.trim() || undefined }
        : {
            delta: direction === "add" ? value : -value,
            reason,
            note: note.trim() || undefined,
          };

    const response = await fetch(`/api/inventory/${slug}/stock-movements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setBusy(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const first =
        payload.errors?.delta?.[0] ??
        payload.errors?.reason?.[0] ??
        payload.message;

      setError(first ?? "That did not work.");

      return;
    }

    const payload = await response.json();
    toast.success(`Stock is now ${payload.data.stock_after}.`);
    setAmount("");
    setNote("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4 rounded-xl border p-4">
      <div className="flex gap-1 text-sm">
        {(["change", "count"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMode(option)}
            className={
              mode === option
                ? "bg-accent rounded-md px-3 py-1.5 font-medium"
                : "text-muted-foreground rounded-md px-3 py-1.5"
            }
          >
            {option === "change" ? "Something changed" : "I counted the shelf"}
          </button>
        ))}
      </div>

      {mode === "change" && (
        <div className="flex gap-1 text-sm">
          {(["add", "remove"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => switchDirection(option)}
              className={
                direction === option
                  ? "border-foreground rounded-md border px-3 py-1 text-xs font-medium"
                  : "text-muted-foreground rounded-md border border-transparent px-3 py-1 text-xs"
              }
            >
              {option === "add" ? "Added" : "Removed"}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="amount">
          {mode === "count" ? "Counted total" : "How many"}
        </Label>
        <Input
          id="amount"
          type="number"
          min={mode === "count" ? 0 : 1}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
        />
        <p className="text-muted-foreground text-xs">
          Currently {currentStock} in stock.
        </p>
      </div>

      {mode === "change" && (
        <div className="grid gap-1.5">
          <Label>Reason</Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {reasons.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="note">Note</Label>
        <Input
          id="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional — but it is what makes the ledger readable later."
        />
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <Button type="submit" disabled={busy || !amount} className="w-full">
        {busy && <Loader2 className="size-4 animate-spin" />}
        Record
      </Button>
    </form>
  );
}
