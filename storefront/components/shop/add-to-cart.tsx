"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { entryKey, useCart } from "@/lib/cart-store";
import { naira } from "@/lib/format";

/**
 * Add-to-cart for a specific machine.
 *
 * Because a serialized unit is one-of-a-kind, adding it twice is meaningless —
 * so once it is in the cart the button becomes a link to the cart rather than
 * silently doing nothing on a second press, which reads as a broken button.
 */
export function AddToCart({
  unitId,
  price,
  name,
}: {
  unitId: string;
  price: number;
  name: string;
}) {
  const { addUnit, has } = useCart();
  const inCart = has(entryKey({ product_unit_id: unitId, quantity: 1 }));

  if (inCart) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" variant="outline" className="flex-1">
          <Link href="/cart">
            <Check className="size-4" />
            In your cart — view cart
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button
        size="lg"
        className="flex-1"
        onClick={() => {
          addUnit(unitId);
          toast.success("Added to cart", {
            description: `${name} — ${naira(price)}`,
          });
        }}
      >
        Add to cart — {naira(price)}
      </Button>
    </div>
  );
}

/**
 * Add-to-cart for a quantity-tracked product (chargers, bags). Unlike a unit,
 * pressing again legitimately adds another one.
 */
export function AddProductToCart({
  productId,
  price,
  name,
}: {
  productId: string;
  price: number;
  name: string;
}) {
  const { addProduct } = useCart();

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button
        size="lg"
        className="flex-1"
        onClick={() => {
          addProduct(productId);
          toast.success("Added to cart", {
            description: `${name} — ${naira(price)}`,
          });
        }}
      >
        Add to cart — {naira(price)}
      </Button>
    </div>
  );
}
