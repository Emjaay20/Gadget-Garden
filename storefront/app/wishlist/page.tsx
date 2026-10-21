"use client";

import Link from "next/link";
import { Copy, Heart, Loader2, Share2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchWishlist, getCachedCustomer, removeWishlistItem, updateWishlist } from "@/lib/customer-auth";
import { naira } from "@/lib/format";
import type { Wishlist } from "@/lib/types";

export default function WishlistPage() {
  const [wishlist, setWishlist] = useState<Wishlist | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getCachedCustomer()) {
      window.location.assign("/account/login");
      return;
    }
    fetchWishlist().then(setWishlist).catch((error) => toast.error(error.message)).finally(() => setLoading(false));
  }, []);

  async function update(input: Parameters<typeof updateWishlist>[0]) {
    try {
      setWishlist(await updateWishlist(input));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update your wishlist.");
    }
  }

  async function remove(id: string) {
    await removeWishlistItem(id);
    setWishlist((current) => current ? { ...current, items: current.items.filter((item) => item.id !== id) } : current);
  }

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-16 text-sm text-muted-foreground"><Loader2 className="inline size-4 animate-spin" /> Loading your wishlist…</div>;
  if (!wishlist) return null;

  const sharePath = `/wishlist/${wishlist.share_slug}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-3xl font-semibold tracking-tight">{wishlist.title}</h1><p className="mt-2 text-sm text-muted-foreground">Save the devices you want, then share this list for birthdays, gifts or approvals.</p></div>
        <Button asChild variant="outline"><Link href="/shop">Keep browsing</Link></Button>
      </div>

      <section className="mt-8 rounded-2xl border border-border p-5">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-semibold">Share this wishlist</h2><p className="mt-1 text-sm text-muted-foreground">Anyone with the link can view it once sharing is on.</p></div><Button variant={wishlist.is_public ? "default" : "outline"} onClick={() => update({ title: wishlist.title, is_public: !wishlist.is_public, share_expires_at: wishlist.share_expires_at ?? null })}><Share2 className="size-4" />{wishlist.is_public ? "Sharing on" : "Turn on sharing"}</Button></div>
        {wishlist.is_public && <div className="mt-4 flex gap-2"><Input readOnly value={sharePath} /><Button type="button" variant="secondary" onClick={() => navigator.clipboard.writeText(new URL(sharePath, window.location.origin).toString()).then(() => toast.success("Share link copied"))}><Copy className="size-4" />Copy</Button></div>}
      </section>

      {wishlist.items.length === 0 ? <div className="mt-8 rounded-2xl border border-dashed p-12 text-center"><Heart className="mx-auto size-10 text-muted-foreground" /><h2 className="mt-4 font-semibold">Your wishlist is empty</h2><p className="mt-1 text-sm text-muted-foreground">Save a device from any product page to begin.</p></div> : <ul className="mt-8 grid gap-4 sm:grid-cols-2">{wishlist.items.map((item) => <li key={item.id} className="rounded-2xl border border-border p-4"><div className="flex gap-4"><div className="min-w-0 flex-1"><p className="text-xs font-medium text-muted-foreground">{item.product.brand}</p><Link href={`/product/${item.product.slug}`} className="mt-1 block font-semibold hover:underline">{item.product.name}</Link><p className="mt-2 text-sm font-semibold gg-numeric">{item.product.from_price ? naira(item.product.from_price) : "Currently unavailable"}</p></div><Button aria-label={`Remove ${item.product.name}`} variant="ghost" size="icon" onClick={() => remove(item.id)}><Trash2 className="size-4" /></Button></div></li>)}</ul>}
    </div>
  );
}
