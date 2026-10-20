import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { AiEnrichmentModal } from "@/components/inventory/ai-enrichment-modal";
import { ImageGalleryManager } from "@/components/inventory/image-gallery-manager";
import { IntakeForm } from "@/components/inventory/intake-form";
import { ProductDetailsEditor } from "@/components/inventory/product-details-editor";
import { StockMovementForm } from "@/components/inventory/stock-movement-form";
import { UnitTable } from "@/components/inventory/unit-table";
import { api, ApiError } from "@/lib/server/api";
import { naira } from "@/lib/format";
import type { Product, ProductUnit } from "@/lib/types";

export const metadata: Metadata = { title: "Product · Gadgets Garden" };

type Props = { params: Promise<{ slug: string }> };

export default async function InventoryDetailPage({ params }: Props) {
  const { slug } = await params;

  let product: Product;
  let units: ProductUnit[] = [];

  try {
    const res = await api<{ data: Product }>(
      `/inventory/${encodeURIComponent(slug)}`,
    );
    product = res.data;

    if (product.kind === "unit") {
      const response = await api<{ data: ProductUnit[] }>(
        `/inventory/${encodeURIComponent(slug)}/units`,
      );
      units = response.data;
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }


  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href="/inventory"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" />
        Inventory
      </Link>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {product.brand} ·{" "}
            {product.kind === "unit"
              ? `${product.available_count} available of ${units.length} on record`
              : `${product.available_count} in stock at ${naira(product.from_price ?? 0)}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <AiEnrichmentModal
            slug={product.slug}
            productName={product.name}
            brand={product.brand}
          />
        </div>
      </div>

      {product.kind === "unit" ? (
        <>
          <section className="mt-8">
            <h2 className="text-xs font-semibold tracking-[0.14em] uppercase">
              Machines
            </h2>
            <UnitTable units={units} />
          </section>

          <section className="mt-10">
            <h2 className="text-xs font-semibold tracking-[0.14em] uppercase">
              Receive a shipment
            </h2>
            <p className="text-muted-foreground mt-1 text-sm text-pretty">
              Add every machine in the batch, then save once. Nothing is recorded
              unless the whole batch is valid.
            </p>
            <IntakeForm slug={product.slug} />
          </section>
        </>
      ) : (
        <section className="mt-8 max-w-md">
          <h2 className="text-xs font-semibold tracking-[0.14em] uppercase">
            Adjust stock
          </h2>
          <p className="text-muted-foreground mt-1 text-sm text-pretty">
            Every change is recorded in the ledger with your name against it.
          </p>
          <StockMovementForm
            slug={product.slug}
            currentStock={product.available_count}
          />
        </section>
      )}

      <section className="mt-12 border-t border-border pt-8">
        <ProductDetailsEditor product={product} />
      </section>

      <section className="mt-12 border-t border-border pt-8">
        <h2 className="text-xs font-semibold tracking-[0.14em] uppercase">
          Product Photography & Media
        </h2>

        <p className="text-muted-foreground mt-1 text-sm text-pretty mb-4">
          Upload showcase photos or link direct image URLs. The first image serves as the listing thumbnail on the storefront.
        </p>
        <ImageGalleryManager slug={product.slug} initialImages={product.images ?? []} />
      </section>
    </div>
  );
}
