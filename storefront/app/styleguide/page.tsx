import type { Metadata } from "next";
import { Check, Headphones, ShieldCheck, Truck, X } from "lucide-react";

import { ConditionBadge } from "@/components/brand/condition-badge";
import { Logo, LogoMark } from "@/components/brand/logo";
import { PriceFrom, PriceTag } from "@/components/brand/price-tag";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { specSummary, warrantyLabel } from "@/lib/format";

export const metadata: Metadata = {
  title: "Styleguide",
  robots: { index: false, follow: false },
};

/**
 * The design system, rendered.
 *
 * Every token and primitive appears here on BOTH surfaces — the white catalogue
 * surface and the black bookend — because the failure mode this page exists to
 * catch is a component that was only ever checked on one of them. Contrast
 * regressions show up here or they show up in production.
 *
 * Not linked from the site; `robots: noindex` above.
 */
export default function StyleguidePage() {
  return (
    /* A div, not a <main> — the root layout already provides one. */
    <div className="mx-auto w-full max-w-5xl px-6 py-16">
      <header className="mb-16">
        <Logo showTagline className="mb-8" />
        <h1 className="text-4xl font-semibold tracking-tight">Styleguide</h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-balance">
          Design tokens and primitives for the Gadgets Garden storefront. The
          system is light-led with dark bookends — the catalogue is white, the
          hero and footer are black and carry the brand gradient. Every block
          below is shown on both.
        </p>
      </header>

      <Section title="Brand colour">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {BRAND_COLOURS.map((c) => (
            <figure key={c.token}>
              <div
                className="border-border h-16 rounded-lg border"
                style={{ background: `var(${c.token})` }}
              />
              <figcaption className="mt-2">
                <div className="text-xs font-medium">{c.name}</div>
                <div className="text-muted-foreground gg-numeric text-[11px]">
                  {c.hex}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-6">
          <div
            className="h-14 rounded-lg"
            style={{ background: "var(--gg-gradient)" }}
          />
          <p className="text-muted-foreground mt-2 text-xs">
            The signature gradient. Logo, one hero element, active states — and
            nothing else without a reason.
          </p>
        </div>
      </Section>

      <Section title="Surfaces">
        <div className="grid gap-4 md:grid-cols-2">
          <SurfaceDemo label="Light — catalogue, detail, cart, checkout" />
          <div className="dark bg-background overflow-hidden rounded-xl">
            <SurfaceDemo label="Dark — hero, banners, footer" />
          </div>
        </div>
      </Section>

      <Section title="Typography">
        <div className="space-y-4">
          <p className="text-5xl font-semibold tracking-tight text-balance">
            Premium laptops you can trust.
          </p>
          <p className="text-2xl font-semibold tracking-tight">
            Section heading
          </p>
          <p className="text-sm font-semibold tracking-[0.18em] uppercase">
            Eyebrow / category label
          </p>
          <p className="max-w-2xl">
            Body copy. We provide high quality laptops for work, school,
            business and everything in between.
          </p>
          <p className="text-muted-foreground text-sm">
            Muted — specs, helper text, compare-at prices.
          </p>
          <p className="gg-numeric text-lg font-semibold">
            ₦1,900,000 · ₦620,000 · ₦84,500 — tabular figures, so prices align
            down a grid column.
          </p>
        </div>
      </Section>

      <Section title="Condition badges">
        <p className="text-muted-foreground mb-4 text-sm">
          The first thing a used-hardware buyer looks for. Colour never carries
          the meaning alone — the label is always rendered.
        </p>
        <div className="flex flex-wrap gap-3">
          <ConditionBadge condition="new" />
          <ConditionBadge condition="foreign_used" />
          <ConditionBadge condition="refurbished" />
          <ConditionBadge condition="foreign_used" size="sm" />
        </div>
        <div className="dark bg-background mt-4 flex flex-wrap gap-3 rounded-lg p-4">
          <ConditionBadge condition="new" />
          <ConditionBadge condition="foreign_used" />
          <ConditionBadge condition="refurbished" />
        </div>
      </Section>

      <Section title="Prices">
        <div className="flex flex-col gap-4">
          <PriceTag price={620_000} size="hero" />
          <PriceTag price={620_000} compareAt={780_000} size="lg" />
          <PriceTag price={1_900_000} compareAt={2_100_000} />
          <PriceTag price={84_500} size="sm" />
          <PriceFrom from={620_000} size="lg" />
          <p className="text-muted-foreground text-sm">
            A <code>compareAt</code> at or below the price renders nothing — a
            fake discount on a trust-led brand is worse than no discount.
          </p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Buy now</Button>
          <Button variant="outline">Add to cart</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button size="sm">Small</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="dark bg-background mt-4 flex flex-wrap items-center gap-3 rounded-lg p-4">
          <Button>Buy now</Button>
          <Button variant="outline">Add to cart</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
      </Section>

      <Section title="Product card">
        <p className="text-muted-foreground mb-4 text-sm">
          Adapted from the reference: a condition badge and a spec line are
          added, because a name and a price alone cannot distinguish two
          ThinkPads at different prices.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLE_UNITS.map((unit) => (
            <DemoProductCard key={unit.name} unit={unit} />
          ))}
        </div>
      </Section>

      <Section title="Trust strip">
        <div className="border-border flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border p-6">
          {TRUST.map((t) => (
            <div key={t.label} className="flex items-center gap-2">
              <t.icon className="text-gg-blue size-4" strokeWidth={2} />
              <span className="text-sm font-semibold">{t.label}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Policy list">
        <p className="text-muted-foreground mb-4 text-sm">
          Straight from the brand&rsquo;s own posts. This is the differentiation,
          so it gets stated plainly rather than buried in a terms page.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-3 text-sm font-semibold tracking-wide uppercase">
                We don&apos;t do
              </h3>
              <ul className="space-y-2">
                {["Swap", "Trade-ins", "Easy buys", "Pay on delivery"].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-2 text-sm">
                      <X className="text-destructive size-4" strokeWidth={2.5} />
                      {item}
                    </li>
                  ),
                )}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-3 text-sm font-semibold tracking-wide uppercase">
                Every order
              </h3>
              <ul className="space-y-2">
                {[
                  "Warranty on all items",
                  "Nationwide delivery",
                  "24/7 customer support",
                  "Paid before dispatch",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm">
                    <Check
                      className="text-condition-new size-4"
                      strokeWidth={2.5}
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title="Forms">
        <div className="grid max-w-md gap-4">
          <div className="grid gap-2">
            <Label htmlFor="sg-email">Email</Label>
            <Input id="sg-email" type="email" placeholder="you@example.com" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sg-phone">Phone</Label>
            <Input id="sg-phone" placeholder="0805 694 7271" />
          </div>
        </div>
      </Section>

      <Section title="Tabs, badges, skeletons">
        <Tabs defaultValue="specs" className="max-w-lg">
          <TabsList>
            <TabsTrigger value="specs">Specs</TabsTrigger>
            <TabsTrigger value="warranty">Warranty</TabsTrigger>
            <TabsTrigger value="delivery">Delivery</TabsTrigger>
          </TabsList>
          <TabsContent value="specs" className="text-muted-foreground text-sm">
            {specSummary(SAMPLE_UNITS[0].specs)}
          </TabsContent>
          <TabsContent
            value="warranty"
            className="text-muted-foreground text-sm"
          >
            {warrantyLabel(12)}
          </TabsContent>
          <TabsContent
            value="delivery"
            className="text-muted-foreground text-sm"
          >
            Nationwide delivery. Dispatched after payment confirms.
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex flex-wrap gap-2">
          <Badge>Bestseller</Badge>
          <Badge variant="secondary">In stock</Badge>
          <Badge variant="outline">Last one</Badge>
          <Badge variant="destructive">Sold</Badge>
        </div>

        <div className="mt-6 grid max-w-xs gap-2">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </Section>

      <Section title="Motion">
        <p className="text-muted-foreground mb-6 text-sm">
          Scroll this section into view. Everything animates through one{" "}
          <code>&lt;Reveal&gt;</code> wrapper so timing is tuned in a single
          file. All of it honours <code>prefers-reduced-motion</code> — the CSS
          guard handles transitions, <code>MotionConfig</code> handles Framer.
        </p>

        <Reveal className="border-border mb-4 rounded-xl border p-6">
          <p className="font-medium">Reveal — fade up</p>
          <p className="text-muted-foreground text-sm">
            The default entrance, fired once when the element is properly on
            screen.
          </p>
        </Reveal>

        <Stagger className="grid gap-3 sm:grid-cols-3">
          {["First", "Second", "Third"].map((label) => (
            <StaggerItem
              key={label}
              className="border-border rounded-xl border p-6"
            >
              <p className="font-medium">{label}</p>
              <p className="text-muted-foreground text-sm">Staggered child</p>
            </StaggerItem>
          ))}
        </Stagger>
      </Section>

      <Section title="Dark bookend">
        <div className="dark bg-background relative overflow-hidden rounded-2xl">
          <div className="gg-aurora absolute inset-0 opacity-60" aria-hidden />
          <div className="relative px-8 py-16">
            <LogoMark className="size-12" />
            <h2 className="mt-6 max-w-lg text-4xl font-semibold tracking-tight text-balance">
              Premium laptops you can{" "}
              <span className="gg-gradient-text">trust</span>.
            </h2>
            <p className="text-muted-foreground mt-4 max-w-md">
              Foreign used and new. Warranty on every item, nationwide delivery
              from Computer Village, Ikeja.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button>Shop laptops</Button>
              <Button variant="outline">How it works</Button>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3">
              {TRUST.map((t) => (
                <div key={t.label} className="flex items-center gap-2">
                  <t.icon className="text-gg-cyan size-4" strokeWidth={2} />
                  <span className="text-sm font-medium">{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Gradient utilities">
        <div className="space-y-6">
          <p className="text-3xl font-semibold tracking-tight">
            <span className="gg-gradient-text">gg-gradient-text</span>
          </p>
          <hr className="gg-gradient-rule" />
          <div className="gg-gradient-border w-fit rounded-xl px-6 py-4">
            <span className="text-sm font-medium">gg-gradient-border</span>
          </div>
          <div className="gg-aurora h-32 rounded-xl" />
        </div>
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-16">
      <h2 className="mb-1 text-sm font-semibold tracking-[0.18em] uppercase">
        {title}
      </h2>
      <Separator className="mb-6" />
      {children}
    </section>
  );
}

function SurfaceDemo({ label }: { label: string }) {
  return (
    <div className="border-border bg-background rounded-xl border p-6">
      <p className="text-sm font-semibold">{label}</p>
      <p className="text-muted-foreground mt-1 text-sm">
        Muted foreground on this surface.
      </p>
      <div className="mt-4 flex gap-2">
        <div className="bg-muted size-10 rounded-md" title="muted" />
        <div className="bg-secondary size-10 rounded-md" title="secondary" />
        <div className="bg-accent size-10 rounded-md" title="accent" />
        <div className="bg-primary size-10 rounded-md" title="primary" />
      </div>
    </div>
  );
}

function DemoProductCard({ unit }: { unit: (typeof SAMPLE_UNITS)[number] }) {
  return (
    <Card className="group overflow-hidden pt-0">
      {/* Stand-in for photography — the real card renders a next/image here. */}
      <div className="bg-muted relative aspect-[4/3] overflow-hidden">
        <div className="text-muted-foreground absolute inset-0 grid place-items-center text-xs">
          product photo
        </div>
        <div className="absolute top-3 left-3">
          <ConditionBadge condition={unit.condition} size="sm" />
        </div>
      </div>
      <CardContent className="space-y-2">
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {unit.brand}
          </p>
          <h3 className="leading-tight font-semibold">{unit.name}</h3>
        </div>
        <p className="text-muted-foreground gg-numeric text-xs">
          {specSummary(unit.specs)}
        </p>
        <PriceTag price={unit.price} compareAt={unit.compareAt} />
        <p className="text-muted-foreground text-xs">
          {warrantyLabel(unit.warranty)}
        </p>
        <div className="flex gap-2 pt-1">
          <Button size="sm" className="flex-1">
            Buy now
          </Button>
          <Button size="sm" variant="outline" className="flex-1">
            Add to cart
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------- fixtures */

/* Sampled from the supplied logo, which is the authority on these. */
const BRAND_COLOURS = [
  { name: "Ink", token: "--gg-ink", hex: "#000000" },
  { name: "Teal", token: "--gg-teal", hex: "#6ECED3" },
  { name: "Cyan", token: "--gg-cyan", hex: "#5ACBD1" },
  { name: "Sky", token: "--gg-sky", hex: "#71C5DF" },
  { name: "Blue", token: "--gg-blue", hex: "#5E6FED" },
  { name: "Indigo", token: "--gg-indigo", hex: "#626BEC" },
  { name: "Magenta", token: "--gg-magenta", hex: "#E85CC8" },
];

const TRUST = [
  { label: "Warranty on all items", icon: ShieldCheck },
  { label: "Nationwide delivery", icon: Truck },
  { label: "24/7 support", icon: Headphones },
];

/**
 * Real models and real prices observed on the business's Instagram, so the
 * styleguide is checked against the lengths of text it will actually hold —
 * "₦1,900,000" and a long CPU string are what break a card layout, not lorem.
 */
const SAMPLE_UNITS = [
  {
    brand: "HP",
    name: "EliteBook 840 G8",
    condition: "foreign_used" as const,
    price: 620_000,
    compareAt: 780_000,
    warranty: 6,
    specs: {
      cpu: "Core i7-1165G7",
      ram_gb: 16,
      storage_gb: 512,
      storage_type: "SSD",
    },
  },
  {
    brand: "Alienware",
    name: "X15 R1",
    condition: "foreign_used" as const,
    price: 1_900_000,
    compareAt: null,
    warranty: 3,
    specs: {
      cpu: "Core i9-11900H",
      ram_gb: 32,
      storage_gb: 1024,
      storage_type: "SSD",
    },
  },
  {
    brand: "HP",
    name: "Pavilion 15",
    condition: "new" as const,
    price: 600_000,
    compareAt: 660_000,
    warranty: 12,
    specs: {
      cpu: "Core i5-1235U",
      ram_gb: 8,
      storage_gb: 512,
      storage_type: "SSD",
    },
  },
];
