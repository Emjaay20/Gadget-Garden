import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ManualOrderDialog } from "@/components/orders/manual-order-dialog";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/server/api";
import { naira, shortDateTime } from "@/lib/format";
import type { Paginated, StaffOrder } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders · Gadgets Garden" };

const TABS = [
  { value: "open", label: "To fulfil" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "pending_payment", label: "Awaiting payment" },
  { value: "", label: "All" },
] as const;

export default async function OrdersPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // `searchParams` is a Promise in Next 16 — synchronous access was removed.
  const params = await props.searchParams;
  const status = typeof params.status === "string" ? params.status : "open";
  const search = typeof params.search === "string" ? params.search : "";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Live queue of customer orders, in-store sales, and fulfillment.
          </p>
        </div>
        <ManualOrderDialog />
      </div>

      <Suspense fallback={<Skeleton className="mt-8 h-96" />}>
        <OrderQueue status={status} search={search} />
      </Suspense>
    </div>
  );
}

async function OrderQueue({
  status,
  search,
}: {
  status: string;
  search: string;
}) {
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (search) query.set("search", search);

  const { data, meta } = await api<Paginated<StaffOrder>>(
    `/orders${query.toString() ? `?${query}` : ""}`,
  );

  return (
    <>
      <nav className="mt-6 flex flex-wrap gap-1 border-b">
        {TABS.map((tab) => {
          const active = status === tab.value;
          const count = tab.value ? meta.counts?.[tab.value] : undefined;

          return (
            <Link
              key={tab.value || "all"}
              href={tab.value ? `/orders?status=${tab.value}` : "/orders?status="}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
                active
                  ? "border-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {tab.label}
              {count !== undefined && count > 0 && (
                <span className="text-muted-foreground gg-numeric ml-1.5 text-xs">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {data.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center text-sm">
          Nothing here.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left">
                <th className="py-2 pr-4 font-medium">Reference</th>
                <th className="py-2 pr-4 font-medium">Customer</th>
                <th className="py-2 pr-4 font-medium">Items</th>
                <th className="py-2 pr-4 font-medium">Placed</th>
                <th className="py-2 pr-4 text-right font-medium">Total</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((order) => (
                <tr key={order.id} className="hover:bg-accent/40 border-b">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/orders/${order.reference}`}
                      className="gg-numeric font-medium hover:underline"
                    >
                      {order.reference}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">
                    <div>{order.contact_name}</div>
                    <div className="text-muted-foreground text-xs">
                      {order.contact_phone}
                    </div>
                  </td>
                  <td className="text-muted-foreground py-3 pr-4">
                    {order.items?.length ?? 0}
                  </td>
                  <td className="text-muted-foreground py-3 pr-4 whitespace-nowrap">
                    {shortDateTime(order.placed_at)}
                  </td>
                  <td className="gg-numeric py-3 pr-4 text-right font-medium">
                    {naira(order.total)}
                  </td>
                  <td className="py-3">
                    <OrderStatusBadge status={order.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
