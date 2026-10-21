"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getCustomerToken, saveWishlistItem } from "@/lib/customer-auth";

export function SaveToWishlist({ productId }: { productId: string }) {
  const router = useRouter();

  async function save() {
    if (!getCustomerToken()) {
      toast.message("Sign in to save a wishlist", { action: { label: "Sign in", onClick: () => router.push("/account/login") } });
      return;
    }

    try {
      await saveWishlistItem(productId);
      toast.success("Saved to your wishlist");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not save that item.");
    }
  }

  return (
    <Button type="button" variant="outline" size="lg" className="mt-3 w-full" onClick={save}>
      <Heart className="size-4" />
      Save to wishlist
    </Button>
  );
}
