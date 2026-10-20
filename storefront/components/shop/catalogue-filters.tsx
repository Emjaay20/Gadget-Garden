"use client";

import { useRouter } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  activeFilterCount,
  toQueryString,
  toggleFacet,
} from "@/lib/catalogue-query";
import { CONDITION_LABEL, nairaCompact } from "@/lib/format";
import type { CatalogueFacets, CatalogueQuery, Condition } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The catalogue's facets.
 *
 * ALL FILTER STATE LIVES IN THE URL, never in component state. That is what
 * makes a filtered view shareable, bookmarkable, restorable with the back
 * button, and renderable on the server. It is also why every control here is a
 * navigation rather than a `setState`.
 *
 * Only facets the live catalogue can actually satisfy are offered — the API
 * derives them from available stock, so "ASUS" never appears when no ASUS
 * machine is in stock and a click can never land on an empty page.
 */
export function CatalogueFilters({
  facets,
  query,
}: {
  facets: CatalogueFacets;
  query: CatalogueQuery;
}) {
  const count = activeFilterCount(query);

  return (
    <>
      {/* Desktop: a persistent rail. */}
      <aside className="hidden w-60 shrink-0 lg:block">
        <FilterPanel facets={facets} query={query} count={count} />
      </aside>

      {/* Mobile: a sheet, because a rail would eat the whole screen. */}
      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <SlidersHorizontal className="size-4" />
              Filters
              {count > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {count}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-8">
              <FilterPanel facets={facets} query={query} count={count} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

function FilterPanel({
  facets,
  query,
  count,
}: {
  facets: CatalogueFacets;
  query: CatalogueQuery;
  count: number;
}) {
  const router = useRouter();

  const go = (next: CatalogueQuery) => router.push(`/shop${toQueryString(next)}`);

  return (
    <div className="space-y-7">
      {count > 0 && (
        <button
          type="button"
          onClick={() =>
            // Search and category survive a filter reset: they are how the
            // customer got here, not something they were narrowing by.
            go({ search: query.search, category: query.category, sort: query.sort })
          }
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
        >
          <X className="size-3.5" />
          Clear {count} {count === 1 ? "filter" : "filters"}
        </button>
      )}

      {facets.conditions.length > 1 && (
        <FilterGroup title="Condition">
          {facets.conditions.map((condition) => (
            <CheckRow
              key={condition}
              label={CONDITION_LABEL[condition as Condition]}
              checked={query.condition?.includes(condition as Condition) ?? false}
              onToggle={() => go(toggleFacet(query, "condition", condition))}
            />
          ))}
        </FilterGroup>
      )}

      {facets.brands.length > 1 && (
        <FilterGroup title="Brand">
          {facets.brands.map((brand) => (
            <CheckRow
              key={brand}
              label={brand}
              checked={query.brand?.includes(brand) ?? false}
              onToggle={() => go(toggleFacet(query, "brand", brand))}
            />
          ))}
        </FilterGroup>
      )}

      <FilterGroup title="Memory">
        {facets.ram_options.map((gb) => (
          <RadioRow
            key={gb}
            label={`${gb}GB or more`}
            checked={query.min_ram === gb}
            onToggle={() =>
              go({ ...query, min_ram: query.min_ram === gb ? undefined : gb, page: undefined })
            }
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Storage">
        {facets.storage_options.map((gb) => (
          <RadioRow
            key={gb}
            label={gb >= 1024 ? `${gb / 1024}TB or more` : `${gb}GB or more`}
            checked={query.min_storage === gb}
            onToggle={() =>
              go({
                ...query,
                min_storage: query.min_storage === gb ? undefined : gb,
                page: undefined,
              })
            }
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Price">
        {priceBands(facets.price_range).map((band) => {
          const checked =
            query.min_price === band.min && query.max_price === band.max;

          return (
            <RadioRow
              key={band.label}
              label={band.label}
              checked={checked}
              onToggle={() =>
                go({
                  ...query,
                  min_price: checked ? undefined : band.min,
                  max_price: checked ? undefined : band.max,
                  page: undefined,
                })
              }
            />
          );
        })}
      </FilterGroup>
    </div>
  );
}

/**
 * Price bands derived from what is actually in stock, rather than hard-coded.
 * A fixed "under ₦200,000" band on a catalogue whose cheapest laptop is
 * ₦505,000 is a guaranteed empty result.
 */
function priceBands({ min, max }: { min: number; max: number }) {
  if (max <= min) return [];

  const step = Math.ceil((max - min) / 3 / 50_000) * 50_000;

  if (step <= 0) return [];

  const first = min + step;
  const second = min + step * 2;

  return [
    { label: `Under ${nairaCompact(first)}`, min: undefined, max: first },
    { label: `${nairaCompact(first)} – ${nairaCompact(second)}`, min: first, max: second },
    { label: `Over ${nairaCompact(second)}`, min: second, max: undefined },
  ];
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold tracking-[0.14em] uppercase">
        {title}
      </h3>
      <div className="mt-3 space-y-1">{children}</div>
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className="group flex w-full items-center gap-2.5 py-1 text-left"
    >
      <span
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded-[4px] border transition-colors",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input group-hover:border-foreground/40",
        )}
      >
        {checked && (
          <svg viewBox="0 0 10 8" className="size-2.5 fill-none stroke-current stroke-2">
            <path d="M1 4l2.5 2.5L9 1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="text-sm">{label}</span>
    </button>
  );
}

function RadioRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onToggle}
      className="group flex w-full items-center gap-2.5 py-1 text-left"
    >
      <span
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded-full border transition-colors",
          checked ? "border-primary" : "border-input group-hover:border-foreground/40",
        )}
      >
        {checked && <span className="bg-primary size-2 rounded-full" />}
      </span>
      <span className="text-sm">{label}</span>
    </button>
  );
}
