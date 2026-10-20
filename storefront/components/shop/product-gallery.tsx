"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Eye, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { LogoMark } from "@/components/brand/logo";
import type { ProductImage } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  productName: string;
  images: ProductImage[];
  className?: string;
};

export function ProductGallery({ productName, images, className }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const total = images.length;

  const prevImage = useCallback(() => {
    if (total <= 1) return;
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
  }, [total]);

  const nextImage = useCallback(() => {
    if (total <= 1) return;
    setActiveIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
  }, [total]);

  // Keyboard navigation: listen for ArrowLeft and ArrowRight
  useEffect(() => {
    if (total <= 1) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept if user is typing in an input or textarea
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevImage();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        nextImage();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [total, prevImage, nextImage]);

  // Touch swipe support for mobile
  function handleTouchStart(e: React.TouchEvent) {
    setTouchStartX(e.touches[0].clientX);
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX === null || total <= 1) return;
    const touchEndX = e.changedTouches[0].clientX;
    const delta = touchStartX - touchEndX;

    if (delta > 40) {
      nextImage(); // Swiped left -> next
    } else if (delta < -40) {
      prevImage(); // Swiped right -> prev
    }
    setTouchStartX(null);
  }

  if (total === 0) {
    return (
      <div className={cn("lg:sticky lg:top-32 lg:self-start", className)}>
        <div className="bg-muted relative aspect-[4/3] overflow-hidden rounded-2xl flex flex-col items-center justify-center border border-border/60">
          <LogoMark className="size-16 opacity-20" />
          <p className="text-muted-foreground text-xs mt-3">Photograph coming soon</p>
        </div>
      </div>
    );
  }

  const activeImage = images[activeIndex] ?? images[0];

  return (
    <div className={cn("lg:sticky lg:top-32 lg:self-start select-none", className)}>
      {/* Main Showcase Stage */}
      <div
        className="group relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border/60 bg-muted/30 shadow-sm"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeImage.id ?? activeIndex}
            initial={{ opacity: 0.4, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0.2, scale: 1.02 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="absolute inset-0 p-6 sm:p-10"
          >
            <Image
              src={activeImage.url}
              alt={activeImage.alt ?? `${productName} view ${activeIndex + 1}`}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              priority={activeIndex === 0}
              className="object-contain"
            />
          </motion.div>
        </AnimatePresence>

        {/* Previous Arrow Button */}
        {total > 1 && (
          <button
            type="button"
            onClick={prevImage}
            aria-label="Previous product image (Arrow Left)"
            className="absolute left-3 top-1/2 -translate-y-1/2 flex size-10 items-center justify-center rounded-full border border-border/60 bg-background/85 text-foreground shadow-md backdrop-blur-md transition-all hover:scale-105 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95"
          >
            <ChevronLeft className="size-5" />
          </button>
        )}

        {/* Next Arrow Button */}
        {total > 1 && (
          <button
            type="button"
            onClick={nextImage}
            aria-label="Next product image (Arrow Right)"
            className="absolute right-3 top-1/2 -translate-y-1/2 flex size-10 items-center justify-center rounded-full border border-border/60 bg-background/85 text-foreground shadow-md backdrop-blur-md transition-all hover:scale-105 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95"
          >
            <ChevronRight className="size-5" />
          </button>
        )}

        {/* Counter & Keyboard Hint Pill */}
        {total > 1 && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-border/60 bg-background/85 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm backdrop-blur-md">
            <span>
              {activeIndex + 1} / {total}
            </span>
            <span className="text-muted-foreground hidden sm:inline">
              · Use ← → keys
            </span>
          </div>
        )}
      </div>

      {/* Interactive Thumbnails Rail */}
      {total > 1 && (
        <div className="mt-3.5 flex flex-wrap gap-2.5 sm:gap-3">
          {images.map((image, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={image.id ?? index}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Show photo ${index + 1} of ${total}`}
                className={cn(
                  "relative aspect-square w-16 sm:w-20 overflow-hidden rounded-xl border bg-muted/40 transition-all",
                  isActive
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background border-primary shadow-sm scale-[1.03]"
                    : "border-border/80 opacity-70 hover:opacity-100 hover:border-foreground/30",
                )}
              >
                <Image
                  src={image.url}
                  alt={image.alt ?? `${productName} thumbnail ${index + 1}`}
                  fill
                  sizes="80px"
                  className="object-contain p-1.5"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
