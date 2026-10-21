import Link from "next/link";
import { Heart } from "lucide-react";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getSharedWishlist } from "@/lib/api";
import { naira } from "@/lib/format";

export default async function SharedWishlistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const wishlist = await getSharedWishlist(slug);
  if (!wishlist) notFound();

  return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><div className="text-center"><Heart className="mx-auto size-9 text-rose-500" /><p className="mt-4 text-sm text-muted-foreground">{wishlist.owner_name ?? "Someone"}&rsquo;s picks</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{wishlist.title}</h1><p className="mt-2 text-sm text-muted-foreground">A shared Gadgets Garden wishlist.</p></div><ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{wishlist.items.map((item) => <li key={item.id} className="rounded-2xl border border-border p-5"><p className="text-xs font-medium text-muted-foreground">{item.product.brand}</p><h2 className="mt-1 font-semibold">{item.product.name}</h2><p className="mt-3 gg-numeric font-semibold">{item.product.from_price ? naira(item.product.from_price) : "Currently unavailable"}</p><Button asChild className="mt-5 w-full" variant="outline"><Link href={`/product/${item.product.slug}`}>View device</Link></Button></li>)}</ul></div>;
}
