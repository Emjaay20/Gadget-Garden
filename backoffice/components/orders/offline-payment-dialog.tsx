"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Banknote, CheckCircle, Loader2 } from "lucide-react";
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
import { naira } from "@/lib/format";

export function OfflinePaymentDialog({
  reference,
  orderTotal,
  orderStatus,
}: {
  reference: string;
  orderTotal: number;
  orderStatus: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [method, setMethod] = useState<"bank_transfer" | "pos_terminal" | "cash">("bank_transfer");
  const [amountPaid, setAmountPaid] = useState<string>(orderTotal.toString());
  const [transactionRef, setTransactionRef] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [note, setNote] = useState("");

  const canSettle = orderStatus === "pending_payment" || orderStatus === "failed";

  if (!canSettle) {
    return null;
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();

    if (!transactionRef.trim()) {
      toast.error("Transaction Reference / Session ID is required.");
      return;
    }

    const amount = parseInt(amountPaid, 10);
    if (isNaN(amount) || amount < orderTotal) {
      toast.error(`Amount must at least equal the order total (${naira(orderTotal)}).`);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/admin/api/orders/${reference}/verify-offline-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          transaction_reference: transactionRef.trim(),
          amount_paid: amount,
          bank_name: bankName.trim() || undefined,
          account_name: accountName.trim() || undefined,
          note: note.trim() || undefined,
        }),
      });

      const body = await response.json();

      if (!response.ok) {
        toast.error(body.errors?.amount_paid?.[0] ?? body.message ?? "Payment verification failed.");
        setSubmitting(false);
        return;
      }

      toast.success("Payment verified! Order marked Paid.");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Network error while verifying payment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" variant="default">
          <Banknote className="mr-2 size-4" />
          Verify Offline Payment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleVerify}>
          <DialogHeader>
            <DialogTitle>Reconcile Offline Payment</DialogTitle>
            <DialogDescription>
              Verify an offline bank transfer, cash, or POS terminal payment for order{" "}
              <span className="font-mono font-semibold text-foreground">{reference}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="method">Payment Method</Label>
              <select
                id="method"
                value={method}
                onChange={(e) => setMethod(e.target.value as "bank_transfer" | "pos_terminal" | "cash")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="bank_transfer">Direct Bank Transfer</option>
                <option value="pos_terminal">Counter POS Terminal</option>
                <option value="cash">Cash Walk-In</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount Received (₦)</Label>
              <Input
                id="amount"
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">Order total: {naira(orderTotal)}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ref">Session ID / Transaction Ref / Slip No.</Label>
              <Input
                id="ref"
                placeholder="e.g. STANBIC-12345678 or POS RRN"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                required
              />
            </div>

            {method === "bank_transfer" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bank">Sender Bank</Label>
                  <Input
                    id="bank"
                    placeholder="e.g. GTBank"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sender">Sender Account Name</Label>
                  <Input
                    id="sender"
                    placeholder="e.g. John Doe"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="note">Internal Reconciliation Note</Label>
              <Textarea
                id="note"
                placeholder="Confirmed on manager Stanbic app / verified by cashier."
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
            <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CheckCircle className="mr-2 size-4" />}
              Confirm Settlement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
