"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, Lock, Tag, X } from "lucide-react";

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
import { getCachedCustomer, fetchCustomerProfile } from "@/lib/customer-auth";
import { naira } from "@/lib/format";
import {
  placeOrder,
  resolveCart,
  ShopError,
  validateCoupon,
  type ResolvedCart,
} from "@/lib/shop-client";
import type { Customer, DeliveryZone } from "@/lib/types";

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
  const initialCoupon = searchParams.get("coupon") ?? "";
  const { entries, isReady, clear } = useCart();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [zone, setZone] = useState(zones[0]?.slug ?? "");
  const [cart, setCart] = useState<ResolvedCart | null>(null);
  const [pricedFor, setPricedFor] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<"full" | "layaway">("full");

  // Coupon state
  const [couponCodeInput, setCouponCodeInput] = useState(initialCoupon);
  const [appliedCoupon, setAppliedCoupon] = useState<string>(initialCoupon);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  // Load customer if logged in
  useEffect(() => {
    const cached = getCachedCustomer();
    if (cached) {
      setCustomer(cached);
    }
    fetchCustomerProfile().then((data) => {
      if (data?.customer) {
        setCustomer(data.customer);
      }
    });
  }, []);

  // Identifies the exact cart+zone+coupon combination the current totals belong to
  const priceKey = `${zone}|${appliedCoupon}|${entries.map((e) => `${e.product_unit_id ?? e.product_id}:${e.quantity}`).join(",")}`;

  /*
   * Re-price whenever the cart, chosen zone, or coupon changes.
   */
  useEffect(() => {
    if (!isReady || entries.length === 0) return;

    let cancelled = false;

    resolveCart(entries, zone, appliedCoupon || undefined, customer?.email)
      .then((resolved) => {
        if (cancelled) return;

        setCart(resolved);
        setPricedFor(priceKey);
        if (appliedCoupon && resolved.coupon && !resolved.coupon.valid) {
          setCouponError(resolved.coupon.error || "Coupon could not be applied.");
          setAppliedCoupon("");
        } else {
          setCouponError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFormError("We could not price your cart. Please refresh.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [entries, isReady, zone, appliedCoupon, priceKey, customer?.email]);

  const isPricing = pricedFor !== priceKey;

  useEffect(() => {
    if (isReady && entries.length === 0 && !isSubmitting) {
      router.replace("/cart");
    }
  }, [isReady, entries.length, isSubmitting, router]);

  async function handleApplyCoupon() {
    if (!couponCodeInput.trim()) return;
    setIsApplyingCoupon(true);
    setCouponError(null);

    try {
      const res = await validateCoupon(
        couponCodeInput.trim(),
        entries,
        zone,
        customer?.email,
      );
      setAppliedCoupon(res.code);
      setCouponError(null);
    } catch (err: any) {
      setCouponError(err.message || "Invalid coupon code.");
    } finally {
      setIsApplyingCoupon(false);
    }
  }

  function handleRemoveCoupon() {
    setAppliedCoupon("");
    setCouponCodeInput("");
    setCouponError(null);
  }

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
        coupon_code: appliedCoupon || undefined,
        payment_mode: paymentMode,
      });

      clear();
      router.push(`/order/${order.reference}`);
    } catch (error) {
      setIsSubmitting(false);

      if (error instanceof ShopError) {
        setErrors(error.errors);
        setFormError(error.message);

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
        {customer ? (
          <div className="border-border/60 bg-muted/30 flex items-center justify-between rounded-xl border p-4 text-sm">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="text-emerald-500 size-4" />
              Signed in as <strong>{customer.name}</strong> ({customer.email})
            </span>
            <Link href="/account" className="text-xs text-muted-foreground underline underline-offset-4">
              My account
            </Link>
          </div>
        ) : (
          <div className="border-border flex items-center justify-between rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
            <span>Already have an account? Sign in for instant autofill.</span>
            <Link href="/account/login" className="font-semibold text-foreground underline underline-offset-4">
              Sign in
            </Link>
          </div>
        )}

        <Fieldset title="Your details">
          <Field
            label="Full name"
            name="name"
            defaultValue={customer?.name ?? ""}
            errors={errors["contact.name"]}
            required
          />
          <Field
            label="Email"
            name="email"
            type="email"
            defaultValue={customer?.email ?? ""}
            errors={errors["contact.email"]}
            hint="Your receipt and order tracking go here."
            required
          />
          <Field
            label="Phone"
            name="phone"
            type="tel"
            defaultValue={customer?.phone ?? ""}
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

          <Field
            label="Street address"
            name="line1"
            placeholder="12 Oshitelu Street"
            errors={errors["address.line1"]}
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="City"
              name="city"
              placeholder="Ikeja"
              errors={errors["address.city"]}
              required
            />
            <Field
              label="State"
              name="state"
              placeholder="Lagos"
              errors={errors["address.state"]}
              required
            />
          </div>

          <Field
            label="Closest landmark"
            name="landmark"
            placeholder="Behind Computer Village Police Post"
            hint="Helps the courier find you faster."
            errors={errors["address.landmark"]}
          />

          <Field
            label="Delivery instructions"
            name="note"
            placeholder="Leave at reception, call on arrival, etc."
            errors={errors["address.note"]}
          />
        </Fieldset>

        <Fieldset title="How would you like to pay?">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4">
            <input type="radio" name="payment-mode" checked={paymentMode === "full"} onChange={() => setPaymentMode("full")} className="mt-1" />
            <span><span className="font-medium">Pay in full</span><span className="mt-1 block text-sm text-muted-foreground">Receive your private bank-transfer details for the complete amount.</span></span>
          </label>
          <label className={`flex items-start gap-3 rounded-xl border p-4 ${entries.length === 1 && entries[0]?.product_unit_id ? "cursor-pointer border-border" : "cursor-not-allowed border-border/60 opacity-60"}`}>
            <input type="radio" name="payment-mode" disabled={!(entries.length === 1 && entries[0]?.product_unit_id)} checked={paymentMode === "layaway"} onChange={() => setPaymentMode("layaway")} className="mt-1" />
            <span><span className="flex items-center gap-1.5 font-medium"><Clock3 className="size-4" />Reserve & pay gradually</span><span className="mt-1 block text-sm text-muted-foreground">Reserve one laptop for 30 days. Pay at least 20% today, then make secure payments whenever you are ready. We dispatch only after the full balance clears.</span>{!(entries.length === 1 && entries[0]?.product_unit_id) && <span className="mt-2 block text-xs text-muted-foreground">Available for one serialized laptop at a time.</span>}</span>
          </label>
        </Fieldset>
      </div>

      <aside className="lg:sticky lg:top-32 lg:self-start">
        <div className="border-border rounded-xl border p-5">
          <h2 className="text-xs font-semibold tracking-[0.14em] uppercase">
            Order summary
          </h2>

          {isPricing || !cart ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <>
              <ul className="border-border mt-4 divide-y text-xs">
                {cart.lines.map((line) => (
                  <li key={line.key} className="flex justify-between gap-4 py-2">
                    <span className="min-w-0 truncate">
                      {line.name}
                      {line.quantity > 1 && ` × ${line.quantity}`}
                    </span>
                    <span className="gg-numeric shrink-0 font-medium">
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
                {cart.discount_amount && cart.discount_amount > 0 ? (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                    <dt className="flex items-center gap-1.5">
                      <Tag className="size-3.5" />
                      Discount ({appliedCoupon})
                    </dt>
                    <dd className="gg-numeric">−{naira(cart.discount_amount)}</dd>
                  </div>
                ) : null}
              </dl>

              {/* Promo Code Input Box */}
              <div className="border-border mt-4 border-t pt-4">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Tag className="size-3.5" />
                      Code <strong>{appliedCoupon}</strong> applied
                    </span>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-muted-foreground hover:text-foreground ml-2"
                      title="Remove coupon"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Promo code (e.g. WELCOME5K)"
                        value={couponCodeInput}
                        onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                        className="h-8 text-xs font-mono"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleApplyCoupon}
                        disabled={isApplyingCoupon || !couponCodeInput.trim()}
                        className="h-8 text-xs shrink-0"
                      >
                        {isApplyingCoupon ? "Checking…" : "Apply"}
                      </Button>
                    </div>
                    {couponError && (
                      <p className="text-[11px] text-destructive">{couponError}</p>
                    )}
                  </div>
                )}
              </div>

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
            className="mt-5 w-full font-semibold"
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
            You will get bank transfer details on the next screen. {paymentMode === "layaway" ? "Your laptop is held for 30 days while you complete the balance." : "Your items are held for you until payment clears."}
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
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  hint?: string;
  placeholder?: string;
  errors?: string[];
  required?: boolean;
  defaultValue?: string;
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
        defaultValue={defaultValue}
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
