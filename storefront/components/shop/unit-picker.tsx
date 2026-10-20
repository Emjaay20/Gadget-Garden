"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeftRight, Check, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { BatteryBadge } from "@/components/brand/battery-badge";
import { ConditionBadge } from "@/components/brand/condition-badge";
import { GradingGuideDialog } from "@/components/brand/grading-guide-dialog";
import { TRANSITION } from "@/components/motion/motion-provider";
import { PriceTag } from "@/components/brand/price-tag";
import { AddProductToCart, AddToCart } from "@/components/shop/add-to-cart";
import { MakeAnOfferModal } from "@/components/shop/make-an-offer-modal";
import { Button } from "@/components/ui/button";
import { useCompare } from "@/lib/compare-store";
import { naira, specRows, specSummary, warrantyLabel } from "@/lib/format";
import type { Product, ProductUnit } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * THE UNIT PICKER — the product page, for serialized stock.
 *
 * A listing like "HP EliteBook 840 G8" is a model line, not a thing you can buy.
 * What you buy is one specific machine, and they differ in ways that decide the
 * purchase: 16GB vs 32GB, grade A vs grade B, ₦545,000 vs ₦680,000. Presenting
 * them as interchangeable would mean shipping the wrong laptop.
 *
 * So this is a radio group, not a variant dropdown: each row is a real object
 * with its own price and its own spec sheet, and the selection drives both the
 * headline price and the spec table below.
 *
 * Selection state IS local here, unlike the catalogue filters — it is a
 * transient choice within one page, not a view worth sharing a link to.
 */
export function UnitPicker({ product }: { product: Product }) {
  const units = product.units ?? [];
  const [selectedId, setSelectedId] = useState(units[0]?.id ?? null);

  /*
   * A quantity-tracked product (charger, bag) has no units to choose between —
   * one price, one button. Handled here rather than in a separate component so
   * the product page has a single buy box to render regardless of kind, which
   * is the same reason the API gives both kinds one response shape.
   */
  if (product.kind === "stocked") {
    return <StockedBuyBox product={product} />;
  }

  if (units.length === 0) {
    return <SoldOut />;
  }

  const selected = units.find((unit) => unit.id === selectedId) ?? units[0];
  const multiple = units.length > 1;
  const { addItem, removeItem, isInCompare } = useCompare();

  const isCurrentInCompare = isInCompare(selected.sku);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <ConditionBadge condition={selected.condition} />
          {selected.grade && (
            <span className="rounded-full bg-neutral-100 dark:bg-neutral-800 border px-2.5 py-0.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
              Grade {selected.grade}
            </span>
          )}
          {typeof selected.specs.battery_health === "number" && (
            <BatteryBadge health={selected.specs.battery_health} />
          )}
          <GradingGuideDialog />
        </div>
        <PriceTag price={selected.price} size="hero" />
        <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-sm">
          <ShieldCheck className="size-4" />
          {warrantyLabel(product.warranty_months)} · SKU {selected.sku}
        </p>
      </div>

      {multiple && (
        <fieldset>
          <legend className="text-xs font-semibold tracking-[0.14em] uppercase">
            Choose your machine — {units.length} available
          </legend>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Each one is a different physical laptop. Specs and price vary.
          </p>

          <div role="radiogroup" className="mt-4 space-y-2">
            {units.map((unit) => (
              <UnitOption
                key={unit.id}
                unit={unit}
                isSelected={unit.id === selected.id}
                onSelect={() => setSelectedId(unit.id)}
              />
            ))}
          </div>
        </fieldset>
      )}

      <div className="space-y-3">
        <AddToCart unitId={selected.id} price={selected.price} name={product.name} />
        <MakeAnOfferModal
          productId={product.id}
          productName={product.name}
          originalPrice={selected.price}
          unitId={selected.id}
          unitSku={selected.sku}
        />
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => {
            if (isCurrentInCompare) {
              removeItem(selected.sku);
              toast.info(`Removed SKU ${selected.sku} from comparison`);
            } else {
              addItem({
                productId: product.id,
                productSlug: product.slug,
                name: product.name,
                brand: product.brand,
                price: selected.price,
                condition: selected.condition,
                grade: selected.grade,
                warrantyMonths: product.warranty_months,
                specs: selected.specs,
                unitId: selected.id,
                unitSku: selected.sku,
              });
              toast.success(`Added ${product.name} (${selected.sku}) to comparison!`);
            }
          }}
          className="w-full gap-2 text-sm"
        >
          <ArrowLeftRight className="size-4" />
          {isCurrentInCompare ? "In Comparison (Click to Remove)" : "Add to Side-by-Side Compare"}
        </Button>
      </div>

      <SpecTable unit={selected} product={product} />
    </div>
  );
}

