"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Handshake, Loader2, MessageSquare, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { naira } from "@/lib/format";
import type { OfferItem } from "@/lib/types";

export function OfferActions({ offer }: { offer: OfferItem }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // Dialog states
  const [counterOpen, setCounterOpen] = useState(false);
  const [counterPrice, setCounterPrice] = useState<string>(
    Math.round((offer.original_price + offer.offered_price) / 2).toString(),
  );
  const [counterNote, setCounterNote] = useState("");

  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineNote, setDeclineNote] = useState("");

  async function handleAccept() {
    setBusy(true);

    try {
      const res = await fetch(`/admin/api/offers/${offer.reference}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_note: "Accepted by sales desk" }),
      });

      const body = await res.json();
      if (!res.ok) {
        toast.error(body.errors?.status?.[0] ?? body.message ?? "Could not accept offer.");
        setBusy(false);
        return;
      }

      toast.success(`Offer ${offer.reference} accepted! 2-hour checkout lock is active.`);
      router.refresh();
    } catch {
      toast.error("Network error while accepting offer.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCounterSubmit(e: React.FormEvent) {
    e.preventDefault();
    const price = parseInt(counterPrice, 10);

    if (isNaN(price) || price <= offer.offered_price) {
      toast.error(`Counter price must be greater than offered ₦${offer.offered_price.toLocaleString()}`);
      return;
    }

    setBusy(true);

    try {
      const res = await fetch(`/admin/api/offers/${offer.reference}/counter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          counter_price: price,
          staff_note: counterNote.trim() || undefined,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        toast.error(body.errors?.counter_price?.[0] ?? body.message ?? "Could not send counter-offer.");
        setBusy(false);
        return;
      }

      toast.success(`Counter-offer of ${naira(price)} recorded!`);
      setCounterOpen(false);
      router.refresh();
    } catch {
      toast.error("Network error while submitting counter-offer.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeclineSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    try {
      const res = await fetch(`/admin/api/offers/${offer.reference}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_note: declineNote.trim() || undefined }),
      });

      const body = await res.json();
      if (!res.ok) {
        toast.error(body.message ?? "Could not decline offer.");
        setBusy(false);
        return;
      }

      toast.info(`Offer ${offer.reference} declined.`);
      setDeclineOpen(false);
      router.refresh();
    } catch {
      toast.error("Network error while declining offer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      {offer.is_actionable ? (
        <>
          <Button
            size="sm"
            variant="default"
            disabled={busy}
            onClick={handleAccept}
            className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-2.5"
            title="Accept Customer Offer"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            Accept
          </Button>

          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => setCounterOpen(true)}
            className="h-8 gap-1 text-xs px-2.5"
            title="Send Counter-Offer"
          >
            <Handshake className="size-3.5" />
            Counter
          </Button>

          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => setDeclineOpen(true)}
            className="h-8 text-xs text-destructive hover:text-destructive px-2"
            title="Decline Offer"
          >
            <X className="size-3.5" />
          </Button>
        </>
      ) : (
        <span className="text-xs text-muted-foreground italic font-mono">
          {offer.status === "converted" ? "Sold / Converted" : "Closed"}
        </span>
      )}

      {offer.whatsapp_url && (
        <a
          href={offer.whatsapp_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 items-center gap-1 rounded-md bg-[#25D366] px-2.5 text-xs font-medium text-white hover:bg-[#20bd5a] transition-colors"
          title="Send message to customer on WhatsApp"
        >
          <MessageSquare className="size-3.5" />
          WhatsApp
        </a>
      )}

      {/* Counter Offer Modal */}
      <Dialog open={counterOpen} onOpenChange={setCounterOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCounterSubmit}>
            <DialogHeader>
              <DialogTitle>Send Counter-Offer</DialogTitle>
              <DialogDescription>
                Original: <span className="font-semibold text-foreground">{naira(offer.original_price)}</span> ·
                Customer Offered: <span className="font-semibold text-foreground">{naira(offer.offered_price)}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="counter-amt">Counter Price (₦)</Label>
                <Input
                  id="counter-amt"
                  type="number"
                  value={counterPrice}
                  onChange={(e) => setCounterPrice(e.target.value)}
                  required
                />
              </div>

              <div className="flex gap-2">
                {[0.9, 0.95].map((pct) => {
                  const target = Math.round(offer.original_price * pct);
                  return (
                    <Button
                      key={pct}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setCounterPrice(target.toString())}
                    >
                      {pct * 100}% ({naira(target)})
                    </Button>
                  );
                })}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="c-note">Note / Sweetener to Customer</Label>
                <Textarea
                  id="c-note"
                  placeholder="e.g. We can do ₦750k with free laptop bag and mouse included."
                  rows={2}
                  value={counterNote}
                  onChange={(e) => setCounterNote(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCounterOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                Send Counter-Offer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Decline Modal */}
      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleDeclineSubmit}>
            <DialogHeader>
              <DialogTitle>Decline Offer</DialogTitle>
              <DialogDescription>
                Are you sure you want to decline offer {offer.reference} for {naira(offer.offered_price)}?
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <Label htmlFor="d-note">Reason / Internal Note</Label>
              <Textarea
                id="d-note"
                placeholder="e.g. Offer is below cost margin."
                rows={2}
                value={declineNote}
                onChange={(e) => setDeclineNote(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeclineOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={busy}>
                Confirm Decline
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
