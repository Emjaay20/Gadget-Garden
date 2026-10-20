import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, BadgeCheck } from "lucide-react";

import { ConditionBadge } from "@/components/brand/condition-badge";
import { LaptopRender } from "@/components/brand/laptop-render";
import { PriceFrom, PriceTag } from "@/components/brand/price-tag";
import {
  AuroraWash,
  HeroCopy,
  HeroFinePrint,
} from "@/components/home/hero-copy";
import { ProductImage } from "@/components/shop/product-image";
import { Skeleton } from "@/components/ui/skeleton";
import { getProducts } from "@/lib/api";
import { specSummary, warrantyLabel } from "@/lib/format";
import type { Product } from "@/lib/types";

/**
 * The dark bookend at the top of the site, built to the reference's hero
 * (DESIGN.md §3): a thin-bordered rounded card, copy left and a machine right,
 * a credential badge top-right and fine print along the bottom.
 *
 * The reference is white and we are black here — that is §4's resolution, not a
 * departure. What was worth taking from it is the SHAPE. The earlier pass kept
 * the dark surface but dropped the card, the product and the badge, which left a
 * headline and two buttons floating on a gradient. That is the default landing
 * page every framework ships with, and it is why this section is now the one
 * doing the most work on the page.
 *
 * The showcase is a real listing rather than a decorative render, so the first
 * thing above the fold is something a visitor can actually buy.
 */
export function Hero() {
  return (
    <section className="dark bg-background relative isolate overflow-hidden">
      <AuroraWash />

      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="gg-gradient-border rounded-[28px] bg-white/[0.02] p-6 sm:p-10 lg:p-14">
          {/*
            The reference's "Authorised Reseller" chip. Ours says where the shop
            physically is, because in this market a verifiable Computer Village
            address is the credential that actually converts.
          */}
          <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium">
              <BadgeCheck className="text-gg-cyan size-3.5" strokeWidth={2.5} />
              A real shop in Computer Village, Ikeja
            </span>

            <Link
              href="/shop"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm font-medium transition-colors"
            >
              Browse the catalogue
              <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
            <HeroCopy />

            {/*
              Uncached data outside a Suspense boundary is a BUILD error in Next
              16, and this read is deliberately uncached — a featured laptop that
              sold an hour ago must not headline the page.
            */}
            <Suspense fallback={<HeroShowcaseSkeleton />}>
              <HeroShowcase />
            </Suspense>
          </div>

          <HeroFinePrint />
        </div>
      </div>
    </section>
  );
}

/**
 * NO ENTRANCE ANIMATION ON THIS COLUMN, DELIBERATELY.
 *
 * A Framer entrance would render this server HTML with `opacity: 0` and wait for
 * JavaScript to undo it. The copy beside it does exactly that, and that is the
 * pre-existing house pattern — but the copy is words, and this is the product a
 * visitor is meant to buy, sitting above the fold. It should not be gated on a
 * hydration that a slow connection, a failed chunk or a stalled frame loop can
 * delay or lose.
 *
 * So it simply renders: no inline opacity in the markup, visible the moment the
 * HTML lands. The animated copy beside it is plenty of movement for one hero.
 */
async function HeroShowcase() {
  const { data } = await getProducts({ sort: "featured", per_page: 1 });
  const product = data[0];

  return product ? <ShowcaseCard product={product} /> : <ShowcaseFallback />;
}

function ShowcaseCard({ product }: { product: Product }) {
  const href = `/product/${product.slug}`;
  const specs = specSummary(product.summary_specs);
  const image = product.images[0];

  return (
    <article className="rounded-2xl border border-white/12 bg-white/[0.04] p-5 backdrop-blur-sm">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-white/[0.03]">
        {image ? (
          <ProductImage
            image={image}
            alt={product.name}
            className="absolute inset-0 p-8"
            sizes="(min-width: 1024px) 40vw, 90vw"
            priority
          />
        ) : (
          /*
            No photography yet (DESIGN.md §6). The drawn machine holds the tile's
            proportions so the layout does not shift when real shots land.
          */
          <div className="absolute inset-0 grid place-items-center p-8">
            <LaptopRender className="max-w-[300px]" />
          </div>
        )}

        {product.condition && (
          <div className="absolute top-3 left-3">
            <ConditionBadge condition={product.condition} size="sm" />
          </div>
        )}

        {product.in_stock && product.available_count === 1 && (
          <span className="absolute top-3 right-3 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium backdrop-blur">
            Last one
          </span>
        )}
      </div>

      <div className="mt-5">
        {product.brand && (
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {product.brand}
          </p>
        )}

        <h2 className="mt-1.5 text-lg leading-snug font-semibold text-balance">
          <Link href={href} className="hover:text-gg-cyan transition-colors">
            {product.name}
          </Link>
        </h2>

        {specs && (
          <p className="text-muted-foreground gg-numeric mt-1.5 text-sm">{specs}</p>
        )}

        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
          {product.from_price === null ? (
            <p className="text-muted-foreground text-sm">Currently unavailable</p>
          ) : product.price_is_from ? (
            <PriceFrom from={product.from_price} size="lg" />
          ) : (
            <PriceTag
              price={product.from_price}
              compareAt={product.compare_at_price}
              size="lg"
            />
          )}

          {product.warranty_months > 0 && (
            <span className="text-muted-foreground text-xs">
              {warrantyLabel(product.warranty_months)}
            </span>
          )}
        </div>

        <Link
          href={href}
          className="text-gg-cyan mt-5 flex items-center gap-1.5 text-sm font-medium hover:underline"
        >
          See this machine
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </article>
  );
}

/** Nothing featured, or an empty catalogue — still show a machine, not a hole. */
function ShowcaseFallback() {
  return (
    <div className="grid place-items-center rounded-2xl border border-white/12 bg-white/[0.04] p-10">
      <LaptopRender className="max-w-[320px]" />
    </div>
  );
}

/**
 * Matches the card's real proportions. A fallback of the wrong shape causes a
 * visible jump when the listing streams in, which is worse than no fallback.
 */
function HeroShowcaseSkeleton() {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-5">
      <Skeleton className="aspect-[4/3] rounded-xl" />
      <div className="mt-5 space-y-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-7 w-36" />
      </div>
    </div>
  );
}
