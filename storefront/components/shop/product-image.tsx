import Image from "next/image";

import { LogoMark } from "@/components/brand/logo";
import type { ProductImage as ProductImageType } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Product photography, with a branded fallback.
 *
 * The fallback is not decoration: the catalogue is being built before the
 * client's photography has arrived (DESIGN.md §6), and a grid of broken image
 * icons makes it impossible to judge the layout. A ghosted logo on the tile
 * grey reads as intentional and keeps the card's proportions honest.
 */
export function ProductImage({
  image,
  alt,
  className,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw",
  priority = false,
}: {
  image?: ProductImageType | null;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (!image) {
    return (
      <div
        className={cn("bg-muted grid place-items-center", className)}
        role="img"
        aria-label={`${alt} — photograph coming soon`}
      >
        <LogoMark className="size-10 opacity-15" />
      </div>
    );
  }

  return (
    <Image
      src={image.url}
      alt={image.alt ?? alt}
      fill
      sizes={sizes}
      priority={priority}
      className={cn("object-contain", className)}
    />
  );
}
