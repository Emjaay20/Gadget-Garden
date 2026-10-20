import { discountPercent, naira } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * A price, optionally with the struck-through original beside it — the shape
 * used throughout the Behance reference.
 *
 * Always tabular-numeric (`gg-numeric`), because prices are compared down a
 * column in a grid and proportional digits make ₦1,900,000 and ₦620,000 sit
 * ragged against each other.
 *
 * A `compareAt` at or below `price` renders nothing rather than a "0% off"
 * badge — a fake discount on a trust-led brand is worse than no discount.
 */
export function PriceTag({
  price,
  compareAt,
  size = "default",
  className,
}: {
  price: number;
  compareAt?: number | null;
  size?: "sm" | "default" | "lg" | "hero";
  className?: string;
}) {
  const off = discountPercent(price, compareAt);

  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}>
      <span className={cn("gg-numeric font-semibold tracking-tight", SIZE[size])}>
        {naira(price)}
      </span>

      {off !== null && (
        <>
          <span
            className={cn(
              "gg-numeric text-muted-foreground line-through",
              STRIKE[size],
            )}
          >
            {naira(compareAt!)}
          </span>
          <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
            −{off}%
          </span>
        </>
      )}
    </div>
  );
}

const SIZE = {
  sm: "text-sm",
  default: "text-base",
  lg: "text-xl",
  hero: "text-3xl sm:text-4xl",
} as const;

const STRIKE = {
  sm: "text-xs",
  default: "text-sm",
  lg: "text-sm",
  hero: "text-base",
} as const;

/**
 * "from ₦620,000" — what a serialized listing shows when its units are priced
 * individually. A single ThinkPad model line may hold four machines at four
 * prices, so the card cannot honestly show one number without the qualifier.
 */
export function PriceFrom({
  from,
  size = "default",
  className,
}: {
  from: number;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline gap-1.5", className)}>
      <span className="text-muted-foreground text-xs">from</span>
      <span className={cn("gg-numeric font-semibold tracking-tight", SIZE[size])}>
        {naira(from)}
      </span>
    </div>
  );
}
