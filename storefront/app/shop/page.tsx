import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { CatalogueFilters } from "@/components/shop/catalogue-filters";
import { SortSelect } from "@/components/shop/sort-select";
import { ProductGrid, ProductGridSkeleton } from "@/components/shop/product-grid";
import { Button } from "@/components/ui/button";
import { getFacets, getProducts } from "@/lib/api";
import { parseCatalogueQuery, toQueryString } from "@/lib/catalogue-query";
import type { CatalogueQuery } from "@/lib/types";

export const metadata: Metadata = {
  title: "Shop",
  description:
    "New and foreign-used laptops, phones and accessories. Warranty on every item, nationwide delivery from Computer Village, Ikeja.",
};

/**
 * The catalogue.
 *
 * `searchParams` is a PROMISE in Next 16 — synchronous access was removed, not
 * deprecated. It is also what makes this route dynamic, so the results are
 * always current: a laptop that sold thirty seconds ago is gone from the grid.
 */
export default async function ShopPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const query = parseCatalogueQuery(searchParams);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">
          {query.search ? `Results for “${query.search}”` : "All products"}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Every machine is checked before it is listed, and carries a warranty.
        </p>
      </header>

      <div className="flex gap-10">
        <Suspense fallback={<div className="hidden w-60 shrink-0 lg:block" />}>
          <Facets query={query} />
        </Suspense>

        <div className="min-w-0 flex-1">
          <div className="mb-6 flex items-center justify-between gap-4">
            <Suspense fallback={null}>
              <ResultCount query={query} />
            </Suspense>
            <SortSelect query={query} />
          </div>

          <Suspense key={toQueryString(query)} fallback={<ProductGridSkeleton />}>
            <Results query={query} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function Facets({ query }: { query: CatalogueQuery }) {
  const facets = await getFacets();

  return <CatalogueFilters facets={facets} query={query} />;
}

/**
 * Rendered separately from the grid so the count is not blocked by it — and
 * because both read from the same memoized `fetch`, this costs no extra request.
 */
async function ResultCount({ query }: { query: CatalogueQuery }) {
  const { meta } = await getProducts(query);

  return (
    <p className="text-muted-foreground text-sm">
      {meta.total} {meta.total === 1 ? "product" : "products"}
    </p>
  );
}

async function Results({ query }: { query: CatalogueQuery }) {
  const { data, meta } = await getProducts(query);

  if (data.length === 0) {
    return <EmptyState query={query} />;
  }

  return (
    <>
      <ProductGrid products={data} priorityCount={4} />

      {meta.last_page > 1 && (
        <Pagination query={query} meta={meta} />
      )}
    </>
  );
}

function EmptyState({ query }: { query: CatalogueQuery }) {
  return (
    <div className="border-border rounded-xl border border-dashed py-20 text-center">
      <h2 className="font-semibold">Nothing matches that yet</h2>
      <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm text-pretty">
        {query.search
          ? `We have nothing matching “${query.search}” in stock right now. Stock moves fast — message us and we will tell you what is coming in.`
          : "No products match those filters. Try widening them."}
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/shop">Clear filters</Link>
        </Button>
      </div>
    </div>
  );
}

function Pagination({
  query,
  meta,
}: {
  query: CatalogueQuery;
  meta: { current_page: number; last_page: number };
}) {
  const current = meta.current_page;

  return (
    <nav
      aria-label="Pagination"
      className="mt-10 flex items-center justify-center gap-2"
    >
      <Button
        asChild={current > 1}
        variant="outline"
        size="sm"
        disabled={current <= 1}
      >
        {current > 1 ? (
          <Link href={`/shop${toQueryString({ ...query, page: current - 1 })}`}>
            Previous
          </Link>
        ) : (
          <span>Previous</span>
        )}
      </Button>

      <span className="text-muted-foreground gg-numeric px-3 text-sm">
        Page {current} of {meta.last_page}
      </span>

      <Button
        asChild={current < meta.last_page}
        variant="outline"
        size="sm"
        disabled={current >= meta.last_page}
      >
        {current < meta.last_page ? (
          <Link href={`/shop${toQueryString({ ...query, page: current + 1 })}`}>
            Next
          </Link>
        ) : (
          <span>Next</span>
        )}
      </Button>
    </nav>
  );
}
