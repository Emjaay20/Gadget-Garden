/**
 * Money, and the shapes a laptop listing needs to render.
 *
 * MONEY IS WHOLE NAIRA, ALWAYS. Every amount crossing the API is an integer
 * number of naira — `620000` means ₦620,000, never kobo. No price in this
 * business has a kobo component, and the one place a provider might disagree
 * (a gateway returning minor units) converts inside the gateway, never here.
 */

const NAIRA = "₦";

/**
 * ₦620,000
 *
 * `en-NG` rather than a hand-rolled regex so grouping stays correct, and the
 * symbol is prepended manually — `Intl` with `currency: "NGN"` renders "NGN"
 * on some platforms and "₦" on others, which would make the same price look
 * different on an iPhone and a Windows laptop.
 */
export function naira(amount: number): string {
  return `${NAIRA}${Math.round(amount).toLocaleString("en-NG")}`;
}

/**
 * ₦1.9m / ₦620k — for dense surfaces like filter chips and dashboard tiles
 * where the full figure would wrap.
 *
 * Never use this on a price the customer is about to pay. Rounding ₦1,949,000
 * to "₦1.9m" on a checkout line is the kind of thing that ends in a dispute.
 */
export function nairaCompact(amount: number): string {
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    return `${NAIRA}${trimZero(millions.toFixed(1))}m`;
  }
  if (amount >= 1_000) {
    return `${NAIRA}${Math.round(amount / 1_000)}k`;
  }
  return `${NAIRA}${amount}`;
}

function trimZero(value: string): string {
  return value.endsWith(".0") ? value.slice(0, -2) : value;
}

/** The percentage off, for a compare-at price. Null when there is no real discount. */
export function discountPercent(
  price: number,
  compareAt: number | null | undefined,
): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

/* ------------------------------------------------------------------ specs */

export type Condition = "new" | "foreign_used" | "refurbished";

export const CONDITION_LABEL: Record<Condition, string> = {
  new: "New",
  foreign_used: "Foreign used",
  refurbished: "Refurbished",
};

/**
 * The specs that decide a laptop purchase, in the order a buyer reads them.
 *
 * Order is not cosmetic: two ThinkPads at different prices are distinguishable
 * only by this line, so it must stay consistent across the card, the detail
 * page and the cart, and CPU/RAM/storage must come first.
 */
export type UnitSpecs = {
  cpu?: string | null;
  ram_gb?: number | null;
  storage_gb?: number | null;
  storage_type?: string | null;
  screen?: string | null;
  gpu?: string | null;
  battery_health?: number | null;
};

/** "Core i7 · 16GB · 512GB SSD" — the one-line summary used on cards. */
export function specSummary(specs: UnitSpecs | null | undefined): string {
  if (!specs) return "";

  return [
    specs.cpu,
    specs.ram_gb ? `${specs.ram_gb}GB` : null,
    storageLabel(specs),
  ]
    .filter(Boolean)
    .join(" · ");
}

function storageLabel(specs: UnitSpecs): string | null {
  if (!specs.storage_gb) return null;

  const size =
    specs.storage_gb >= 1024
      ? `${trimZero((specs.storage_gb / 1024).toFixed(1))}TB`
      : `${specs.storage_gb}GB`;

  return specs.storage_type ? `${size} ${specs.storage_type}` : size;
}

/** Full label/value rows for the product detail spec table. */
export function specRows(
  specs: UnitSpecs | null | undefined,
): Array<{ label: string; value: string }> {
  if (!specs) return [];

  const rows: Array<{ label: string; value: string }> = [];
  const push = (label: string, value: string | null | undefined) => {
    if (value) rows.push({ label, value });
  };

  push("Processor", specs.cpu);
  push("Memory", specs.ram_gb ? `${specs.ram_gb}GB` : null);
  push("Storage", storageLabel(specs));
  push("Display", specs.screen);
  push("Graphics", specs.gpu);
  push(
    "Battery health",
    specs.battery_health ? `${specs.battery_health}%` : null,
  );

  return rows;
}

/** "12 months warranty" / "No warranty" — never an empty string. */
export function warrantyLabel(months: number | null | undefined): string {
  if (!months) return "No warranty";
  if (months === 1) return "1 month warranty";
  return `${months} months warranty`;
}

/* ---------------------------------------------------------- backoffice only */

/** "2 Aug, 14:30" — dense enough for a table, unambiguous for a shop. */
export function shortDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";

  return new Date(iso).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "2 Aug 2026" */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";

  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Margin on a line, when cost is known.
 *
 * Returns null rather than 0 when cost is absent — a missing cost is "we do not
 * know", and showing it as zero margin would be a lie staff might act on.
 */
export function margin(price: number, cost: number | null | undefined) {
  if (cost === null || cost === undefined) return null;

  const profit = price - cost;

  return { profit, percent: price > 0 ? Math.round((profit / price) * 100) : 0 };
}
