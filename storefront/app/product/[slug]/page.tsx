import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Headphones, ShieldCheck, Truck } from "lucide-react";

import { ConditionBadge } from "@/components/brand/condition-badge";
import { Reveal } from "@/components/motion/reveal";
import { ProductGallery } from "@/components/shop/product-gallery";
import { UnitPicker } from "@/components/shop/unit-picker";
import { SaveToWishlist } from "@/components/shop/save-to-wishlist";
import { getProduct } from "@/lib/api";
import { BUSINESS } from "@/lib/business";
import { naira } from "@/lib/format";


/**
 * `params` is a PROMISE in Next 16 — synchronous access was removed. The
 * generated `PageProps` helper types it correctly.
 */
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    return { title: "Not found" };
  }

  const price = product.from_price
    ? `${product.price_is_from ? "From " : ""}${naira(product.from_price)}`
    : "Sold out";

  return {
    title: product.name,
    description:
      product.short_description ??
      `${product.name} — ${price}. Warranty included, nationwide delivery.`,
    openGraph: {
      title: `${product.name} — ${price}`,
      description: product.short_description ?? undefined,
      images: product.images[0] ? [product.images[0].url] : undefined,
    },
  };
}

function YoutubeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function getYouTubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i,
  );
  return match ? match[1] : null;
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    notFound();
  }

  const youtubeVideoId = getYouTubeVideoId(product.youtube_url);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <Breadcrumbs product={product} />

      <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-16">
        <ProductGallery productName={product.name} images={product.images} />

        <div>
          {product.brand && (
            <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
              {product.brand}
            </p>
          )}

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {product.name}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {product.condition && (
              <ConditionBadge condition={product.condition} />
            )}
            {product.properties && product.properties.length > 0 && (
              product.properties.map((prop) => (
                <span
                  key={prop}
                  className="inline-flex items-center rounded-full bg-secondary/80 px-2.5 py-0.5 text-xs font-medium text-secondary-foreground border border-border"
                >
                  {prop}
                </span>
              ))
            )}
          </div>

          {product.short_description && (
            <p className="text-muted-foreground mt-4 text-pretty">
              {product.short_description}
            </p>
          )}

          <div className="mt-8">
            <UnitPicker product={product} />
            <SaveToWishlist productId={product.id} />
          </div>

          <ul className="border-border mt-8 space-y-3 border-t pt-6">
            {[
              { icon: ShieldCheck, text: "Warranty on every item" },
              { icon: Truck, text: "Nationwide delivery, dispatched once payment clears" },
              { icon: Headphones, text: "24/7 support — we are always reachable" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm">
                <Icon className="text-gg-blue size-4 shrink-0" />
                {text}
              </li>
            ))}
          </ul>

          <p className="text-muted-foreground mt-6 text-xs text-pretty">
            We do not offer pay on delivery, swaps or trade-ins. Prefer to see it
            first? Visit us at {BUSINESS.address}, or{" "}
            <a
              href={BUSINESS.whatsappUrl}
              className="text-foreground underline underline-offset-4"
            >
              ask for photos of this exact unit
            </a>
            .
          </p>
        </div>
      </div>

      {product.highlights.length > 0 && (
        <Reveal className="mt-20">
          <h2 className="text-xs font-semibold tracking-[0.18em] uppercase">
            Highlights
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {product.highlights.map((highlight) => (
              <li
                key={highlight}
                className="border-border rounded-xl border p-5 text-sm text-pretty"
              >
                {highlight}
              </li>
            ))}
          </ul>
        </Reveal>
      )}

      {youtubeVideoId && (
        <Reveal className="mt-20">
          <div className="flex items-center gap-2.5 mb-4">
            <YoutubeIcon className="size-5 text-red-600" />
            <h2 className="text-xs font-semibold tracking-[0.18em] uppercase">
              Video Review & Walkthrough
            </h2>
          </div>
          <div className="relative aspect-video w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-black/5 shadow-md">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}`}
              title={`${product.name} Video Review`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
        </Reveal>
      )}

      {product.description && (
        <Reveal className="mt-20">
          <h2 className="text-xs font-semibold tracking-[0.18em] uppercase">
            Overview & Specifications
          </h2>
          <div className="mt-4 rounded-xl border border-border p-6 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
            {product.description}
          </div>
        </Reveal>
      )}
    </div>
  );
}

function Breadcrumbs({ product }: { product: Awaited<ReturnType<typeof getProduct>> }) {
  if (!product) return null;

  return (
    <nav aria-label="Breadcrumb">
      <ol className="text-muted-foreground flex items-center gap-1.5 text-sm">
        <li>
          <Link href="/shop" className="hover:text-foreground transition-colors">
            Shop
          </Link>
        </li>
        {product.category && (
          <>
            <ChevronRight aria-hidden className="size-3.5" />
            <li>
              <Link
                href={`/shop?category=${product.category.slug}`}
                className="hover:text-foreground transition-colors"
              >
                {product.category.name}
              </Link>
            </li>
          </>
        )}
        <ChevronRight aria-hidden className="size-3.5" />
        <li className="text-foreground truncate font-medium">{product.name}</li>
      </ol>
    </nav>
  );
}