function UnitOption({
  unit,
  isSelected,
  onSelect,
}: {
  unit: ProductUnit;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const specs = specSummary(unit.specs);

  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={isSelected}
      onClick={onSelect}
      whileTap={{ scale: 0.995 }}
      transition={TRANSITION.snap}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        isSelected
          ? "border-foreground/40 bg-accent/40"
          : "border-border hover:border-foreground/25",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
          isSelected ? "border-primary bg-primary text-primary-foreground" : "border-input",
        )}
      >
        {isSelected && <Check className="size-2.5" strokeWidth={3} />}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <ConditionBadge condition={unit.condition} size="sm" />
          {unit.grade && (
            <span className="text-muted-foreground text-[11px] font-medium">
              Grade {unit.grade}
            </span>
          )}
        </span>

        {specs && (
          <span className="gg-numeric mt-1.5 block text-sm font-medium">
            {specs}
          </span>
        )}

        {typeof unit.specs.battery_health === "number" && (
          <div className="mt-1.5">
            <BatteryBadge health={unit.specs.battery_health} size="sm" />
          </div>
        )}
      </span>

      <span className="gg-numeric shrink-0 font-semibold">
        {naira(unit.price)}
      </span>
    </motion.button>
  );
}

/**
 * The full spec sheet for the SELECTED machine, with the listing's shared specs
 * beneath. Keyed on the unit so it animates when the selection changes —
 * otherwise a price and a spec table silently swapping underneath looks like a
 * rendering glitch rather than a response to the click.
 */
function SpecTable({ unit, product }: { unit: ProductUnit; product: Product }) {
  const rows = specRows(unit.specs);
  const shared = specRows(product.base_specs).filter(
    (row) => !rows.some((existing) => existing.label === row.label),
  );

  if (rows.length === 0 && shared.length === 0) return null;

  return (
    <motion.dl
      key={unit.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={TRANSITION.snap}
      className="border-border divide-border divide-y rounded-xl border text-sm"
    >
      {[...rows, ...shared].map((row) => (
        <div key={row.label} className="flex gap-4 px-4 py-3">
          <dt className="text-muted-foreground w-32 shrink-0">{row.label}</dt>
          <dd className="gg-numeric font-medium">{row.value}</dd>
        </div>
      ))}
    </motion.dl>
  );
}

/** One price, one button — the quantity-tracked case. */
function StockedBuyBox({ product }: { product: Product }) {
  if (!product.in_stock || product.from_price === null) {
    return <SoldOut />;
  }

  return (
    <div className="space-y-6">
      <div>
        <PriceTag
          price={product.from_price}
          compareAt={product.compare_at_price}
          size="hero"
        />
        {product.warranty_months > 0 && (
          <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-sm">
            <ShieldCheck className="size-4" />
            {warrantyLabel(product.warranty_months)}
          </p>
        )}
      </div>

      {product.is_low_stock && (
        <p className="text-sm font-medium">
          Only {product.available_count} left in stock.
        </p>
      )}

      <div className="space-y-3">
        <AddProductToCart
          productId={product.id}
          price={product.from_price}
          name={product.name}
        />
        <MakeAnOfferModal
          productId={product.id}
          productName={product.name}
          originalPrice={product.from_price}
        />
      </div>

      <SpecTableFromSpecs specs={product.base_specs} />
    </div>
  );
}

/** The listing's own specs, for a product with no per-unit variation. */
function SpecTableFromSpecs({ specs }: { specs: Product["base_specs"] }) {
  const rows = specRows(specs);

  if (rows.length === 0) return null;

  return (
    <dl className="border-border divide-border divide-y rounded-xl border text-sm">
      {rows.map((row) => (
        <div key={row.label} className="flex gap-4 px-4 py-3">
          <dt className="text-muted-foreground w-32 shrink-0">{row.label}</dt>
          <dd className="gg-numeric font-medium">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SoldOut() {
  return (
    <div className="border-border rounded-xl border border-dashed p-8 text-center">
      <p className="font-semibold">Sold out</p>
      <p className="text-muted-foreground mx-auto mt-2 max-w-xs text-sm text-pretty">
        This one has gone. Stock changes weekly — message us and we will tell you
        when another comes in.
      </p>
    </div>
  );
}
