import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { AddProductDialog } from "@/components/inventory/add-product-dialog";
import { DeleteProductDialog } from "@/components/inventory/delete-product-dialog";
import { InventorySearch } from "@/components/inventory/inventory-search";
import { api } from "@/lib/server/api";
import { naira, specSummary } from "@/lib/format";
import type { Paginated, Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Inventory · Gadgets Garden" };

export default async function InventoryPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await props.searchParams;
  const lowStock = params.low_stock === "1";
  const search = typeof params.search === "string" ? params.search : "";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            Manage product models, machine unit shipments, and accessory stocks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <nav className="flex gap-1 text-sm">
            <Link
              href="/inventory"
              className={cn(
                "rounded-md px-3 py-1.5",
                !lowStock ? "bg-accent font-medium" : "text-muted-foreground",
              )}
            >
              Everything
            </Link>
            <Link
              href="/inventory?low_stock=1"
              className={cn(
                "rounded-md px-3 py-1.5",
                lowStock ? "bg-accent font-medium" : "text-muted-foreground",
              )}
            >
              Running low
            </Link>
          </nav>

          <AddProductDialog />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <InventorySearch defaultValue={search} />
      </div>

      <Suspense fallback={<Skeleton className="mt-4 h-96" />}>
        <ProductTable lowStock={lowStock} search={search} />
      </Suspense>
    </div>
  );
}

async function ProductTable({
  lowStock,
  search,
}: {
  lowStock: boolean;
  search: string;
}) {
  const query = new URLSearchParams();
  if (lowStock) query.set("low_stock", "1");
  if (search) query.set("search", search);

  const { data } = await api<Paginated<Product>>(
    `/inventory${query.toString() ? `?${query}` : ""}`,
  );

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground py-16 text-center text-sm">
        {lowStock ? "Nothing is running low." : "No products yet."}
      </p>
    );
  }

  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground border-b text-left">
            <th className="py-2 pr-4 font-medium">Product</th>
            <th className="py-2 pr-4 font-medium">Type</th>
            <th className="py-2 pr-4 text-right font-medium">Available</th>
            <th className="py-2 pr-4 text-right font-medium">Price</th>
            <th className="py-2 pr-4 font-medium">State</th>
            <th className="py-2 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {data.map((product) => (
            <tr key={product.id} className="hover:bg-accent/40 border-b">
              <td className="py-3 pr-4">
                <Link
                  href={`/inventory/${product.slug}`}
                  className="font-medium hover:underline"
                >
                  {product.name}
                </Link>
                <div className="text-muted-foreground text-xs">
                  {product.brand}
                  {specSummary(product.summary_specs) &&
                    ` · ${specSummary(product.summary_specs)}`}
                </div>
              </td>
              <td className="text-muted-foreground py-3 pr-4">
                {product.kind === "unit" ? "Serialised" : "Quantity"}
              </td>
              <td className="gg-numeric py-3 pr-4 text-right font-medium">
                {product.available_count}
              </td>
              <td className="gg-numeric text-muted-foreground py-3 pr-4 text-right">
                {product.from_price === null ? "—" : naira(product.from_price)}
              </td>
              <td className="py-3 pr-4">
                {product.available_count === 0 ? (
                  <span className="text-destructive text-xs font-medium">
                    Out of stock
                  </span>
                ) : product.is_low_stock ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="size-3" />
                    Low
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">In stock</span>
                )}
              </td>
              <td className="py-3 text-right">
                <DeleteProductDialog
                  slug={product.slug}
                  productName={product.name}
                  triggerVariant="icon"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
