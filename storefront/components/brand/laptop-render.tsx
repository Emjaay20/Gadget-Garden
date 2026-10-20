import { cn } from "@/lib/utils";

/**
 * A line-art laptop stroked with the brand gradient.
 *
 * This exists because the hero's job in the reference (DESIGN.md §3) is to put a
 * machine next to the copy, and the client's photography has not arrived yet
 * (§6). The catalogue card's fallback — a ghosted logo on tile grey — is right at
 * card size but reads as a missing asset when it is 400px wide and the first
 * thing on the page. A drawn machine reads as a decision.
 *
 * It carries no image weight, and it is deleted the day a real hero shot lands.
 *
 * The screen glow uses the magenta from `--gg-aurora` rather than the mark's own
 * range: this sits inside the hero, which is the one place DESIGN.md §2 allows
 * the refraction streak to appear.
 */
export function LaptopRender({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 340 214"
      fill="none"
      role="img"
      aria-label="Illustration of an open laptop"
      className={cn("h-auto w-full", className)}
    >
      <defs>
        {/*
          `var()` goes through `style` rather than the `stop-color` attribute.
          Presentation attributes are meant to resolve custom properties, but the
          support is uneven enough that the inline style is the safe form — and
          it keeps the illustration on the same tokens as everything else, so a
          change to `--gg-teal` reaches here too.
        */}
        <linearGradient id="gg-laptop-edge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" style={{ stopColor: "var(--gg-teal)" }} />
          <stop offset="22%" style={{ stopColor: "var(--gg-cyan)" }} />
          <stop offset="46%" style={{ stopColor: "var(--gg-sky)" }} />
          <stop offset="76%" style={{ stopColor: "var(--gg-blue)" }} />
          <stop offset="100%" style={{ stopColor: "var(--gg-indigo)" }} />
        </linearGradient>

        <linearGradient id="gg-laptop-glow" x1="0" y1="0" x2="1" y2="1">
          <stop
            offset="0%"
            style={{ stopColor: "var(--gg-indigo)", stopOpacity: 0.42 }}
          />
          <stop
            offset="55%"
            style={{ stopColor: "var(--gg-blue)", stopOpacity: 0.14 }}
          />
          <stop
            offset="100%"
            style={{ stopColor: "var(--gg-magenta)", stopOpacity: 0.26 }}
          />
        </linearGradient>

        <linearGradient id="gg-laptop-streak" x1="0" y1="0" x2="1" y2="0">
          <stop
            offset="0%"
            style={{ stopColor: "var(--gg-cyan)", stopOpacity: 0 }}
          />
          <stop
            offset="50%"
            style={{ stopColor: "var(--gg-cyan)", stopOpacity: 0.7 }}
          />
          <stop
            offset="100%"
            style={{ stopColor: "var(--gg-magenta)", stopOpacity: 0 }}
          />
        </linearGradient>
      </defs>

      {/* Contact shadow, so the machine sits on something. */}
      <ellipse
        cx="170"
        cy="196"
        rx="128"
        ry="10"
        fill="url(#gg-laptop-glow)"
        opacity="0.5"
      />

      {/* Lid */}
      <rect
        x="76"
        y="14"
        width="188"
        height="134"
        rx="11"
        stroke="url(#gg-laptop-edge)"
        strokeWidth="2"
      />
      <rect x="86" y="24" width="168" height="106" rx="5" fill="url(#gg-laptop-glow)" />

      {/* The refracted-light streak across the panel. */}
      <path
        d="M92 118 L214 30"
        stroke="url(#gg-laptop-streak)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M132 124 L248 40"
        stroke="url(#gg-laptop-streak)"
        strokeWidth="1.25"
        strokeLinecap="round"
        opacity="0.6"
      />

      {/* Camera dot */}
      <circle cx="170" cy="19.5" r="1.75" fill="url(#gg-laptop-edge)" />

      {/* Base, in perspective */}
      <path
        d="M70 152 H270 L300 182 H40 Z"
        stroke="url(#gg-laptop-edge)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Trackpad lip */}
      <path
        d="M150 172 H196"
        stroke="url(#gg-laptop-edge)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}
