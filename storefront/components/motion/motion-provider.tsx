"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Wraps the app so every Framer Motion animation honours the OS reduced-motion
 * setting.
 *
 * The CSS guard in globals.css cannot do this on its own: it neutralises CSS
 * transitions and keyframes, but Framer Motion drives values from JavaScript and
 * writes them straight to the element, so it sails past any stylesheet rule.
 * `reducedMotion="user"` makes it drop transform and opacity animations to their
 * end state while leaving layout projection intact.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={TRANSITION.default}>
      {children}
    </MotionConfig>
  );
}

/**
 * The house timing scale. Every animation in the storefront picks from here
 * rather than inventing its own numbers, so retuning the feel of the site is a
 * change to this object and nothing else.
 *
 * The easing is the Behance reference's character: a fast start that settles
 * rather than bouncing — confident, not playful.
 */
export const TRANSITION = {
  /** Most things. */
  default: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  /** Hover and press feedback — must feel instant. */
  snap: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
  /** Entrances that carry weight: the hero, a confirmed order. */
  grand: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
  /** Sheets, dialogs, anything with a spatial origin. */
  spring: { type: "spring", stiffness: 260, damping: 30 },
} as const;

/**
 * Shared variants. `hidden`/`visible` names are a convention across the app so a
 * parent can orchestrate children it does not know the internals of.
 */
export const VARIANTS = {
  fadeUp: {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0 },
  },
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
  scaleIn: {
    hidden: { opacity: 0, scale: 0.96 },
    visible: { opacity: 1, scale: 1 },
  },
  /**
   * A parent that staggers its children. Children must use one of the variants
   * above; the parent animates nothing itself.
   */
  stagger: {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.08, delayChildren: 0.1 },
    },
  },
} as const;
