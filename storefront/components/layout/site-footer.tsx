import Link from "next/link";
// `Instagram` and the other brand glyphs were removed in lucide v1 for
// licensing reasons. `AtSign` reads as a handle, which is what the link is.
import { AtSign, MapPin, MessageCircle, Phone } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { BUSINESS } from "@/lib/business";

/**
 * The dark bookend. `className="dark"` re-themes every token inside it, which is
 * why nothing here needs explicit colour classes (DESIGN.md §4).
 */
export function SiteFooter() {
  return (
    <footer className="dark bg-background relative mt-24 overflow-hidden">
      <div
        aria-hidden
        className="gg-aurora pointer-events-none absolute inset-x-0 -top-32 h-64 opacity-40"
      />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Logo showTagline />
            <p className="text-muted-foreground mt-5 max-w-sm text-sm">
              Premium new and foreign-used laptops for work, school, business and
              everything in between. Warranty on every item.
            </p>

            <div className="mt-6 space-y-2.5 text-sm">
              <a
                href={BUSINESS.whatsappUrl}
                className="text-muted-foreground hover:text-foreground flex items-center gap-2.5 transition-colors"
              >
                <MessageCircle className="size-4 shrink-0" />
                Chat on WhatsApp
              </a>
              <a
                href={`tel:${BUSINESS.phone.replace(/\s/g, "")}`}
                className="text-muted-foreground hover:text-foreground flex items-center gap-2.5 transition-colors"
              >
                <Phone className="size-4 shrink-0" />
                {BUSINESS.phone}
              </a>
              <a
                href={BUSINESS.instagramUrl}
                className="text-muted-foreground hover:text-foreground flex items-center gap-2.5 transition-colors"
              >
                <AtSign className="size-4 shrink-0" />
                {BUSINESS.instagramHandle}
              </a>
              <p className="text-muted-foreground flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0" />
                <span>{BUSINESS.address}</span>
              </p>
            </div>
          </div>

          <FooterColumn title="Shop">
            <FooterLink href="/shop">All products</FooterLink>
            <FooterLink href="/shop?category=laptops">Laptops</FooterLink>
            <FooterLink href="/shop?category=gaming">Gaming laptops</FooterLink>
            <FooterLink href="/shop?category=accessories">Accessories</FooterLink>
          </FooterColumn>

          <FooterColumn title="Buying here">
            <FooterLink href="/how-it-works">How it works</FooterLink>
            <FooterLink href="/warranty">Warranty</FooterLink>
            <FooterLink href="/delivery">Delivery</FooterLink>
            <FooterLink href="/terms">Terms &amp; conditions</FooterLink>
          </FooterColumn>
        </div>

        {/*
          The no-pay-on-delivery rule stated plainly. It is the business's whole
          differentiation and appears on nearly every post, so it belongs in the
          chrome rather than buried in a terms page (DESIGN.md §1).
        */}
        <div className="border-border mt-14 border-t pt-8">
          <p className="text-muted-foreground text-xs">
            We do not offer swaps, trade-ins, easy buys, or payment on delivery.
            Every order is paid in full before dispatch — that is how we keep
            prices where they are.
          </p>
          <p className="text-muted-foreground mt-4 text-xs">
            © {new Date().getFullYear()} {BUSINESS.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-xs font-semibold tracking-[0.18em] uppercase">
        {title}
      </h2>
      <ul className="mt-5 space-y-3">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="text-muted-foreground hover:text-foreground text-sm transition-colors"
      >
        {children}
      </Link>
    </li>
  );
}
