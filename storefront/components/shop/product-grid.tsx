import { ProductCard } from "@/components/shop/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProductGrid({
  products,
  className,
  /** Eager-load the first row's images — they are usually above the fold. */
  priorityCount = 0,
}: {
  products: Product[];
  className?: string;
  priorityCount?: number;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className,
      )}
    >
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          priority={index < priorityCount}
        />
      ))}
    </div>
  );
}

/**
 * The Suspense fallback. Matches the card's real proportions — a skeleton of
 * the wrong shape causes a visible jump when the content lands, which is worse
 * than no skeleton.
 */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
}

/**
 * The rail's fallback. Same card, laid out on the carousel's widths so the
 * shelf does not resize when the products stream in.
 */
export function ProductRailSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex gap-4 overflow-hidden pb-2">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="w-[78%] shrink-0 sm:w-[45%] lg:w-[31.5%] xl:w-[23.5%]"
        >
          <CardSkeleton />
        </div>
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="border-border overflow-hidden rounded-xl border">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
    </div>
  );
}
