"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, Sparkles, X } from "lucide-react";

export function PromoBanner() {
  const [isVisible, setIsVisible] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem("gg_promo_dismissed");
    if (dismissed) {
      setIsVisible(false);
    }
  }, []);

  function handleDismiss() {
    setIsVisible(false);
    sessionStorage.setItem("gg_promo_dismissed", "true");
  }

  function handleCopy() {
    navigator.clipboard.writeText("WELCOME5K");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!isVisible) return null;

  return (
    <div className="relative z-50 bg-neutral-950 px-4 py-2 text-center text-xs text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 sm:gap-3 flex-wrap">
        <span className="flex items-center gap-1.5 font-medium text-amber-400">
          <Sparkles className="size-3.5 shrink-0" />
          First-time buyer offer:
        </span>
        <span className="text-neutral-300">
          Get <strong>₦5,000 off</strong> your first laptop order over ₦150,000
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded bg-neutral-800 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-300 hover:bg-neutral-700 transition-colors"
          title="Click to copy code"
        >
          {copied ? (
            <>
              <Check className="size-3 text-emerald-400" />
              Copied!
            </>
          ) : (
            <>
              WELCOME5K
              <Copy className="size-2.5 opacity-70" />
            </>
          )}
        </button>

        <span className="hidden text-neutral-500 md:inline">•</span>
        <span className="hidden text-neutral-400 md:inline">
          Full 90-day hardware warranty on every machine
        </span>

        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-white transition-colors"
          aria-label="Dismiss announcement"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
