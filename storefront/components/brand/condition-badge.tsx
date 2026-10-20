import { CONDITION_LABEL, type Condition } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * New / Foreign used / Refurbished.
 *
 * This is the first thing a buyer of used hardware looks for, so it is a
 * first-class component with semantic tokens rather than an ad-hoc badge colour
 * chosen per screen. The Behance reference has no equivalent — it sells new
 * stock — so this is ours (DESIGN.md §4).
 *
 * Colour alone never carries the meaning: the label is always rendered.
 */
export function ConditionBadge({
  condition,
  className,
  size = "default",
}: {
  condition: Condition;
  className?: string;
  size?: "default" | "sm";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        TONE[condition],
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full", DOT[condition])}
      />
      {CONDITION_LABEL[condition]}
    </span>
  );
}

/*
  Tinted rather than solid: a full-strength fill on every card in a grid would
  compete with the product photography, which is what should be drawing the eye.
  `current` on the border keeps the ring in step with the text colour.
*/
const TONE: Record<Condition, string> = {
  new: "border-condition-new/30 bg-condition-new/10 text-condition-new",
  foreign_used: "border-condition-used/30 bg-condition-used/10 text-condition-used",
  refurbished:
    "border-condition-refurb/30 bg-condition-refurb/10 text-condition-refurb",
};

const DOT: Record<Condition, string> = {
  new: "bg-condition-new",
  foreign_used: "bg-condition-used",
  refurbished: "bg-condition-refurb",
};
