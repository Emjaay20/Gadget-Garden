"use client";

import { useId, useState } from "react";

import { naira, nairaCompact } from "@/lib/format";

/**
 * Charts for the sales dashboard.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COLOUR
 *
 * Every chart here is SINGLE-SERIES — revenue over time, revenue by brand, units
 * by age bucket. None of them is about telling series apart, so none uses a
 * categorical palette. They use one hue (the brand indigo) as a SEQUENTIAL ramp,
 * which is the safe default for magnitude and is what these actually are.
 *
 * The ramp was checked for lightness monotonicity (the correct test for a
 * sequential ramp — the categorical CVD validator fails such a ramp by design)
 * and the primary mark clears 4.22:1 against white. Its pale steps sit under
 * 3:1, which obligates a relief channel, so EVERY bar is direct-labelled with
 * its own value. That is not decoration; it is what makes the pale end legible.
 *
 * No legends: a single series is named by the chart's own title.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const RAMP = ["#8590F2", "#5E6FED", "#3F49C4", "#2A3190"] as const;
const PRIMARY = "#5E6FED";

/* ------------------------------------------------------------------ revenue */

export type DayPoint = { date: string; revenue: number; orders: number };

/**
 * Revenue over time.
 *
 * An area under a 2px line. The series includes every day in the range — days
 * with no sales are zeroes, not gaps — because a line that skips empty days
 * draws continuous trade that did not happen.
 */
export function RevenueChart({ series }: { series: DayPoint[] }) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  if (series.length === 0) return null;

  const width = 800;
  const height = 220;
  const pad = { top: 16, right: 8, bottom: 24, left: 8 };

  const max = Math.max(...series.map((d) => d.revenue), 1);
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const x = (i: number) =>
    pad.left + (series.length === 1 ? innerW / 2 : (i / (series.length - 1)) * innerW);
  const y = (value: number) => pad.top + innerH - (value / max) * innerH;

  const line = series.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.revenue)}`).join(" ");
  const area = `${line} L${x(series.length - 1)},${pad.top + innerH} L${x(0)},${pad.top + innerH} Z`;

  const active = hover === null ? null : series[hover];

  return (
    <figure className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={`Revenue per day. Peak ${naira(max)}.`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PRIMARY} stopOpacity="0.22" />
            <stop offset="100%" stopColor={PRIMARY} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Recessive baseline — the grid must never compete with the data. */}
        <line
          x1={pad.left}
          x2={width - pad.right}
          y1={pad.top + innerH}
          y2={pad.top + innerH}
          className="stroke-border"
          strokeWidth="1"
        />

        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} fill="none" stroke={PRIMARY} strokeWidth="2" strokeLinejoin="round" />

        {hover !== null && (
          <>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={pad.top}
              y2={pad.top + innerH}
              className="stroke-border"
              strokeWidth="1"
            />
            <circle
              cx={x(hover)}
              cy={y(series[hover].revenue)}
              r="5"
              fill={PRIMARY}
              // A 2px surface ring keeps the marker readable where it overlaps
              // the area fill.
              className="stroke-background"
              strokeWidth="2"
            />
          </>
        )}

        {/*
          Invisible hit targets, one per day and far wider than the marks. Hover
          on a 2px line is unusable otherwise.
        */}
        {series.map((day, i) => (
          <rect
            key={day.date}
            x={x(i) - innerW / series.length / 2}
            y={pad.top}
            width={innerW / series.length}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>

      <div className="text-muted-foreground mt-1 flex justify-between text-xs">
        <span>{formatDay(series[0].date)}</span>
        <span>{formatDay(series[series.length - 1].date)}</span>
      </div>

      {active && (
        <div
          className="bg-popover text-popover-foreground pointer-events-none absolute top-0 rounded-md border px-3 py-2 text-xs shadow-sm"
          style={{
            left: `${(x(hover!) / width) * 100}%`,
            transform: "translateX(-50%)",
          }}
          role="status"
        >
          <div className="font-medium">{formatDay(active.date)}</div>
          <div className="gg-numeric">{naira(active.revenue)}</div>
          <div className="text-muted-foreground">
            {active.orders} order{active.orders === 1 ? "" : "s"}
          </div>
        </div>
      )}
    </figure>
  );
}

/* ------------------------------------------------------------------- brands */

/**
 * Revenue by brand — a horizontal bar chart.
 *
 * Horizontal because brand names are words, and rotated axis labels are a
 * readability tax nobody needs to pay. Ranked so the eye starts at the top.
 */
export function BrandBars({
  rows,
}: {
  rows: Array<{ brand: string; revenue: number; units: number }>;
}) {
  if (rows.length === 0) {
    return <Empty>No sales in this period.</Empty>;
  }

  const max = Math.max(...rows.map((r) => r.revenue), 1);

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.brand}>
          <div className="mb-1 flex items-baseline justify-between gap-4 text-sm">
            <span className="font-medium">{row.brand}</span>
            {/* Direct label — the value never lives in a tooltip alone. */}
            <span className="gg-numeric text-muted-foreground">
              {naira(row.revenue)}
              <span className="ml-2 text-xs">
                {row.units} unit{row.units === 1 ? "" : "s"}
              </span>
            </span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              // 4px rounded data-end, anchored to the baseline at the left.
              className="h-full rounded-full"
              style={{
                width: `${Math.max((row.revenue / max) * 100, 2)}%`,
                background: PRIMARY,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------ ageing stock */

/**
 * Available machines by how long they have been on the shelf.
 *
 * Sequential light→dark across an ORDERED scale, so older reads as heavier —
 * which is exactly what it is. For used hardware this is the most consequential
 * chart on the page: every bar to the right is capital tied up in an asset that
 * depreciates weekly and cannot be reordered.
 */
export function AgeingBuckets({
  buckets,
}: {
  buckets: Array<{ label: string; units: number; value: number }>;
}) {
  const max = Math.max(...buckets.map((b) => b.units), 1);

  return (
    <ul className="space-y-3">
      {buckets.map((bucket, index) => (
        <li key={bucket.label}>
          <div className="mb-1 flex items-baseline justify-between gap-4 text-sm">
            <span className="font-medium">{bucket.label}</span>
            <span className="gg-numeric text-muted-foreground">
              {bucket.units} unit{bucket.units === 1 ? "" : "s"}
              <span className="ml-2 text-xs">{nairaCompact(bucket.value)}</span>
            </span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max((bucket.units / max) * 100, bucket.units > 0 ? 3 : 0)}%`,
                background: RAMP[Math.min(index, RAMP.length - 1)],
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------- bits */

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground py-8 text-center text-sm">{children}</p>;
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
  });
}
