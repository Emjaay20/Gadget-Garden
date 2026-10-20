"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { ProductCard } from "@/components/shop/product-card";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * A horizontal product rail with arrow controls — the reference's "Hot Deal"
 * shelf (DESIGN.md §3, section 5).
 *
 * The homepage previously rendered two identical four-up grids back to back,
 * which read as filler rather than as two different shelves. A rail says
 * "there is more of this than fits", which is the actual message.
 *
 * The rail itself is a native overflow scroller, not a JS-driven transform:
 * touch and trackpad swipe work for free, it stays keyboard-navigable because it
 * is still a list of links, and nothing breaks if the JS is slow to arrive. The
 * arrows are the only thing JavaScript adds.
 */
export function ProductCarousel({
  products,
  label,
  priorityCount = 0,
  className,
}: {
  products: Product[];
  /** Names the scroll region for screen readers — e.g. "Featured machines". */
  label: string;
  priorityCount?: number;
  className?: string;
}) {
  const railRef = useRef<HTMLUListElement>(null);
  const reducedMotion = useReducedMotion();

  // Both true until measured: an un-scrollable rail should show no live arrows.
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const sync = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;

    // Sub-pixel widths mean scrollLeft rarely lands exactly on the bound, so
    // both ends get a pixel of tolerance. Without it the "next" arrow stays
    // enabled at the end of the rail and clicking it does nothing.
    const max = rail.scrollWidth - rail.clientWidth;

    setAtStart(rail.scrollLeft <= 1);
    setAtEnd(rail.scrollLeft >= max - 1);
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    sync();

    // Resize, not just scroll: the arrows' disabled state depends on how many
    // cards fit, which changes on rotate and on every breakpoint crossing.
    const observer = new ResizeObserver(sync);
    observer.observe(rail);

    return () => observer.disconnect();
  }, [sync]);

  const page = (direction: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;

    const card = rail.firstElementChild as HTMLElement | null;
    const stride = card
      ? card.getBoundingClientRect().width + GAP_PX
      : rail.clientWidth;

    // Target a card INDEX rather than adding a delta to the current position, so
    // a half-swiped rail lands square instead of inheriting the stray offset.
    const index = Math.round(rail.scrollLeft / stride) + direction;

    rail.scrollTo({
      left: index * stride,
      /*
        Smooth scrolling is motion no stylesheet can reach: the reduced-motion
        guard in globals.css neutralises transitions and keyframes, and this is
        neither. So the branch has to be here, the same division of labour as
        MotionConfig vs the CSS guard elsewhere in the app.
      */
      behavior: reducedMotion ? "auto" : "smooth",
    });
  };

  if (products.length === 0) return null;

  return (
    <div className={cn("relative", className)}>
      <ul
        ref={railRef}
        onScroll={sync}
        role="region"
        aria-label={label}
        className={cn(
          /*
            `proximity`, not `mandatory`. The arrows already land on exact card
            offsets, so snapping only has to tidy up after a swipe — and
            mandatory does that by refusing to rest anywhere else, which on a
            trackpad fights the user for every small scroll.
          */
          "flex snap-x snap-proximity gap-4 overflow-x-auto pb-2",
          // The rail's own scrollbar would sit under the cards and fight the
          // arrows. The rail is still scrollable by every other means.
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {products.map((product, index) => (
          <li
            key={product.id}
            className="w-[78%] shrink-0 snap-start sm:w-[45%] lg:w-[31.5%] xl:w-[23.5%]"
          >
            <ProductCard product={product} priority={index < priorityCount} />
          </li>
        ))}
      </ul>

      <RailButton
        side="left"
        disabled={atStart}
        onClick={() => page(-1)}
        label={`Scroll ${label} back`}
      />
      <RailButton
        side="right"
        disabled={atEnd}
        onClick={() => page(1)}
        label={`Scroll ${label} forward`}
      />
    </div>
  );
}

/** Must match the `gap-4` on the rail, in pixels — it is part of one card's stride. */
const GAP_PX = 16;

/**
 * Hidden below `md` on purpose: on a touch screen the swipe is the control, and
 * an overlay button there only covers a product image.
 */
function RailButton({
  side,
  disabled,
  onClick,
  label,
}: {
  side: "left" | "right";
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "border-border bg-background text-foreground absolute top-[38%] z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full border shadow-md transition md:grid",
        "hover:bg-accent focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        // Fades rather than disappearing, so the rail does not reflow visually
        // when you reach an end mid-scroll.
        disabled && "pointer-events-none opacity-0",
        side === "left" ? "-left-4" : "-right-4",
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}
