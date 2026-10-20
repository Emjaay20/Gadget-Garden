import Link from "next/link";
import { Suspense } from "react";
import { Search } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { CartButton } from "@/components/layout/cart-button";
import { CategoryNav } from "@/components/layout/category-nav";
import { SearchField } from "@/components/layout/search-field";
import { getCategories } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The storefront header, following the reference's structure: logo, a
 * full-round search field, account/cart actions, and a row of category links
 * beneath.
 *
 * Sticky, because a catalogue is a scrolling surface and the search field is the
 * main way people navigate it.
 */
export function SiteHeader() {
  return (
    <header className="bg-background/85 sticky top-0 z-50 border-b backdrop-blur-md">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="flex h-16 items-center gap-4">
          <Link
            href="/"
            className="shrink-0 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Logo />
            <span className="sr-only">Gadgets Garden — home</span>
          </Link>

          {/*
            `useSearchParams()` opts a component out of static prerendering, so
            it MUST sit behind a Suspense boundary or the statically generated
            routes (`/_not-found` among them) fail the production build. The
            fallback is the same shape as the field, so nothing shifts.
          */}
          <div className="mx-auto hidden w-full max-w-md md:block">
            <Suspense fallback={<div className="bg-muted h-10 rounded-full" />}>
              <SearchField />
            </Suspense>
          </div>

          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <Link
              href="/shop"
              aria-label="Search"
              className="hover:bg-accent grid size-9 place-items-center rounded-full md:hidden"
            >
              <Search className="size-4" />
            </Link>

            <CartButton />
          </div>
        </div>

        {/*
          The category row reads from the API, so it is streamed rather than
          blocking the whole header — the logo and search are useful before the
          categories arrive.
        */}
        <Suspense fallback={<CategoryNavSkeleton />}>
          <CategoryRow />
        </Suspense>
      </div>
    </header>
  );
}

async function CategoryRow() {
  const categories = await getCategories();

  return <CategoryNav categories={categories} />;
}

function CategoryNavSkeleton() {
  return (
    <div className="flex h-11 items-center gap-6">
      {[64, 88, 72].map((width) => (
        <Skeleton key={width} className="h-3" style={{ width }} />
      ))}
    </div>
  );
}
