"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Laptop,
  LogOut,
  MessageCircle,
  Package,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Truck,
  Heart,
} from "lucide-react";

import { ConditionBadge } from "@/components/brand/condition-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  clearCustomerSession,
  fetchCustomerOrders,
  fetchCustomerProfile,
  getCachedCustomer,
} from "@/lib/customer-auth";
import { naira, specSummary } from "@/lib/format";
import type { Customer, Order } from "@/lib/types";

export default function CustomerAccountPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const cached = getCachedCustomer();
    if (!cached) {
      router.replace("/account/login");
      return;
    }
    setCustomer(cached);

    Promise.all([fetchCustomerProfile(), fetchCustomerOrders()])
      .then(([profileData, ordersData]) => {
        if (!profileData) {
          router.replace("/account/login");
          return;
        }
        setCustomer(profileData.customer);
        setOrders(ordersData);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [router]);

  function handleLogout() {
    clearCustomerSession();
    router.push("/");
  }

  if (isLoading || !customer) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
      {/* Account Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">{customer.name}</h1>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              Verified Shopper
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {customer.email} • {customer.phone}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/shop">
              <ShoppingBag className="size-4 mr-1.5" />
              Browse laptops
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/wishlist"><Heart className="size-4 mr-1.5" />Wishlist</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
            <LogOut className="size-4 mr-1.5" />
            Sign out
          </Button>
        </div>
      </div>

      {/* Orders Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Your orders</h2>
          <span className="text-xs text-muted-foreground">{orders.length} total</span>
        </div>

        {orders.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border p-12 text-center">
            <Laptop className="mx-auto size-12 text-muted-foreground/60" />
            <h3 className="mt-4 font-semibold text-lg">No orders yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your purchased machines, receipts, and warranties will appear here.
            </p>
            <Button asChild className="mt-6">
              <Link href="/shop">Explore available laptops</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {orders.map((order) => {
              const isDelivered = order.status === "delivered";
              const isPaid = ["paid", "processing", "shipped", "delivered"].includes(order.status);

              return (
                <div
                  key={order.reference}
                  className="rounded-2xl border border-border bg-card p-6 shadow-xs"
                >
                  {/* Order Top Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Order
                        </span>
                        <strong className="gg-numeric font-semibold text-foreground">
                          {order.reference}
                        </strong>
                      </div>
                      {order.placed_at && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Placed on {new Date(order.placed_at).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <StatusBadge status={order.status} label={order.status_label} />
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/order/${order.reference}`}>
                          Track order
                          <ExternalLink className="size-3.5 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="mt-4 divide-y divide-border/60">
                    {order.items?.map((item, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3">
                        <div>
                          <div className="flex items-center gap-2">
                            {item.condition && <ConditionBadge condition={item.condition} size="sm" />}
                            {item.sku && (
                              <span className="text-[11px] font-mono text-muted-foreground">
                                {item.sku}
                              </span>
                            )}
                          </div>
                          <p className="font-semibold text-sm mt-1">{item.name}</p>
                          {specSummary(item.specs) && (
                            <p className="text-xs text-muted-foreground gg-numeric mt-0.5">
                              {specSummary(item.specs)}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="gg-numeric font-semibold">{naira(item.line_total)}</span>
                          {item.quantity > 1 && (
                            <span className="text-xs text-muted-foreground block">
                              {item.quantity} × {naira(item.unit_price)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Price Totals & Coupon */}
                  <div className="mt-4 border-t border-border pt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-3">
                      {order.coupon_code && (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-1 font-medium text-emerald-700 dark:text-emerald-300">
                          <Tag className="size-3" />
                          Code {order.coupon_code} applied (−{naira(order.discount_amount ?? 0)})
                        </span>
                      )}
                      {order.address?.city && (
                        <span className="text-muted-foreground">
                          Delivery to {order.address.city}, {order.address.state}
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-muted-foreground mr-2">Total Paid:</span>
                      <strong className="gg-numeric text-base text-foreground font-semibold">
                        {naira(order.total)}
                      </strong>
                    </div>
                  </div>

                  {/* Digital Warranty Card for Paid / Delivered orders */}
                  {isPaid && (
                    <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-sm text-emerald-900 dark:text-emerald-200">
                                90-Day Hardware Warranty Active
                              </h4>
                              <span className="rounded-full bg-emerald-600/20 px-2 py-0.2 text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                                Certified
                              </span>
                            </div>
                            <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
                              Covers motherboard, processor, screen, and battery health. Free repair or unit swap within Ikeja shop warranty window.
                            </p>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="shrink-0 border-emerald-500/30 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/10"
                        >
                          <a
                            href={`https://wa.me/2348000000000?text=Hello%20Gadgets%20Garden,%20I%20have%20a%20warranty%20inquiry%20regarding%20order%20${order.reference}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageCircle className="size-3.5 mr-1" />
                            WhatsApp Support
                          </a>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  if (status === "delivered") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="size-3.5" />
        {label}
      </span>
    );
  }

  if (status === "shipped") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
        <Truck className="size-3.5" />
        {label}
      </span>
    );
  }

  if (status === "processing") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
        <Package className="size-3.5" />
        {label}
      </span>
    );
  }

  if (status === "paid") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300">
        <CheckCircle2 className="size-3.5" />
        {label}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
      <Clock className="size-3.5" />
      {label}
    </span>
  );
}
