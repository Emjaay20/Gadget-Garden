import { BadgeCheck, Check, ShieldCheck, Truck, X } from "lucide-react";

import { Reveal } from "@/components/motion/reveal";
import { BUSINESS } from "@/lib/business";

/**
 * The reference's trust strip, carrying this business's actual promises.
 */
export function PromiseStrip() {
  return (
    <section className="border-b">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-4 py-6 sm:px-6">
        {[
          { label: "Authentic stock", icon: BadgeCheck },
          { label: "Warranty on all items", icon: ShieldCheck },
          { label: "Nationwide delivery", icon: Truck },
          { label: "Paid before dispatch", icon: Check },
        ].map(({ label, icon: Icon }) => (
          <div key={label} className="flex items-center gap-2">
            <Icon className="text-gg-blue size-4" strokeWidth={2} />
            <span className="text-sm font-semibold">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The "WE DON'T DO" list, straight from the shop's own posts.
 *
 * Most stores would bury this in terms. Stating it on the landing page is the
 * point: in a market where pay-on-delivery scams are common, being unambiguous
 * about it is a trust signal rather than a limitation — and it pre-empts the
 * question the sales desk answers all day.
 */
export function PolicySection() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
      <Reveal>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="border-border rounded-2xl border p-8">
            <h2 className="text-sm font-semibold tracking-[0.18em] uppercase">
              What you always get
            </h2>
            <ul className="mt-6 space-y-3.5">
              {BUSINESS.promises.map((promise) => (
                <li key={promise} className="flex items-center gap-3">
                  <Check
                    className="text-condition-new size-4 shrink-0"
                    strokeWidth={2.5}
                  />
                  <span className="text-sm">{promise}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-border rounded-2xl border p-8">
            <h2 className="text-sm font-semibold tracking-[0.18em] uppercase">
              What we don&rsquo;t do
            </h2>
            <ul className="mt-6 space-y-3.5">
              {BUSINESS.weDontDo.map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <X
                    className="text-destructive size-4 shrink-0"
                    strokeWidth={2.5}
                  />
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-6 text-sm text-pretty">
              Every order is paid in full before it ships. It is the reason we can
              keep prices where they are, and why nothing leaves the shop
              unchecked.
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
