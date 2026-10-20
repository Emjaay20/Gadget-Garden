import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { FulfilmentActions } from "@/components/orders/fulfilment-actions";
import { OfflinePaymentDialog } from "@/components/orders/offline-payment-dialog";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { api, ApiError } from "@/lib/server/api";
import { margin, naira, shortDateTime, specSummary } from "@/lib/format";
import type { StaffOrder } from "@/lib/types";

export const metadata: Metadata = { title: "Order · Gadgets Garden" };

type Props = { params: Promise<{ reference: string }> };

export default async function OrderPage({ params }: Props) {
  const { reference } = await params;

  let order: StaffOrder;

  try {
    const response = await api<{ data: StaffOrder }>(`/orders/${reference}`);
    order = response.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  // `cost` is null unless the viewer holds `reports.view`, so margin appears
  // only for those permitted — decided by the API, not by this component.
  const canSeeMargin = order.items?.some((item) => item.cost !== null) ?? false;
  const totalCost = order.items?.reduce((sum, i) => sum + (i.cost ?? 0), 0) ?? 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href="/orders"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" />
        Orders
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="gg-numeric text-2xl font-semibold tracking-tight">
            {order.reference}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Placed {shortDateTime(order.placed_at)}
            {order.paid_at && ` · Paid ${shortDateTime(order.paid_at)}`}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <section>
            <h2 className="text-xs font-semibold tracking-[0.14em] uppercase">
              Items
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {order.items?.map((item) => {
                    const m = margin(item.unit_price, item.cost);

                    return (
                      <tr key={item.id} className="border-b">
                        <td className="py-3 pr-4">
                          <div className="font-medium">{item.name}</div>
                          {item.sku && (
                            <div className="text-muted-foreground gg-numeric text-xs">
                              {/* The SKU is what staff pick off the shelf. */}
                              {item.sku}
                            </div>
                          )}
                          {specSummary(item.specs) && (
                            <div className="text-muted-foreground text-xs">
                              {specSummary(item.specs)}
                            </div>
                          )}
                        </td>
                        <td className="text-muted-foreground py-3 pr-4 text-center">
                          ×{item.quantity}
                        </td>
                        <td className="gg-numeric py-3 text-right font-medium">
                          {naira(item.line_total)}
                          {m && (
                            <div className="text-muted-foreground text-xs font-normal">
                              +{naira(m.profit)} ({m.percent}%)
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <dl className="mt-4 space-y-1.5 text-sm">
              <Row label="Subtotal" value={naira(order.subtotal)} />
              <Row
                label="Delivery"
                value={order.delivery_fee === 0 ? "Free" : naira(order.delivery_fee)}
              />
              <div className="flex justify-between border-t pt-2 font-semibold">
                <dt>Total</dt>
                <dd className="gg-numeric">{naira(order.total)}</dd>
              </div>
              {canSeeMargin && totalCost > 0 && (
                <div className="text-muted-foreground flex justify-between pt-1 text-xs">
                  <dt>Margin</dt>
                  <dd className="gg-numeric">
                    {naira(order.subtotal - totalCost)}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {order.staff_note && (
            <section>
              <h2 className="text-xs font-semibold tracking-[0.14em] uppercase">
                Notes
              </h2>
              <pre className="text-muted-foreground bg-muted mt-3 rounded-lg p-4 text-xs whitespace-pre-wrap">
                {order.staff_note}
              </pre>
            </section>
          )}

          {order.payments && order.payments.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold tracking-[0.14em] uppercase">
                Payments
              </h2>
              <div className="mt-3 space-y-2">
                {order.payments.map((payment, index) => (
                  <div
                    key={index}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                  >
                    <div>
                      <span className="font-medium capitalize">
                        {payment.provider}
                      </span>
                      <span className="text-muted-foreground"> · {payment.status}</span>
                      {payment.account_number && (
                        <div className="text-muted-foreground gg-numeric text-xs">
                          Account {payment.account_number}
                        </div>
                      )}
                    </div>
                    <span className="gg-numeric font-medium">
                      {naira(payment.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <OfflinePaymentDialog
            reference={order.reference}
            orderTotal={order.total}
            orderStatus={order.status}
          />

          <FulfilmentActions
            reference={order.reference}
            nextStatuses={order.next_statuses}
          />

          <section className="rounded-xl border p-4">
            <h2 className="text-xs font-semibold tracking-[0.14em] uppercase">
              Customer
            </h2>
            <div className="mt-3 space-y-1 text-sm">
              <p className="font-medium">{order.contact_name}</p>
              <p className="text-muted-foreground">{order.contact_email}</p>
              <p className="text-muted-foreground gg-numeric">
                {order.contact_phone}
              </p>
            </div>
          </section>

          {order.address && (
            <section className="rounded-xl border p-4">
              <h2 className="text-xs font-semibold tracking-[0.14em] uppercase">
                Deliver to
              </h2>
              <address className="text-muted-foreground mt-3 text-sm not-italic">
                {order.address.line1}
                <br />
                {order.address.landmark && (
                  <>
                    {order.address.landmark}
                    <br />
                  </>
                )}
                {order.address.city}, {order.address.state}
                {order.address.zone && (
                  <>
                    <br />
                    <span className="text-xs">Zone: {order.address.zone}</span>
                  </>
                )}
              </address>
              {order.address.note && (
                <p className="mt-2 text-xs">{order.address.note}</p>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="gg-numeric">{value}</dd>
    </div>
  );
}
