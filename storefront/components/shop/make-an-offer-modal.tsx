"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Handshake, Info, Loader2, MessageSquare, ShoppingCart, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { naira } from "@/lib/format";

type Props = {
  productId: string | number;
  productName: string;
  originalPrice: number;
  unitId?: string | number | null;
  unitSku?: string | null;
};

export function MakeAnOfferModal({
  productId,
  productName,
  originalPrice,
  unitId,
  unitSku,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const defaultOffer = Math.round(originalPrice * 0.95);
  const [offeredPrice, setOfferedPrice] = useState<string>(defaultOffer.toString());
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  // Result state
  const [result, setResult] = useState<{
    status: "accepted" | "pending" | "declined";
    reference: string;
    message: string;
    checkoutUrl?: string | null;
  } | null>(null);

  function resetForm() {
    setOfferedPrice(defaultOffer.toString());
    setName("");
    setPhone("");
    setEmail("");
    setNote("");
    setResult(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const price = parseInt(offeredPrice, 10);
    if (isNaN(price) || price < 10000) {
      toast.error("Please enter a valid offer amount.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: Number(productId),
          product_unit_id: unitId ? Number(unitId) : undefined,
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          customer_email: email.trim() || `${phone.replace(/[^0-9]/g, "") || "buyer"}@customer.gadgetsgarden.ng`,
          offered_price: price,
          customer_note: note.trim() || undefined,
        }),
      });

      const body = await res.json();

      if (!res.ok) {
        toast.error(body.errors?.offered_price?.[0] ?? body.message ?? "Could not submit offer.");
        setSubmitting(false);
        return;
      }

      setResult({
        status: body.data.status,
        reference: body.data.reference,
        message: body.message,
        checkoutUrl: body.data.checkout_url,
      });

      if (body.data.status === "accepted") {
        toast.success("Offer Accepted!");
      } else if (body.data.status === "pending") {
        toast.info("Offer received. Routed to sales desk.");
      }
    } catch {
      toast.error("Network error while submitting offer.");
    } finally {
      setSubmitting(false);
    }
  }

  const currentOfferedNum = parseInt(offeredPrice, 10) || 0;
  const discountPct = originalPrice > 0
    ? Math.round(((originalPrice - currentOfferedNum) / originalPrice) * 100)
    : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2 rounded-full py-6 font-medium text-foreground hover:bg-secondary transition-all"
        >
          <Handshake className="size-4" />
          <span>Make an Offer (Bargain Price)</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        {result ? (
          <div className="space-y-4 py-2">
            <DialogHeader>
              <div
                className={`mx-auto flex size-12 items-center justify-center rounded-full ${
                  result.status === "accepted"
                    ? "bg-emerald-500/10 text-emerald-600"
                    : result.status === "declined"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-amber-500/10 text-amber-600"
                }`}
              >
                {result.status === "accepted" ? (
                  <CheckCircle2 className="size-6" />
                ) : result.status === "declined" ? (
                  <Info className="size-6" />
                ) : (
                  <MessageSquare className="size-6" />
                )}
              </div>
              <DialogTitle className="text-center">
                {result.status === "accepted"
                  ? "Offer Approved!"
                  : result.status === "declined"
                    ? "Offer Declined"
                    : "Offer Under Review"}
              </DialogTitle>
              <DialogDescription className="text-center text-balance">
                {result.message}
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border bg-muted/40 p-3 text-center space-y-1">
              <p className="text-xs text-muted-foreground font-mono">Reference: {result.reference}</p>
              <p className="text-sm font-semibold">{productName}</p>
              {unitSku && <p className="text-xs text-muted-foreground">Unit: {unitSku}</p>}
            </div>

            <DialogFooter className="pt-2 sm:justify-center">
              {result.status === "accepted" && result.checkoutUrl ? (
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => {
                    setOpen(false);
                    router.push(result.checkoutUrl!);
                  }}
                >
                  <ShoppingCart className="mr-2 size-4" />
                  Claim Deal & Checkout Now
                </Button>
              ) : (
                <Button variant="outline" className="w-full" onClick={() => setOpen(false)}>
                  Close
                </Button>
              )}
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="size-4" />
                <span className="text-xs font-semibold tracking-wider uppercase">Direct Negotiation</span>
              </div>
              <DialogTitle className="text-lg">Make an Offer</DialogTitle>
              <DialogDescription>
                Bargain directly on this machine. Offers within our dealer margin are accepted instantly!
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-muted-foreground">List Price</span>
                  <span className="font-mono text-sm line-through text-muted-foreground">
                    {naira(originalPrice)}
                  </span>
                </div>
                <div className="flex justify-between items-baseline mt-1 font-semibold">
                  <span className="text-sm">Your Bargain Offer</span>
                  <span className="font-mono text-base text-primary">
                    {naira(currentOfferedNum)} {discountPct > 0 && `(-${discountPct}%)`}
                  </span>
                </div>
              </div>

              {/* Quick discount buttons */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Quick Suggestion</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[0.05, 0.1, 0.15].map((pct) => {
                    const price = Math.round(originalPrice * (1 - pct));
                    return (
                      <Button
                        key={pct}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs font-mono"
                        onClick={() => setOfferedPrice(price.toString())}
                      >
                        -{pct * 100}% ({naira(price)})
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="offered-amt">Offer Amount (₦)</Label>
                <Input
                  id="offered-amt"
                  type="number"
                  value={offeredPrice}
                  onChange={(e) => setOfferedPrice(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="c-name">Full Name</Label>
                  <Input
                    id="c-name"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-phone">WhatsApp / Phone</Label>
                  <Input
                    id="c-phone"
                    placeholder="080..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="c-email">Email (Optional)</Label>
                <Input
                  id="c-email"
                  type="email"
                  placeholder="receipt@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="c-note">Note / Request (Optional)</Label>
                <Input
                  id="c-note"
                  placeholder="e.g. Ready to pay immediately if accepted"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                Submit Bargain Offer
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
