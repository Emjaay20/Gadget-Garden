"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

import { ConditionBadge } from "@/components/brand/condition-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/lib/cart-store";
import { naira, specSummary } from "@/lib/format";
import { resolveCart, type ResolvedCart } from "@/lib/shop-client";
import { cn } from "@/lib/utils";

/**
 * The cart.
 *
 * Every figure here comes from the SERVER, re-read on each render, because the
 * local cart holds only identifiers. That is what lets this page say "someone
 * bought this while it was in your cart" before the customer types an address,
 * which on one-of-a-kind stock is the difference between a good experience and
 * a refund.
 */
export function CartView() {
  const { entries, isReady, setQuantity, remove } = useCart();
  const [cart, setCart] = useState<ResolvedCart | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isEmpty = entries.length === 0;

  /*
   * Every setState here happens inside an async callback, never synchronously in
   * the effect body. Synchronous setState during an effect cascades an extra
   * render pass, and React 19's linter refuses it — so the empty and loading
   * cases are DERIVED below rather than stored.
   */
  useEffect(() => {
    if (!isReady || isEmpty) return;

    let cancelled = false;

    resolveCart(entries)
      .then((resolved) => {
        // The cart may have changed again while this was in flight; a late
        // response must not overwrite newer state.
        if (!cancelled) {
          setCart(resolved);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("We could not load your cart. Please refresh.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [entries, isReady, isEmpty]);

  if (!isReady) {
    return <CartSkeleton />;
  }

  if (isEmpty) {
    return <EmptyCart />;
  }

  if (error) {
    return <p className="text-muted-foreground mt-10">{error}</p>;
  }

  // Derived, not stored: nothing resolved yet means we are still loading.
  if (!cart) {
    return <CartSkeleton />;
  }

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        {cart.has_problems && (
          <div className="border-destructive/30 bg-destructive/5 flex items-start gap-3 rounded-xl border p-4">
            <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" />
            <p className="text-sm text-pretty">
              Some items are no longer available. Stock moves fast — remove them
              to continue.
            </p>
          </div>
        )}

        {cart.lines.map((line) => (
          <article
            key={line.key}
            className={cn(
              "border-border flex gap-4 rounded-xl border p-4",
              !line.is_available && "border-destructive/30 bg-destructive/5",
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {line.condition && (
                  <ConditionBadge condition={line.condition} size="sm" />
                )}
                {line.sku && (
                  <span className="text-muted-foreground gg-numeric text-[11px]">
                    {line.sku}
                  </span>
                )}
              </div>

              <h2 className="mt-1.5 font-semibold">
                <Link
                  href={`/product/${line.product_slug}`}
                  className="hover:underline"
                >
                  {line.name}
                </Link>
              </h2>

              {specSummary(line.specs) && (
                <p className="text-muted-foreground gg-numeric mt-0.5 text-xs">
                  {specSummary(line.specs)}
                </p>
              )}

              {line.problem && (
                <p className="text-destructive mt-2 text-sm">{line.problem}</p>
              )}

              <div className="mt-3 flex items-center gap-3">
                {/* Serialized machines have no quantity — there is one. */}
                {line.product_unit_id === null && line.is_available ? (
                  <QuantityStepper
                    quantity={line.quantity}
                    onChange={(next) => setQuantity(line.key, next)}
                  />
                ) : null}

                <button
                  type="button"
                  onClick={() => remove(line.key)}
                  className="text-muted-foreground hover:text-destructive flex items-center gap-1.5 text-xs transition-colors"
                >
                  <Trash2 className="size-3.5" />
                  Remove
                </button>
              </div>
            </div>

            <div className="text-right">
              <p className="gg-numeric font-semibold">{naira(line.line_total)}</p>
              {line.quantity > 1 && (
                <p className="text-muted-foreground gg-numeric mt-0.5 text-xs">
                  {naira(line.unit_price)} each
                </p>
              )}
            </div>
          </article>
        ))}
      </div>

      <aside className="lg:sticky lg:top-32 lg:self-start">
        <div className="border-border rounded-xl border p-5">
          <h2 className="text-xs font-semibold tracking-[0.14em] uppercase">
            Summary
          </h2>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="gg-numeric font-medium">{naira(cart.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Delivery</dt>
              <dd className="text-muted-foreground">Calculated at checkout</dd>
            </div>
          </dl>

          <div className="border-border mt-4 flex justify-between border-t pt-4">
            <span className="font-semibold">Total</span>
            <span className="gg-numeric text-lg font-semibold">
              {naira(cart.subtotal)}
            </span>
          </div>

          <Button
            asChild={!cart.has_problems && cart.subtotal > 0}
            className="mt-5 w-full"
            size="lg"
            disabled={cart.has_problems || cart.subtotal === 0}
          >
            {!cart.has_problems && cart.subtotal > 0 ? (
              <Link href="/checkout">Checkout</Link>
            ) : (
              <span>Checkout</span>
            )}
          </Button>

          <p className="text-muted-foreground mt-3 text-xs text-pretty">
            Payment is completed before dispatch. We do not offer pay on
            delivery.
          </p>
        </div>
      </aside>
    </div>
  );
}

function QuantityStepper({
  quantity,
  onChange,
}: {
  quantity: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="border-input flex items-center rounded-full border">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(quantity - 1)}
        className="hover:bg-accent grid size-7 place-items-center rounded-full"
      >
        <Minus className="size-3" />
      </button>
      <span className="gg-numeric w-8 text-center text-sm font-medium">
        {quantity}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(quantity + 1)}
        className="hover:bg-accent grid size-7 place-items-center rounded-full"
      >
        <Plus className="size-3" />
      </button>
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="border-border mt-10 rounded-xl border border-dashed py-20 text-center">
      <ShoppingBag className="text-muted-foreground mx-auto size-8" />
      <h2 className="mt-4 font-semibold">Your cart is empty</h2>
      <p className="text-muted-foreground mx-auto mt-2 max-w-xs text-sm text-pretty">
        Machines move quickly here — have a look at what is in stock today.
      </p>
      <Button asChild className="mt-6">
        <Link href="/shop">Browse laptops</Link>
      </Button>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        {[0, 1].map((index) => (
          <div key={index} className="border-border rounded-xl border p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-5 w-2/3" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </div>
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
