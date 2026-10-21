"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Landmark,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { naira } from "@/lib/format";
import {
  initializePayment,
  mockSettle,
  verifyPayment,
  type PaymentInstruction,
} from "@/lib/shop-client";
import { cn } from "@/lib/utils";

/** How often to ask the provider whether the transfer landed. */
const POLL_MS = 6_000;

/**
 * The pay screen: a bank account to transfer to, and a poll waiting for it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS IS NOT A REDIRECT CHECKOUT.
 *
 * Xendify mints a dedicated virtual account per order. The customer leaves,
 * opens their own banking app, transfers, and comes back — possibly hours later.
 * So the interface is a set of details to copy, not a payment form, and the
 * whole thing has to survive being closed and reopened. Nothing here holds state
 * the server does not also hold.
 *
 * The poll is a read of PROVIDER truth via the server. The browser is never
 * trusted to report its own payment; clicking nothing at all still settles the
 * order, because the provider's webhook does that independently.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function PayPanel({
  reference,
  total,
  initialStatus,
  paymentMode = "full",
  layawayPaidAmount = 0,
  layawayBalance = null,
  layawayMinimumPayment = null,
  layawayDueAt = null,
}: {
  reference: string;
  total: number;
  initialStatus: string;
  paymentMode?: "full" | "layaway";
  layawayPaidAmount?: number;
  layawayBalance?: number | null;
  layawayMinimumPayment?: number | null;
  layawayDueAt?: string | null;
}) {
  const router = useRouter();
  const [instruction, setInstruction] = useState<PaymentInstruction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(initialStatus);

  // Ask for the account once on mount. Repeated calls are safe — the server
  // returns the same account — but there is no reason to make them.
  useEffect(() => {
    let cancelled = false;

    initializePayment(reference, paymentMode === "layaway" ? layawayMinimumPayment ?? undefined : undefined)
      .then((data) => {
        if (!cancelled) {
          setInstruction(data);
          setStatus(data.status);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "We could not set up your payment just now. Refresh the page, or message us and we will sort it out.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reference, paymentMode, layawayMinimumPayment]);

  const isSettled = status !== "pending_payment";

  /*
   * Poll while waiting.
   *
   * `setInterval` rather than a recursive timeout so a slow response cannot
   * stack calls, and the interval is torn down the moment the order settles —
   * polling a paid order forever is a real cost on a mobile connection.
   */
  useEffect(() => {
    if (isSettled || error) return;

    const id = setInterval(async () => {
      try {
        const result = await verifyPayment(reference);

        if (result.status !== "pending_payment" || (paymentMode === "layaway" && (result.order?.layaway_paid_amount ?? 0) > layawayPaidAmount)) {
          setStatus(result.status);
          // Re-render the server component so the whole page reflects the new
          // status, not just this panel.
          router.refresh();
        }
      } catch {
        // A failed poll is not a failed payment — the money may be fine and the
        // network merely flaky. Stay quiet and try again on the next tick.
      }
    }, POLL_MS);

    return () => clearInterval(id);
  }, [reference, isSettled, error, router, paymentMode, layawayPaidAmount]);

  if (error) {
    return (
      <div className="border-destructive/30 bg-destructive/5 flex items-start gap-3 rounded-xl border p-5">
        <AlertTriangle className="text-destructive mt-0.5 size-5 shrink-0" />
        <p className="text-sm text-pretty">{error}</p>
      </div>
    );
  }

  if (isSettled) {
    return <Settled status={status} />;
  }

  if (!instruction) {
    return (
      <div className="border-border space-y-3 rounded-xl border p-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  // A redirect-style provider would fill this instead of an account number. The
  // panel renders whichever it is given, so swapping providers changes no UI.
  if (instruction.authorization_url) {
    return (
      <div className="border-border rounded-xl border p-6">
        <p className="text-sm text-pretty">
          You will be taken to our payment provider to complete this securely.
        </p>
        <Button asChild size="lg" className="mt-4 w-full">
          <a href={instruction.authorization_url}>Pay {naira(total)}</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {paymentMode === "layaway" && (
        <div className="border-amber-500/30 bg-amber-500/5 rounded-xl border p-5">
          <p className="font-medium">Your reserved-device payment plan</p>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted-foreground">Paid so far</dt><dd className="gg-numeric mt-1 font-semibold">{naira(layawayPaidAmount)}</dd></div><div><dt className="text-muted-foreground">Balance left</dt><dd className="gg-numeric mt-1 font-semibold">{naira(layawayBalance ?? total)}</dd></div></dl>
          {layawayDueAt && <p className="mt-3 text-xs text-muted-foreground">Complete the balance by {new Date(layawayDueAt).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}. We dispatch once the total is paid.</p>}
        </div>
      )}
      <div className="border-border overflow-hidden rounded-xl border">
        <div className="bg-muted/60 flex items-center gap-2 border-b px-5 py-3">
          <Landmark className="text-muted-foreground size-4" />
          <h2 className="text-sm font-semibold">Transfer to this account</h2>
        </div>

        <div className="space-y-4 p-5">
          <CopyRow
            label="Account number"
            value={instruction.account_number ?? ""}
            emphasis
          />
          <Row label="Bank" value={instruction.bank_name ?? "—"} />
          <Row label="Account name" value={instruction.account_name ?? "—"} />
          <CopyRow label="Amount" value={String(instruction.amount ?? total)} display={naira(instruction.amount ?? total)} />

          <p className="text-muted-foreground border-t pt-4 text-xs text-pretty">
            This account belongs to your order alone — transfer the exact amount
            from any bank app. We confirm it automatically, usually within a minute.
          </p>
        </div>
      </div>

      <Waiting />
      {instruction.expires_at && <Countdown expiresAt={instruction.expires_at} />}
      <DevSettle reference={reference} amount={instruction.amount ?? total} onSettled={() => router.refresh()} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

/**
 * A value with a copy button.
 *
 * Account numbers get copied, not retyped — a mistyped digit on a ₦620,000
 * transfer is a support call at best.
 */
function CopyRow({
  label,
  value,
  display,
  emphasis = false,
}: {
  label: string;
  value: string;
  display?: string;
  emphasis?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the pending reset if the component goes away mid-flash.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      timer.current = setTimeout(() => setCopied(false), 2_000);
    } catch {
      // Clipboard denied (insecure context, or the user said no). The value is
      // on screen and selectable, so this is a lost convenience, not a blocker.
    }
  }, [value]);

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "gg-numeric text-right font-semibold",
            emphasis ? "text-xl tracking-wide" : "text-sm",
          )}
        >
          {display ?? value}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${label.toLowerCase()}`}
          className="hover:bg-accent text-muted-foreground grid size-8 shrink-0 place-items-center rounded-md transition-colors"
        >
          {copied ? (
            <Check className="text-condition-new size-4" />
          ) : (
            <Copy className="size-4" />
          )}
        </button>
      </div>
    </div>
  );
}

function Waiting() {
  return (
    <div
      className="border-border flex items-center gap-3 rounded-xl border p-4"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="text-gg-blue size-4 shrink-0 animate-spin" />
      <p className="text-sm text-pretty">
        Waiting for your transfer. You can close this page — we will confirm it
        either way, and your items stay held.
      </p>
    </div>
  );
}

/**
 * How long the account (and the hold on the machines) lasts.
 *
 * Ticks client-side from a server-provided deadline, so a clock skewed on the
 * customer's phone shifts the countdown but never the actual expiry.
 */
function Countdown({ expiresAt }: { expiresAt: string }) {
  const deadline = new Date(expiresAt).getTime();
  const [remaining, setRemaining] = useState(() => deadline - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemaining(deadline - Date.now()), 1_000);

    return () => clearInterval(id);
  }, [deadline]);

  if (!Number.isFinite(deadline)) return null;

  if (remaining <= 0) {
    return (
      <p className="text-muted-foreground text-xs text-pretty">
        This payment window has closed. Refresh the page to get fresh details, or
        message us.
      </p>
    );
  }

  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);

  return (
    <p className="text-muted-foreground gg-numeric text-xs">
      Held for{" "}
      {hours > 0
        ? `${hours}h ${String(minutes).padStart(2, "0")}m`
        : `${minutes}m ${String(seconds).padStart(2, "0")}s`}
    </p>
  );
}

function Settled({ status }: { status: string }) {
  if (status === "failed") {
    return (
      <div className="border-destructive/30 bg-destructive/5 rounded-xl border p-5">
        <p className="font-medium">That transfer did not go through</p>
        <p className="text-muted-foreground mt-1 text-sm text-pretty">
          Nothing has been taken. Your items are still held for a while — refresh
          to try again, or message us and we will help.
        </p>
      </div>
    );
  }

  return (
    <div
      className="border-condition-new/30 bg-condition-new/5 flex items-start gap-3 rounded-xl border p-5"
      role="status"
    >
      <Check className="text-condition-new mt-0.5 size-5 shrink-0" />
      <div>
        <p className="font-medium">Payment received</p>
        <p className="text-muted-foreground mt-1 text-sm text-pretty">
          Thank you. We are preparing your order for dispatch and will be in
          touch with delivery details.
        </p>
      </div>
    </div>
  );
}

/**
 * Development-only controls that stand in for the bank transfer.
 *
 * Renders nothing unless the mock gateway is bound: the backend 404s
 * `mock-settle` the moment a real provider is configured, and that 404 is what
 * hides this. No `NODE_ENV` check, so a misconfigured staging environment cannot
 * show it either.
 */
function DevSettle({
  reference,
  amount,
  onSettled,
}: {
  reference: string;
  amount: number;
  onSettled: () => void;
}) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (outcome: "success" | "failed") => {
      setBusy(true);

      try {
        await mockSettle(reference, outcome, amount);
        setAvailable(true);
        onSettled();
      } catch {
        // A 404 means a real provider is bound — hide these controls for good.
        setAvailable(false);
      } finally {
        setBusy(false);
      }
    },
    [reference, amount, onSettled],
  );

  if (available === false) return null;

  return (
    <div className="border-border mt-2 rounded-xl border border-dashed p-4">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Development only
      </p>
      <p className="text-muted-foreground mt-1 text-xs text-pretty">
        Stands in for the bank transfer. Disappears automatically once a real
        provider is configured.
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run("success")}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Simulate paid
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => run("failed")}>
          Simulate failure
        </Button>
      </div>
    </div>
  );
}
