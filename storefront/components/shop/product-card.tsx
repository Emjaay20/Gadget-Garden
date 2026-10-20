"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeftRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { ConditionBadge } from "@/components/brand/condition-badge";
import { TRANSITION } from "@/components/motion/motion-provider";
import { ProductImage } from "@/components/shop/product-image";
import { PriceFrom, PriceTag } from "@/components/brand/price-tag";
import { Button } from "@/components/ui/button";
import { useCompare } from "@/lib/compare-store";
import { naira, specSummary, warrantyLabel } from "@/lib/format";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The catalogue card. ONE component for both product kinds — a serialized
 * laptop and a boxed charger differ only in what the API puts in `from_price`
 * and `price_is_from`.
 *
 * Adapted from the reference design, which sells new stock and needs neither of
 * these (DESIGN.md §4):
 *
 *   - a CONDITION BADGE, because "foreign used" is the whole proposition and it
 *     is the first thing a buyer here looks for;
 *   - a SPEC LINE, because two ThinkPads at different prices are otherwise
 *     indistinguishable and the card would be asking for a blind click.
 *
 * The hover animation moves `transform` and `opacity` only, so it never triggers
 * layout, and it is disabled wholesale under `prefers-reduced-motion` by the
 * MotionConfig in the root layout.
 */
export function ProductCard({
  product,
  priority = false,
}: {
  product: Product;
  priority?: boolean;
}) {
  const href = `/product/${product.slug}`;
  // The specs of the unit this price belongs to, not the model line's shared ones.
  const specs = specSummary(product.summary_specs);
  const soldOut = !product.in_stock || product.from_price === null;
  const { addItem, removeItem, isInCompare } = useCompare();
  const inCompare = isInCompare(product.id);

  return (
    <motion.article
      whileHover={soldOut ? undefined : { y: -4 }}
      transition={TRANSITION.snap}
      className={cn(
        /*
          `h-full` matters in the carousel, not the grid: a grid item stretches
          on its own, but in the rail the card sits inside a flex `<li>` and
          would otherwise size to its content — leaving a row of cards with
          ragged bottoms wherever one title wraps to two lines.
        */
        "group border-border bg-card relative flex h-full flex-col overflow-hidden rounded-xl border",
        soldOut && "opacity-70",
      )}
    >
      <Link href={href} className="flex flex-1 flex-col">
        <div className="bg-muted relative aspect-[4/3] overflow-hidden">
          <motion.div
            className="absolute inset-0"
            whileHover={soldOut ? undefined : { scale: 1.04 }}
            transition={TRANSITION.default}
          >
            <ProductImage
              image={product.images[0]}
              alt={product.name}
              className="absolute inset-0 p-6"
              priority={priority}
            />
          </motion.div>

          {product.condition && (
            <div className="absolute top-3 left-3">
              <ConditionBadge condition={product.condition} size="sm" />
            </div>
          )}

          {soldOut && (
            <div className="bg-background/70 absolute inset-0 grid place-items-center backdrop-blur-[1px]">
              <span className="text-sm font-semibold">Sold out</span>
            </div>
          )}

          {/*
            "Last one" is honest scarcity — it is literally true of a serialized
            listing down to its final machine, unlike the reference's countdown
            timer, which we deliberately did not adopt.
          */}
          {!soldOut && product.available_count === 1 && (
            <span className="bg-background/90 absolute top-3 right-3 rounded-full px-2 py-0.5 text-[11px] font-medium shadow-sm">
              Last one
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          {product.brand && (
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {product.brand}
            </p>
          )}

          <h3 className="leading-snug font-semibold text-balance">
            {product.name}
          </h3>

          {specs && (
            <p className="text-muted-foreground gg-numeric text-xs">{specs}</p>
          )}

          <div className="mt-auto pt-2">
            {soldOut ? (
              <p className="text-muted-foreground text-sm">Currently unavailable</p>
            ) : product.price_is_from ? (
              <PriceFrom from={product.from_price!} size="lg" />
            ) : (
              <PriceTag
                price={product.from_price!}
                compareAt={product.compare_at_price}
                size="lg"
              />
            )}

            {product.warranty_months > 0 && (
              <p className="text-muted-foreground mt-1.5 flex items-center gap-1.5 text-xs">
                <ShieldCheck className="size-3.5" />
                {warrantyLabel(product.warranty_months)}
              </p>
            )}
          </div>
        </div>
      </Link>

      <div className="flex gap-2 p-4 pt-0">
        <Button asChild size="sm" className="flex-1" disabled={soldOut}>
          <Link href={href}>
            {product.kind === "unit" && product.available_count > 1
              ? "Choose one"
              : "View details"}
          </Link>
        </Button>

        {!soldOut && (
          <Button
            type="button"
            size="icon-sm"
            variant={inCompare ? "secondary" : "outline"}
            onClick={(e) => {
              e.preventDefault();
              if (inCompare) {
                removeItem(product.id);
                toast.info(`Removed ${product.name} from comparison`);
              } else {
                addItem({
                  productId: product.id,
                  productSlug: product.slug,
                  name: product.name,
                  brand: product.brand,
                  price: product.from_price ?? 0,
                  condition: product.condition,
                  grade: null,
                  warrantyMonths: product.warranty_months,
                  specs: product.summary_specs ?? {},
                });
                toast.success(`Added ${product.name} to comparison!`);
              }
            }}
            title={inCompare ? "In comparison" : "Add to comparison"}
            aria-label={`Compare ${product.name}`}
            className={cn(
              "shrink-0",
              inCompare && "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
            )}
          >
            <ArrowLeftRight className="size-3.5" />
          </Button>
        )}
      </div>

      {/*
        The whole card is a link target, but only the title is the accessible
        name — this gives screen readers the price too, without duplicating a
        visible link.
      */}
      <span className="sr-only">
        {soldOut
          ? `${product.name} is currently unavailable.`
          : `${product.name}, ${product.price_is_from ? "from " : ""}${naira(product.from_price!)}.`}
      </span>
    </motion.article>
  );
}
