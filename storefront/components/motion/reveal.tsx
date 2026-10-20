"use client";

import { motion, type Variants } from "framer-motion";
import type { ElementType, ReactNode } from "react";

import { TRANSITION, VARIANTS } from "@/components/motion/motion-provider";
import { cn } from "@/lib/utils";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Which entrance to use. Defaults to the house fade-up. */
  variant?: keyof typeof VARIANTS;
  /** Seconds to wait before starting. Prefer `<Stagger>` for sibling sequencing. */
  delay?: number;
  /**
   * How far into the viewport the element must travel before it animates.
   * Negative shrinks the trigger area — the default holds the animation until
   * the element is properly on screen rather than firing at the very edge.
   */
  margin?: string;
  /** Render as something other than a div, to keep the markup semantic. */
  as?: ElementType;
};

/**
 * The single scroll-reveal wrapper for the whole storefront (DESIGN.md §5).
 *
 * Everything that appears on scroll goes through this rather than hand-rolling
 * `whileInView` per section, for one reason: timing consistency. A dozen
 * sections each choosing their own duration and offset reads as jitter, and
 * retuning it means finding and editing a dozen files. Here it is one file.
 *
 * `once: true` matters — re-animating on every scroll back up is the single
 * most common way a reveal effect turns from polish into an irritation.
 */
export function Reveal({
  children,
  className,
  variant = "fadeUp",
  delay = 0,
  margin = "-80px",
  as = "div",
}: RevealProps) {
  const MotionTag = motion[as as keyof typeof motion] as typeof motion.div;

  return (
    <MotionTag
      className={cn(className)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin }}
      variants={VARIANTS[variant] as Variants}
      transition={{ ...TRANSITION.default, delay }}
    >
      {children}
    </MotionTag>
  );
}

/**
 * Reveals children in sequence. Each child must be a `<StaggerItem>` (or any
 * motion element using the shared `hidden`/`visible` variant names).
 */
export function Stagger({
  children,
  className,
  margin = "-80px",
  as = "div",
}: Omit<RevealProps, "variant" | "delay">) {
  const MotionTag = motion[as as keyof typeof motion] as typeof motion.div;

  return (
    <MotionTag
      className={cn(className)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin }}
      variants={VARIANTS.stagger as Variants}
    >
      {children}
    </MotionTag>
  );
}

export function StaggerItem({
  children,
  className,
  variant = "fadeUp",
  as = "div",
}: Omit<RevealProps, "delay" | "margin">) {
  const MotionTag = motion[as as keyof typeof motion] as typeof motion.div;

  return (
    <MotionTag
      className={cn(className)}
      variants={VARIANTS[variant] as Variants}
      transition={TRANSITION.default}
    >
      {children}
    </MotionTag>
  );
}
