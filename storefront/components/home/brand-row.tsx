import Link from "next/link";

import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { getFacets } from "@/lib/api";
import { toQueryString } from "@/lib/catalogue-query";

/**
 * "Shop by brand" — the reference's greyscale logo row (DESIGN.md §3, section 8).
 *
 * Set as wordmarks rather than as the manufacturers' actual logos. Two reasons,
 * and the second is the real one: we do not hold licensed vector art for Dell,
 * HP, Lenovo or Alienware, and a row of hotlinked or traced logos on a store
 * that sells foreign-used stock invites exactly the "is this an authorised
 * reseller?" question the hero badge exists to answer. A wordmark set in the
 * site's own type claims nothing it should not.
 *
 * The brands come from `/shop/products/filters`, so this row can never offer a
 * brand the catalogue cannot fill — every tile lands on results.
 */
export async function BrandRow() {
  const facets = await getFacets();

  // One brand is not a choice, and no brands is not a section.
  if (facets.brands.length < 2) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
      <Reveal>
        <div className="mb-8">
          <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
            Shop by brand
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Brands we carry
          </h2>
        </div>
      </Reveal>

      <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {facets.brands.slice(0, 12).map((brand) => (
          <StaggerItem key={brand}>
            <Link
              href={`/shop${toQueryString({ brand: [brand] })}`}
              className="border-border hover:border-foreground/25 hover:bg-muted/50 focus-visible:ring-ring group grid h-20 place-items-center rounded-xl border px-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <span className="text-muted-foreground group-hover:text-foreground text-center text-sm font-semibold tracking-[0.14em] uppercase transition-colors">
                {brand}
              </span>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

export function BrandRowSkeleton() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-56" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-xl" />
        ))}
      </div>
    </section>
  );
}
