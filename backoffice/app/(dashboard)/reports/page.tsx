import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowDownRight, ArrowUpRight, Clock } from "lucide-react";

import {
  AgeingBuckets,
  BrandBars,
  RevenueChart,
  type DayPoint,
} from "@/components/reports/charts";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/server/api";
import { naira, nairaCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports · Gadgets Garden" };

type Report = {
  range: { from: string; to: string; days: number };
  summary: {
    current: {
      revenue: number;
      orders: number;
      units_sold: number;
      average_order: number;
      margin: number;
      cost_known_revenue: number;
    };
    previous: { revenue: number; orders: number };
    change: { revenue: number | null; orders: number | null };
  };
  revenue_by_day: DayPoint[];
  top_brands: Array<{ brand: string; revenue: number; units: number }>;
  ageing_stock: {
    buckets: Array<{ label: string; units: number; value: number }>;
    oldest: Array<{
      sku: string;
      name: string | null;
      slug: string | null;
      price: number;
      days: number;
    }>;
    total_units: number;
    total_value: number;
  };
};

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

export default async function ReportsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await props.searchParams;
  const days = Number(params.days) || 30;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Sales</h1>

        {/* Filters in one row above the charts. */}
        <nav className="flex gap-1 text-sm">
          {RANGES.map((range) => (
            <Link
              key={range.days}
              href={`/reports?days=${range.days}`}
              className={cn(
                "rounded-md px-3 py-1.5",
                days === range.days
                  ? "bg-accent font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {range.label}
            </Link>
          ))}
        </nav>
      </div>

      <Suspense fallback={<Skeleton className="mt-8 h-[600px]" />}>
        <Report days={days} />
      </Suspense>
    </div>
  );
}

async function Report({ days }: { days: number }) {
  /*
   | The window is a `days` count, resolved to dates by the API.
   |
   | Computing it here from `Date.now()` is impure during render (React 19's
   | linter refuses it, correctly) and would also pin the range to the browser's
   | clock rather than the shop's — two different answers to "today" for a
   | business that trades across timezones with its suppliers.
   */
  const { data } = await api<{ data: Report }>(`/reports?days=${days}`);
  const { summary, ageing_stock: ageing } = data;

  return (
    <>
      {/*
        A KPI row, not a grouped bar chart. These are four unrelated headline
        numbers — charting them together would invite comparisons between
        quantities that share no scale.
      */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Revenue"
          value={naira(summary.current.revenue)}
          change={summary.change.revenue}
          footnote={`vs ${naira(summary.previous.revenue)} previous ${days} days`}
        />
        <Tile
          label="Orders paid"
          value={String(summary.current.orders)}
          change={summary.change.orders}
          footnote={`${summary.current.units_sold} item${summary.current.units_sold === 1 ? "" : "s"} sold`}
        />
        <Tile
          label="Average order"
          value={naira(summary.current.average_order)}
        />
        <Tile
          label="Margin"
          value={naira(summary.current.margin)}
          /*
            Margin only covers lines whose cost is known — serialized machines.
            Accessories have no cost recorded, so saying so is the difference
            between a useful number and a misleading one.
          */
          footnote={
            summary.current.cost_known_revenue < summary.current.revenue
              ? `on ${naira(summary.current.cost_known_revenue)} of tracked cost`
              : "on all sales"
          }
        />
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-semibold">Revenue per day</h2>
        <p className="text-muted-foreground mb-4 text-xs">
          Dated by when payment cleared, so it reconciles against the bank.
        </p>
        <RevenueChart series={data.revenue_by_day} />
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="text-sm font-semibold">Revenue by brand</h2>
          <p className="text-muted-foreground mb-4 text-xs">
            What is actually selling.
          </p>
          <BrandBars rows={data.top_brands} />
        </section>

        <section>
          <h2 className="text-sm font-semibold">How long stock has been sitting</h2>
          <p className="text-muted-foreground mb-4 text-xs">
            {ageing.total_units} machine{ageing.total_units === 1 ? "" : "s"} on
            the shelf, worth {naira(ageing.total_value)} at retail.
          </p>
          <AgeingBuckets buckets={ageing.buckets} />

          {ageing.oldest.length > 0 && (
            <div className="mt-6 rounded-xl border p-4">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold">
                <Clock className="size-3.5" />
                Longest on the shelf
              </h3>
              <ul className="mt-3 space-y-2 text-sm">
                {ageing.oldest.map((unit) => (
                  <li key={unit.sku} className="flex justify-between gap-4">
                    <span className="min-w-0">
                      {unit.slug ? (
                        <Link
                          href={`/inventory/${unit.slug}`}
                          className="hover:underline"
                        >
                          {unit.name}
                        </Link>
                      ) : (
                        unit.name
                      )}
                      <span className="text-muted-foreground gg-numeric block text-xs">
                        {unit.sku} · {nairaCompact(unit.price)}
                      </span>
                    </span>
                    <span className="gg-numeric text-muted-foreground shrink-0 text-xs">
                      {unit.days}d
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {/*
        The table view. Required as a relief channel for the charts above, and
        genuinely the thing an owner wants when reconciling a month.
      */}
      <details className="mt-10">
        <summary className="cursor-pointer text-sm font-medium">
          Show the numbers as a table
        </summary>
        <div className="mt-4 max-h-96 overflow-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 sticky top-0">
              <tr className="text-muted-foreground text-left">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 text-right font-medium">Orders</th>
                <th className="px-4 py-2 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.revenue_by_day.map((day) => (
                <tr key={day.date} className="border-t">
                  <td className="px-4 py-2">{day.date}</td>
                  <td className="gg-numeric px-4 py-2 text-right">{day.orders}</td>
                  <td className="gg-numeric px-4 py-2 text-right">
                    {naira(day.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

/**
 * A headline number.
 *
 * The delta is null when the previous period had nothing to compare against —
 * "up 100%" from zero is noise, and the API returns null rather than inventing
 * a percentage.
 */
function Tile({
  label,
  value,
  change,
  footnote,
}: {
  label: string;
  value: string;
  change?: number | null;
  footnote?: string;
}) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="gg-numeric mt-1.5 text-2xl font-semibold tracking-tight">
        {value}
      </p>

      {change !== null && change !== undefined && (
        <p
          className={cn(
            "mt-1 flex items-center gap-1 text-xs font-medium",
            change >= 0
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-destructive",
          )}
        >
          {change >= 0 ? (
            <ArrowUpRight className="size-3.5" />
          ) : (
            <ArrowDownRight className="size-3.5" />
          )}
          {Math.abs(change)}%
        </p>
      )}

      {footnote && (
        <p className="text-muted-foreground mt-1 text-xs">{footnote}</p>
      )}
    </div>
  );
}
