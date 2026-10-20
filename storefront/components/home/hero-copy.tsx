"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, X } from "lucide-react";

import { TRANSITION, VARIANTS } from "@/components/motion/motion-provider";
import { Button } from "@/components/ui/button";
import { BUSINESS } from "@/lib/business";

/**
 * The client half of the hero.
 *
 * The hero is a Server Component so it can read the featured machine, but the
 * entrance animation and the aurora drift need the client. Splitting here keeps
 * the fetch on the server and ships only the moving parts to the browser.
 */

/**
 * The refracted-light wash behind the whole section.
 *
 * ANIMATION BUDGET: one slow drift, suppressed entirely under reduced motion. An
 * 18-second looping transform is exactly the kind of persistent movement that
 * causes trouble for people with vestibular disorders, and unlike an entrance it
 * never ends.
 */
export function AuroraWash() {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      aria-hidden
      className="gg-aurora absolute inset-0 -z-10 opacity-70"
      animate={
        reducedMotion ? undefined : { scale: [1, 1.08, 1], x: ["0%", "2%", "0%"] }
      }
      transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

export function HeroCopy() {
  return (
    <motion.div initial="hidden" animate="visible" variants={VARIANTS.stagger}>
      <motion.p
        variants={VARIANTS.fadeUp}
        transition={TRANSITION.grand}
        className="text-gg-cyan text-xs font-semibold tracking-[0.22em] uppercase"
      >
        {BUSINESS.tagline}
      </motion.p>

      <motion.h1
        variants={VARIANTS.fadeUp}
        transition={TRANSITION.grand}
        className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.5rem] lg:leading-[1.05]"
      >
        Premium laptops you can{" "}
        <span className="gg-gradient-text">trust</span>.
      </motion.h1>

      <motion.p
        variants={VARIANTS.fadeUp}
        transition={TRANSITION.grand}
        className="text-muted-foreground mt-6 max-w-md text-base text-pretty sm:text-lg"
      >
        New and foreign-used machines for work, school, business and everything in
        between — hand-checked in {BUSINESS.city}, delivered nationwide.
      </motion.p>

      <motion.div
        variants={VARIANTS.fadeUp}
        transition={TRANSITION.grand}
        className="mt-9 flex flex-wrap gap-3"
      >
        <Button asChild size="lg">
          <Link href="/shop">
            Shop laptops
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <a href={BUSINESS.whatsappUrl}>Talk to us</a>
        </Button>
      </motion.div>
    </motion.div>
  );
}

/**
 * The reference's fine print, bottom-left of the hero card.
 *
 * `PolicySection` further down states the same four things at length. That is
 * not an oversight: this is the line the shop puts on every post, and a buyer
 * who bounces before the fold should still have seen it. Here it is one quiet
 * row; there it is the argument.
 */
export function HeroFinePrint() {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={VARIANTS.fade}
      transition={{ ...TRANSITION.grand, delay: 0.5 }}
      className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-6"
    >
      <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
        We don&rsquo;t do
      </span>
      {BUSINESS.weDontDo.map((item) => (
        <span
          key={item}
          className="text-muted-foreground flex items-center gap-1.5 text-xs"
        >
          <X className="size-3 shrink-0" strokeWidth={2.5} />
          {item}
        </span>
      ))}
    </motion.div>
  );
}
