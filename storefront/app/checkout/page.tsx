import type { Metadata } from "next";
import { Suspense } from "react";

import { CheckoutForm } from "@/components/shop/checkout-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getDeliveryZones } from "@/lib/api";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Payment is completed before dispatch — we do not offer pay on delivery.
      </p>

      <Suspense fallback={<Skeleton className="mt-8 h-96 rounded-xl" />}>
        <Zones />
      </Suspense>
    </div>
  );
}

async function Zones() {
  const zones = await getDeliveryZones();

  return <CheckoutForm zones={zones} />;
}
