import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";

import { BrandRow, BrandRowSkeleton } from "@/components/home/brand-row";
import { Hero } from "@/components/home/hero";
import { PolicySection, PromiseStrip } from "@/components/home/promise-strip";
import { Reveal } from "@/components/motion/reveal";
import { ProductCarousel } from "@/components/shop/product-carousel";
import {
  ProductGrid,
  ProductGridSkeleton,
  ProductRailSkeleton,
} from "@/components/shop/product-grid";
import { Button } from "@/components/ui/button";
import { getProducts } from "@/lib/api";
import { BUSINESS } from "@/lib/business";

export default function HomePage() {
  return (
    <>
      <Hero />
      <PromiseStrip />

      {/*
        Each shelf streams independently.

        Next 16 does not cache `fetch` by default, and an uncached read outside a
        Suspense boundary is a BUILD ERROR — so these boundaries are required,
        not decorative. They are also the right call on merit: stock changes the
        moment someone buys, and a cached `available_count` would advertise a
        laptop that is already gone.

        The two shelves are deliberately DIFFERENT shapes. A rail says "there is
        more of this than fits"; a grid says "here is the set". Rendering both as
        identical four-up grids, which is what this page used to do, made the
        second one read as padding.
      */}
      <Shelf
        eyebrow="In stock now"
        title="Featured machines"
        href="/shop"
        linkLabel="See everything"
      >
        <Suspense fallback={<ProductRailSkeleton />}>
          <FeaturedProducts />
        </Suspense>
      </Shelf>

      <Suspense fallback={<BrandRowSkeleton />}>
        <BrandRow />
      </Suspense>

      <Shelf
        eyebrow="Under ₦700,000"
        title="Great value laptops"
        href="/shop?category=laptops&max_price=700000&sort=price_asc"
        linkLabel="Browse by price"
      >
        <Suspense fallback={<ProductGridSkeleton count={4} />}>
          <AffordableProducts />
        </Suspense>
      </Shelf>

      <PolicySection />
      <VisitSection />
    </>
  );
}

async function FeaturedProducts() {
  // More than fits on screen, or the rail has nothing to scroll to.
  const { data } = await getProducts({ sort: "featured", per_page: 10 });

  return (
    <ProductCarousel
      products={data}
      label="Featured machines"
      priorityCount={4}
    />
  );
}

async function AffordableProducts() {
  const { data } = await getProducts({
    // Scoped to laptops on purpose. Filtering on price alone put a ₦12,000
    // mouse at the head of a shelf headed "great value" — technically the
    // cheapest thing in the catalogue, and useless to someone shopping for a
    // machine.
    category: "laptops",
    max_price: 700_000,
    sort: "price_asc",
    per_page: 4,
  });

  return <ProductGrid products={data} />;
}

function Shelf({
  eyebrow,
  title,
  href,
  linkLabel,
  children,
}: {
  eyebrow: string;
  title: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
      <Reveal>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
              {eyebrow}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              {title}
            </h2>
          </div>

          <Link
            href={href}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm font-medium transition-colors"
          >
            {linkLabel}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </Reveal>

      {children}
    </section>
  );
}

function VisitSection() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6">
      <Reveal>
        <div className="dark bg-background relative overflow-hidden rounded-2xl">
          <div
            aria-hidden
            className="gg-aurora pointer-events-none absolute inset-0 opacity-50"
          />
          <div className="relative grid gap-8 p-8 sm:p-12 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                Rather see it in person?
              </h2>
              <p className="text-muted-foreground mt-4 text-pretty">
                We are in Computer Village — come and handle the machine before
                you buy it. Or message us and we will send photos and a video of
                the exact unit.
              </p>
              <p className="text-muted-foreground mt-4 text-sm">
                {BUSINESS.address}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild>
                  <a href={BUSINESS.whatsappUrl}>Message on WhatsApp</a>
                </Button>
                <Button asChild variant="outline">
                  <a href={`tel:${BUSINESS.phone.replace(/\s/g, "")}`}>
                    {BUSINESS.phone}
                  </a>
                </Button>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-6">
              {[
                ["8+ years", "in the gadget trade"],
                ["Foreign used", "and brand new"],
                ["Nationwide", "delivery"],
                ["24/7", "support"],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="sr-only">{label}</dt>
                  <dd>
                    <span className="gg-gradient-text block text-2xl font-semibold tracking-tight">
                      {value}
                    </span>
                    <span className="text-muted-foreground mt-1 block text-sm">
                      {label}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
