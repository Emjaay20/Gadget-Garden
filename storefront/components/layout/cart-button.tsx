"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";

import { useCart } from "@/lib/cart-store";

/**
 * Cart link with a count badge.
 *
 * The badge is suppressed until the persisted cart has been read (`isReady`).
 * Rendering "0" first and then flicking to "2" is worse than rendering nothing
 * — and on the server the count is always 0, so showing it unconditionally
 * would also be a hydration mismatch.
 */
export function CartButton() {
  const { count, isReady } = useCart();

  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart"}
      className="hover:bg-accent relative grid size-9 place-items-center rounded-full"
    >
      <ShoppingBag className="size-4" />

      {isReady && count > 0 && (
        <span className="bg-primary text-primary-foreground gg-numeric absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold">
          {count}
        </span>
      )}
    </Link>
  );
}
