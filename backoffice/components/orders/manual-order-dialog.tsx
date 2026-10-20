"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, ExternalLink, Loader2, MessageSquare, Plus, ShoppingBag } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";

export function ManualOrderDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [sku, setSku] = useState("");
  const [deliveryType, setDeliveryType] = useState<"pickup" | "delivery">("pickup");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("Ikeja");
  const [state, setState] = useState("Lagos");
  const [note, setNote] = useState("");
  const [immediatePayment, setImmediatePayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"bank_transfer" | "pos_terminal" | "cash">("pos_terminal");
  const [txRef, setTxRef] = useState("");

  // Result state
  const [createdOrder, setCreatedOrder] = useState<{
    reference: string;
    total: number;
    payUrl: string;
    whatsappUrl: string;
  } | null>(null);

  function resetForm() {
    setName("");
    setPhone("");
    setEmail("");
    setSku("");
    setDeliveryType("pickup");
    setLine1("");
    setCity("Ikeja");
    setState("Lagos");
    setNote("");
    setImmediatePayment(false);
    setPaymentMethod("pos_terminal");
    setTxRef("");
    setCreatedOrder(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!sku.trim()) {
      toast.error("Please enter a laptop unit SKU.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/admin/api/orders/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_name: name.trim(),
          contact_email: email.trim() || `${phone.trim().replace(/[^0-9]/g, "") || "customer"}@gadgetsgarden.test`,
          contact_phone: phone.trim(),
          delivery_type: deliveryType,
          line1: deliveryType === "delivery" ? line1.trim() : undefined,
          city: deliveryType === "delivery" ? city.trim() : undefined,
          state: deliveryType === "delivery" ? state.trim() : undefined,
          items: [{ sku: sku.trim() }],
          staff_note: note.trim() || undefined,
          immediate_payment: immediatePayment,
          payment_method: immediatePayment ? paymentMethod : undefined,
          transaction_reference: immediatePayment ? txRef.trim() : undefined,
        }),
      });

      const body = await response.json();

      if (!response.ok) {
        toast.error(body.errors?.items?.[0] ?? body.message ?? "Could not create manual order.");
        setSubmitting(false);
        return;
      }

      setCreatedOrder({
        reference: body.data.reference,
        total: body.data.total,
        payUrl: body.pay_url,
        whatsappUrl: body.whatsapp_url,
      });

      toast.success(`Order ${body.data.reference} created successfully!`);
      router.refresh();
    } catch {
      toast.error("Network error while creating manual order.");
    } finally {
      setSubmitting(false);
    }
  }

  function copyPayUrl() {
    if (createdOrder?.payUrl) {
      navigator.clipboard.writeText(createdOrder.payUrl);
      toast.success("Payment link copied to clipboard!");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-4" />
          <span>New Walk-in / WhatsApp Order</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {createdOrder ? (
          <div className="space-y-4 py-2">
            <DialogHeader>
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                <ShoppingBag className="size-6" />
              </div>
              <DialogTitle className="text-center">Order Created: {createdOrder.reference}</DialogTitle>
              <DialogDescription className="text-center">
                Total: ₦{createdOrder.total.toLocaleString()} · Unit has been reserved.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              <div className="rounded-lg border bg-muted/40 p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Checkout / Payment Link</p>
                <div className="flex items-center gap-2">
                  <Input value={createdOrder.payUrl} readOnly className="text-xs font-mono" />
                  <Button size="icon" variant="outline" onClick={copyPayUrl} title="Copy link">
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <a
                  href={createdOrder.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-[#25D366] px-4 py-2 text-sm font-semibold text-white hover:bg-[#20bd5a] transition-colors"
                >
                  <MessageSquare className="size-4" />
                  Send Payment Link via WhatsApp
                </a>

                <Button variant="outline" asChild>
                  <a href={`/orders/${createdOrder.reference}`}>
                    <ExternalLink className="mr-2 size-4" />
                    Open Order Details
                  </a>
                </Button>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Create Walk-In / WhatsApp Order</DialogTitle>
              <DialogDescription>
                Quickly book a laptop unit for a walk-in or WhatsApp customer and generate payment links.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-4 max-h-[70vh] overflow-y-auto px-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="c-name">Customer Name</Label>
                  <Input
                    id="c-name"
                    placeholder="e.g. Babatunde Lawal"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-phone">Phone / WhatsApp</Label>
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
                <Label htmlFor="c-email">Customer Email (Optional)</Label>
                <Input
                  id="c-email"
                  type="email"
                  placeholder="customer@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sku">Laptop Unit SKU</Label>
                <Input
                  id="sku"
                  placeholder="e.g. GG-EB840-001 or scan barcode"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">The specific unit identifier from Computer Village shelf.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="del-type">Fulfillment Type</Label>
                <select
                  id="del-type"
                  value={deliveryType}
                  onChange={(e) => setDeliveryType(e.target.value as "pickup" | "delivery")}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="pickup">In-Store Pickup (12 Oshitelu St, Computer Village)</option>
                  <option value="delivery">Dispatch / Waybill Delivery</option>
                </select>
              </div>

              {deliveryType === "delivery" && (
                <div className="space-y-2 border-l-2 pl-3 border-primary/40">
                  <div className="space-y-1">
                    <Label htmlFor="addr">Delivery Address</Label>
                    <Input
                      id="addr"
                      placeholder="Street address"
                      value={line1}
                      onChange={(e) => setLine1(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="City"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                    />
                    <Input
                      placeholder="State"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="rounded-lg border p-3 space-y-2.5 bg-muted/20">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="paid-now"
                    checked={immediatePayment}
                    onChange={(e) => setImmediatePayment(e.target.checked)}
                    className="size-4 rounded border-gray-300 text-primary"
                  />
                  <Label htmlFor="paid-now" className="cursor-pointer font-medium">
                    Customer is paying immediately (In-Store POS / Cash / Transfer)
                  </Label>
                </div>

                {immediatePayment && (
                  <div className="space-y-2 pt-2">
                    <div className="space-y-1">
                      <Label htmlFor="im-method">Payment Method</Label>
                      <select
                        id="im-method"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as "bank_transfer" | "pos_terminal" | "cash")}
                        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      >
                        <option value="pos_terminal">Counter POS Terminal</option>
                        <option value="bank_transfer">Direct Bank Transfer</option>
                        <option value="cash">Cash Received</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="im-ref">Transaction Reference / Slip RRN</Label>
                      <Input
                        id="im-ref"
                        placeholder="POS slip RRN or Session ID"
                        value={txRef}
                        onChange={(e) => setTxRef(e.target.value)}
                        required={immediatePayment}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="s-note">Staff Note</Label>
                <Textarea
                  id="s-note"
                  placeholder="e.g. Walk-in customer tested screen and battery on counter."
                  rows={2}
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
                Create & Reserve Order
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
