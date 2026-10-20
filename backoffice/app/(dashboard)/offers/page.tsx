import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Handshake } from "lucide-react";

import { OfferActions } from "@/components/offers/offer-actions";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/server/api";
import { naira, shortDateTime } from "@/lib/format";
import type { OfferItem, Paginated } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Negotiations & Offers · Gadgets Garden" };

const TABS = [
  { value: "actionable", label: "To review" },
  { value: "accepted", label: "Accepted (Awaiting Checkout)" },
  { value: "countered", label: "Countered" },
  { value: "converted", label: "Converted / Sold" },
  { value: "declined", label: "Declined" },
  { value: "", label: "All" },
] as const;

export default async function OffersPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await props.searchParams;
  const status = typeof params.status === "string" ? params.status : "actionable";
  const search = typeof params.search === "string" ? params.search : "";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
          <Handshake className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Negotiations Desk</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Review customer bargain offers, send counter-offers, and trigger WhatsApp checkout links.
          </p>
        </div>
      </div>

      <Suspense fallback={<Skeleton className="mt-8 h-96" />}>
        <OfferQueue status={status} search={search} />
      </Suspense>
    </div>
  );
}

async function OfferQueue({ status, search }: { status: string; search: string }) {
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (search) query.set("search", search);

  const qs = query.toString();
  const path = qs ? `/offers?${qs}` : "/offers";

  const { data, meta } = await api<Paginated<OfferItem>>(path);

  return (
    <>
      <nav className="mt-6 flex flex-wrap gap-1 border-b">
        {TABS.map((tab) => {
          const active = status === tab.value;
          const count = meta?.counts?.[tab.value as keyof typeof meta.counts];

          return (
            <Link
              key={tab.value}
              href={tab.value ? `/offers?status=${tab.value}` : "/offers?status="}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative -mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {typeof count === "number" && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground font-mono">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {data.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center text-sm">
          No offers in this view.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                <th className="py-2.5 px-4 font-medium">Offer Ref</th>
                <th className="py-2.5 px-4 font-medium">Customer</th>
                <th className="py-2.5 px-4 font-medium">Product / Unit</th>
                <th className="py-2.5 px-4 font-medium text-right">List Price</th>
                <th className="py-2.5 px-4 font-medium text-right">Offered Price</th>
                <th className="py-2.5 px-4 font-medium text-center">Status</th>
                <th className="py-2.5 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((offer) => {
                const discount = Math.round(
                  ((offer.original_price - offer.offered_price) / offer.original_price) * 100,
                );

                return (
                  <tr key={offer.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs font-semibold">{offer.reference}</span>
                      <span className="block text-xs text-muted-foreground">
                        {shortDateTime(offer.created_at)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium">{offer.customer_name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{offer.customer_phone}</div>
                      {offer.customer_note && (
                        <p className="mt-1 text-xs italic text-muted-foreground line-clamp-1">
                          &ldquo;{offer.customer_note}&rdquo;
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-foreground">{offer.product?.name ?? "—"}</div>
                      {offer.unit?.sku && (
                        <div className="font-mono text-xs text-muted-foreground">SKU: {offer.unit.sku}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                      {naira(offer.original_price)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold">
                      <div>{naira(offer.offered_price)}</div>
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-normal">
                        -{discount}% off
                      </div>
                      {offer.counter_price && (
                        <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                          Countered: {naira(offer.counter_price)}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                          offer.status === "accepted" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
                          offer.status === "pending" && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                          offer.status === "countered" && "bg-blue-500/15 text-blue-700 dark:text-blue-400",
                          offer.status === "declined" && "bg-destructive/15 text-destructive",
                          offer.status === "converted" && "bg-purple-500/15 text-purple-700 dark:text-purple-400",
                        )}
                      >
                        {offer.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <OfferActions offer={offer} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
