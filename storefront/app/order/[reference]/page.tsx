import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, MessageCircle, Package, ShieldCheck, Tag } from "lucide-react";

import { OrderStatusTimeline } from "@/components/shop/order-status-timeline";
import { PayPanel } from "@/components/shop/pay-panel";
import { Button } from "@/components/ui/button";
import { BUSINESS } from "@/lib/business";
import { getOrder } from "@/lib/api";
import { naira } from "@/lib/format";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ reference: string }> };

/**
 * The order confirmation and status page.
 *
 * Reachable by anyone holding the reference — which is the point: there are no
 * customer accounts, so the reference IS the credential. It is random enough not
 * to be guessable, and the resource behind it carries only what the buyer
 * already knows.
 *
 * The payment instructions themselves land in phase 5, with the Xendify
 * gateway. Until then this confirms the order exists and that the machines are
 * being held.
 */
export default async function OrderPage({ params }: Props) {
  const { reference } = await params;
  const order = await getOrder(reference);

  if (!order) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <CheckCircle2 className="text-condition-new mx-auto size-10" />
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Order placed
        </h1>
        <p className="text-muted-foreground mt-2 text-pretty">
          Your reference is{" "}
          <strong className="text-foreground gg-numeric">
            {order.reference}
          </strong>
          . Keep it — it is how we find your order.
        </p>
      </div>

      {order.status === "pending_payment" && order.reserved_until && (
        <div className="border-border mt-8 flex items-start gap-3 rounded-xl border p-5">
          <Clock className="text-gg-blue mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-medium">Your items are being held</p>
            <p className="text-muted-foreground mt-1 text-sm text-pretty">
              We have taken them off the shelf for you — nobody else can buy them
              while you pay.
            </p>
          </div>
        </div>
      )}

      {/*
        The pay screen. Rendered for any order that is not yet settled, including
        a failed one — a failed transfer is usually retried, and the machines are
        still held.
      */}
      <div className="mt-6">
        <PayPanel
          reference={order.reference}
          total={order.total}
          initialStatus={order.status}
          paymentMode={order.payment_mode}
          layawayPaidAmount={order.layaway_paid_amount}
          layawayBalance={order.layaway_balance}
          layawayMinimumPayment={order.layaway_minimum_payment}
          layawayDueAt={order.layaway_due_at}
        />
      </div>

      <div className="mt-6">
        <OrderStatusTimeline
          status={order.status}
          reference={order.reference}
          deliveryZone={order.address?.zone ?? undefined}
          isPaid={Boolean(order.paid_at)}
        />
      </div>

      <div className="border-border mt-6 rounded-xl border p-5">
        <div className="flex items-center gap-2">
          <Package className="text-muted-foreground size-4" />
          <h2 className="text-sm font-semibold">{order.status_label}</h2>
        </div>

        <ul className="mt-4 space-y-2 text-sm">
          {order.items?.map((item) => (
            <li
              key={`${item.name}-${item.sku ?? ""}`}
              className="flex justify-between gap-4"
            >
              <span className="min-w-0">
                {item.name}
                {item.quantity > 1 && ` × ${item.quantity}`}
                {item.sku && (
                  <span className="text-muted-foreground gg-numeric block text-xs">
                    {item.sku}
                  </span>
                )}
              </span>
              <span className="gg-numeric shrink-0">
                {naira(item.line_total)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="border-border mt-4 space-y-2 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="gg-numeric">{naira(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Delivery</dt>
            <dd className="gg-numeric">
              {order.delivery_fee === 0 ? "Free" : naira(order.delivery_fee)}
            </dd>
          </div>
          {order.discount_amount && order.discount_amount > 0 ? (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
              <dt className="flex items-center gap-1.5">
                <Tag className="size-3.5" />
                Discount ({order.coupon_code})
              </dt>
              <dd className="gg-numeric">−{naira(order.discount_amount)}</dd>
            </div>
          ) : null}
        </dl>

        <div className="border-border mt-4 flex justify-between border-t pt-4">
          <span className="font-semibold">Total</span>
          <span className="gg-numeric text-lg font-semibold">
            {naira(order.total)}
          </span>
        </div>

        {order.address && (
          <p className="text-muted-foreground mt-5 text-sm text-pretty">
            Delivering to {order.address.line1}
            {order.address.landmark && `, ${order.address.landmark}`},{" "}
            {order.address.city}, {order.address.state}.
          </p>
        )}
      </div>

      {/* Warranty & Post-Purchase Security */}
      <div className="border-border mt-6 rounded-xl border bg-muted/20 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="text-emerald-600 dark:text-emerald-400 size-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">90-Day Direct Hardware Warranty</h3>
              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                Active
              </span>
            </div>
            <p className="text-muted-foreground mt-1 text-xs text-pretty">
              Every unit undergoes hardware testing before dispatch from Computer Village, Ikeja. Create a free customer account to save your digital warranty certificate and track future purchases.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="secondary" className="text-xs">
                <Link href="/account">Save order to customer account</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild variant="outline">
          <a
            href={`https://wa.me/2348000000000?text=Hello%20Gadgets%20Garden,%20I%20have%20an%20inquiry%20regarding%20order%20${order.reference}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle className="size-4 mr-1.5" />
            WhatsApp support ({order.reference})
          </a>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/shop">Keep browsing</Link>
        </Button>
      </div>
    </div>
  );
}
