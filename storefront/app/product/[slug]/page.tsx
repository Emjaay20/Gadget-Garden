import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Headphones, ShieldCheck, Truck } from "lucide-react";

import { ConditionBadge } from "@/components/brand/condition-badge";
import { Reveal } from "@/components/motion/reveal";
import { ProductGallery } from "@/components/shop/product-gallery";
import { UnitPicker } from "@/components/shop/unit-picker";
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

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    notFound();
  }

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

          {product.condition && (
            <div className="mt-4">
              <ConditionBadge condition={product.condition} />
            </div>
          )}

          {product.short_description && (
            <p className="text-muted-foreground mt-4 text-pretty">
              {product.short_description}
            </p>
          )}

          <div className="mt-8">
            <UnitPicker product={product} />
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

