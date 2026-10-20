"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Lock, Tag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/lib/cart-store";
import { naira } from "@/lib/format";
import {
  placeOrder,
  resolveCart,
  ShopError,
  type ResolvedCart,
} from "@/lib/shop-client";
import type { DeliveryZone } from "@/lib/types";

/**
 * Checkout.
 *
 * NOTHING FINANCIAL IS SUBMITTED. The form sends contact details, an address and
 * a zone slug; the server prices every line and computes delivery itself. There
 * is no total in the request body because there is nowhere for it to go.
 *
 * The totals shown update from the server as the zone changes, so what the
 * customer sees is what the server will charge — not a client-side estimate
 * that might disagree.
 */
export function CheckoutForm({ zones }: { zones: DeliveryZone[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const offerReference = searchParams.get("offer") ?? "";
  const { entries, isReady, clear } = useCart();

  const [zone, setZone] = useState(zones[0]?.slug ?? "");
  const [cart, setCart] = useState<ResolvedCart | null>(null);
  const [pricedFor, setPricedFor] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Identifies the exact cart+zone combination the current totals belong to, so
  // "are these totals current?" is derivable rather than tracked in a flag.
  const priceKey = `${zone}|${entries.map((e) => `${e.product_unit_id ?? e.product_id}:${e.quantity}`).join(",")}`;

  /*
   * Re-price whenever the cart or the chosen zone changes.
   *
   * All setState happens in async callbacks — never synchronously in the effect
   * body, which would cascade renders (and which React 19's linter refuses).
   * "Still pricing" is derived from `pricedFor !== priceKey` below.
   */
  useEffect(() => {
    if (!isReady || entries.length === 0) return;

    let cancelled = false;

    resolveCart(entries, zone)
      .then((resolved) => {
        if (cancelled) return;

        setCart(resolved);
        setPricedFor(priceKey);
      })
      .catch(() => {
        if (!cancelled) {
          setFormError("We could not price your cart. Please refresh.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [entries, isReady, zone, priceKey]);

  // The displayed totals are only trustworthy when they were computed for the
  // cart and zone currently selected.
  const isPricing = pricedFor !== priceKey;

  // An empty cart has nothing to check out. Send them back rather than
  // rendering a form that cannot submit.
  useEffect(() => {
    if (isReady && entries.length === 0 && !isSubmitting) {
      router.replace("/cart");
    }
  }, [isReady, entries.length, isSubmitting, router]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setErrors({});
    setFormError(null);

    const form = new FormData(event.currentTarget);

    try {
      const order = await placeOrder({
        items: entries,
        contact: {
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          phone: String(form.get("phone") ?? ""),
        },
        delivery_zone: zone,
        address: {
          line1: String(form.get("line1") ?? ""),
          city: String(form.get("city") ?? ""),
          state: String(form.get("state") ?? ""),
          landmark: String(form.get("landmark") ?? "") || undefined,
          note: String(form.get("note") ?? "") || undefined,
        },
        offer_reference: offerReference || undefined,
      });

      /*
       | The cart is cleared only AFTER the order exists. Clearing optimistically
       | would lose the customer's basket if checkout failed — and on serialized
       | stock they could not simply re-add it, because the reservation attempt
       | that failed may have been the last machine.
       */
      clear();
      router.push(`/order/${order.reference}`);
    } catch (error) {
      setIsSubmitting(false);

      if (error instanceof ShopError) {
        setErrors(error.errors);
        setFormError(error.message);

        // A 422 carrying lines means something sold mid-checkout. Send them
        // back to the cart, which shows exactly which line failed.
        if (error.lines) {
          router.push("/cart");
        }

        return;
      }

      setFormError("Something went wrong. Please try again.");
    }
  }

  const selectedZone = zones.find((z) => z.slug === zone);

  return (
    <form onSubmit={onSubmit} className="mt-8 grid gap-10 lg:grid-cols-[1fr_340px]">
      <div className="space-y-8">
        <Fieldset title="Your details">
          <Field label="Full name" name="name" errors={errors["contact.name"]} required />
          <Field
            label="Email"
            name="email"
            type="email"
            errors={errors["contact.email"]}
            hint="Your receipt and payment details go here."
            required
          />
          <Field
            label="Phone"
            name="phone"
            type="tel"
            placeholder="0805 694 7271"
            errors={errors["contact.phone"]}
            required
          />
        </Fieldset>

        <Fieldset title="Delivery">
          <div className="grid gap-2">
            <Label htmlFor="zone">Delivery area</Label>
            <Select value={zone} onValueChange={setZone}>
              <SelectTrigger id="zone" className="w-full">
                <SelectValue placeholder="Choose an area" />
              </SelectTrigger>
              <SelectContent>
                {zones.map((option) => (
                  <SelectItem key={option.slug} value={option.slug}>
                    {option.name} — {option.fee === 0 ? "Free" : naira(option.fee)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedZone?.free_above ? (
              <p className="text-muted-foreground text-xs">
                Free delivery on orders over {naira(selectedZone.free_above)}.
              </p>
            ) : null}
          </div>

          <Field label="Address" name="line1" errors={errors["address.line1"]} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City" name="city" errors={errors["address.city"]} required />
            <Field label="State" name="state" errors={errors["address.state"]} required />
          </div>
          <Field
            label="Nearest landmark"
            name="landmark"
            hint="Optional, but it genuinely helps the rider find you."
          />
          <Field label="Delivery note" name="note" hint="Optional." />
        </Fieldset>
      </div>

      <aside className="lg:sticky lg:top-32 lg:self-start">
        <div className="border-border rounded-xl border p-5">
          <h2 className="text-xs font-semibold tracking-[0.14em] uppercase">
            Order summary
          </h2>

          {isPricing || !cart ? (
            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : (
            <>
              <ul className="mt-4 space-y-2 text-sm">
                {cart.lines.map((line) => (
                  <li key={line.key} className="flex justify-between gap-4">
                    <span className="min-w-0 truncate">
                      {line.name}
                      {line.quantity > 1 && ` × ${line.quantity}`}
                    </span>
                    <span className="gg-numeric shrink-0">
                      {naira(line.line_total)}
                    </span>
                  </li>
                ))}
              </ul>

              <dl className="border-border mt-4 space-y-2 border-t pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="gg-numeric">{naira(cart.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Delivery</dt>
                  <dd className="gg-numeric">
                    {cart.delivery_fee === 0 ? "Free" : naira(cart.delivery_fee)}
                  </dd>
                </div>
              </dl>

              {offerReference ? (
                <div className="mt-3 flex items-center justify-between rounded-md bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-800 dark:text-emerald-300">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Tag className="size-3.5" />
                    Offer {offerReference}
                  </span>
                  <span className="text-[10px] font-semibold tracking-wider uppercase">
                    Agreed price locked
                  </span>
                </div>
              ) : null}

              <div className="border-border mt-4 flex justify-between border-t pt-4">
                <span className="font-semibold">Total</span>
                <span className="gg-numeric text-lg font-semibold">
                  {naira(cart.total)}
                </span>
              </div>
            </>
          )}

          {formError && (
            <div className="border-destructive/30 bg-destructive/5 mt-4 flex items-start gap-2 rounded-lg border p-3">
              <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" />
              <p className="text-sm text-pretty">{formError}</p>
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="mt-5 w-full"
            disabled={isSubmitting || isPricing || !cart || cart.has_problems}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Placing order…
              </>
            ) : (
              <>
                <Lock className="size-4" />
                Place order
              </>
            )}
          </Button>

          <p className="text-muted-foreground mt-3 text-xs text-pretty">
            You will get bank transfer details on the next screen. Your items are
            held for you until payment clears.
          </p>

          <p className="text-muted-foreground mt-2 text-xs">
            <Link href="/cart" className="underline underline-offset-4">
              Back to cart
            </Link>
          </p>
        </div>
      </aside>
    </form>
  );
}

function Fieldset({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-4 text-xs font-semibold tracking-[0.14em] uppercase">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  name,
  type = "text",
  hint,
  placeholder,
  errors,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  hint?: string;
  placeholder?: string;
  errors?: string[];
  required?: boolean;
}) {
  const id = `field-${name}`;
  const describedBy = [hint && `${id}-hint`, errors?.length && `${id}-error`]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>
        {label}
        {!required && (
          <span className="text-muted-foreground font-normal"> (optional)</span>
        )}
      </Label>
      <Input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy || undefined}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </p>
      )}
      {errors?.length ? (
        <p id={`${id}-error`} className="text-destructive text-xs">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}
