import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/server/api";
import { shortDateTime } from "@/lib/format";
import type { Paginated, StockMovement } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Stock ledger · Gadgets Garden" };

const REASON_LABEL: Record<StockMovement["reason"], string> = {
  restock: "Restock",
  sale: "Sale",
  return: "Return",
  damage: "Damage",
  correction: "Correction",
};

export default function LedgerPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Stock ledger</h1>
      <p className="text-muted-foreground mt-1 text-sm text-pretty">
        Every change to quantity stock, newest first. Append-only — a correction
        is a new entry, never an edit.
      </p>

      <Suspense fallback={<Skeleton className="mt-8 h-96" />}>
        <Ledger />
      </Suspense>
    </div>
  );
}

async function Ledger() {
  const { data } = await api<Paginated<StockMovement>>("/inventory/movements");

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground py-16 text-center text-sm">
        Nothing recorded yet.
      </p>
    );
  }

  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground border-b text-left">
            <th className="py-2 pr-4 font-medium">When</th>
            <th className="py-2 pr-4 font-medium">Product</th>
            <th className="py-2 pr-4 font-medium">Reason</th>
            <th className="py-2 pr-4 text-right font-medium">Change</th>
            <th className="py-2 pr-4 text-right font-medium">After</th>
            <th className="py-2 font-medium">Who</th>
          </tr>
        </thead>
        <tbody>
          {data.map((movement) => (
            <tr key={movement.id} className="border-b">
              <td className="text-muted-foreground py-3 pr-4 whitespace-nowrap">
                {shortDateTime(movement.created_at)}
              </td>
              <td className="py-3 pr-4">
                {movement.product_slug ? (
                  <Link
                    href={`/inventory/${movement.product_slug}`}
                    className="hover:underline"
                  >
                    {movement.product}
                  </Link>
                ) : (
                  movement.product
                )}
                {movement.note && (
                  <div className="text-muted-foreground text-xs">
                    {movement.note}
                  </div>
                )}
              </td>
              <td className="text-muted-foreground py-3 pr-4">
                {REASON_LABEL[movement.reason]}
                {movement.order_reference && (
                  <div className="gg-numeric text-xs">
                    {movement.order_reference}
                  </div>
                )}
              </td>
              <td
                className={cn(
                  "gg-numeric py-3 pr-4 text-right font-medium",
                  movement.delta > 0
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-destructive",
                )}
              >
                {movement.delta > 0 ? "+" : ""}
                {movement.delta}
              </td>
              <td className="gg-numeric text-muted-foreground py-3 pr-4 text-right">
                {movement.stock_after}
              </td>
              <td className="text-muted-foreground py-3 text-xs">
                {/*
                  A null user means no staff member did this — but that covers
                  two different things, and conflating them mislabels the ledger.
                  With an order attached it was a paid order moving its own
                  stock; without one it was the system (a seed, or a migration).
                */}
                {movement.user ??
                  (movement.order_reference ? "Online order" : "System")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
