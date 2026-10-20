"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  Check,
  Cpu,
  HardDrive,
  Layers,
  Monitor,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BatteryBadge } from "@/components/brand/battery-badge";
import { ConditionBadge } from "@/components/brand/condition-badge";
import { MakeAnOfferModal } from "@/components/shop/make-an-offer-modal";
import { useCart } from "@/lib/cart-store";
import { useCompare, type CompareItem } from "@/lib/compare-store";
import { naira, warrantyLabel } from "@/lib/format";
import type { Condition } from "@/lib/types";

export function CompareDrawer() {
  const { items, count, removeItem, clear } = useCompare();
  const [openModal, setOpenModal] = useState(false);
  const { addUnit, addProduct } = useCart();

  if (count === 0) return null;

  function handleAddToCart(item: CompareItem) {
    if (item.unitId) {
      addUnit(item.unitId);
      toast.success(`${item.name} (${item.unitSku}) added to cart!`);
    } else {
      addProduct(item.productId);
      toast.success(`${item.name} added to cart!`);
    }
  }

  return (
    <>
      {/* Floating Bottom Comparison Dock */}
      <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
        <div className="flex items-center gap-3 rounded-2xl border border-neutral-700 bg-neutral-900/95 px-4 py-2.5 text-white shadow-2xl backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/95">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
              <ArrowLeftRight className="size-4" />
            </span>
            <div className="hidden sm:block">
              <span className="text-xs font-semibold">Compare Machines</span>
              <span className="text-neutral-400 block text-[11px]">
                {count} of 3 selected
              </span>
            </div>
          </div>

          {/* Mini Chips */}
          <div className="flex items-center gap-1.5">
            {items.map((item) => (
              <div
                key={item.unitSku ?? item.productId}
                className="flex items-center gap-1.5 rounded-lg bg-neutral-800 px-2 py-1 text-xs text-neutral-200"
              >
                <span className="max-w-[90px] truncate font-medium">
                  {item.name}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(item.unitSku ?? item.productId)}
                  className="text-neutral-400 hover:text-white"
                  aria-label={`Remove ${item.name}`}
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1.5 pl-1">
            <Button
              size="sm"
              onClick={() => setOpenModal(true)}
              className="bg-emerald-600 text-white hover:bg-emerald-500 text-xs font-medium"
            >
              Compare ({count})
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={clear}
              className="text-neutral-400 hover:text-white"
              title="Clear all"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Side-by-Side Comparison Dialog */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <ArrowLeftRight className="size-5" />
              <span className="text-xs font-semibold tracking-wider uppercase">
                Hardware Benchmark
              </span>
            </div>
            <DialogTitle className="text-xl font-bold">
              Side-by-Side Laptop Comparison
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Direct specification, battery health, and price comparison of your selected machines.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-3 w-40 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">
                    Feature
                  </th>
                  {items.map((item) => (
                    <th
                      key={item.unitSku ?? item.productId}
                      className="p-3 min-w-[200px] align-top"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground font-semibold uppercase">
                          {item.brand}
                        </span>
                        <span className="font-bold text-base leading-snug">
                          {item.name}
                        </span>
                        {item.unitSku && (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            SKU: {item.unitSku}
                          </span>
                        )}
                        <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                          {naira(item.price)}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {/* Condition & Grade */}
                <tr>
                  <td className="p-3 font-medium text-xs text-muted-foreground bg-muted/20">
                    Condition & Grade
                  </td>
                  {items.map((item) => (
                    <td key={item.unitSku ?? item.productId} className="p-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {item.condition && (
                          <ConditionBadge
                            condition={item.condition as Condition}
                            size="sm"
                          />
                        )}
                        {item.grade && (
                          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
                            Grade {item.grade}
                          </span>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Battery Health */}
                <tr>
                  <td className="p-3 font-medium text-xs text-muted-foreground bg-muted/20">
                    Battery Health
                  </td>
                  {items.map((item) => (
                    <td key={item.unitSku ?? item.productId} className="p-3">
                      {typeof item.specs.battery_health === "number" ? (
                        <BatteryBadge health={item.specs.battery_health} size="sm" />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Factory Sealed / Untested
                        </span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Processor (CPU) */}
                <tr>
                  <td className="p-3 font-medium text-xs text-muted-foreground bg-muted/20">
                    Processor (CPU)
                  </td>
                  {items.map((item) => (
                    <td key={item.unitSku ?? item.productId} className="p-3 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Cpu className="size-3.5 text-muted-foreground shrink-0" />
                        <span>{String(item.specs.cpu ?? "Standard")}</span>
                      </div>
                    </td>
                  ))}
                </tr>

                {/* RAM */}
                <tr>
                  <td className="p-3 font-medium text-xs text-muted-foreground bg-muted/20">
                    RAM Memory
                  </td>
                  {items.map((item) => (
                    <td key={item.unitSku ?? item.productId} className="p-3 font-semibold">
                      <div className="flex items-center gap-1.5">
                        <Layers className="size-3.5 text-muted-foreground shrink-0" />
                        <span>
                          {item.specs.ram_gb ? `${item.specs.ram_gb} GB` : "Standard"}
                        </span>
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Storage */}
                <tr>
                  <td className="p-3 font-medium text-xs text-muted-foreground bg-muted/20">
                    Storage (SSD)
                  </td>
                  {items.map((item) => (
                    <td key={item.unitSku ?? item.productId} className="p-3">
                      <div className="flex items-center gap-1.5">
                        <HardDrive className="size-3.5 text-muted-foreground shrink-0" />
                        <span>
                          {item.specs.storage_gb
                            ? `${item.specs.storage_gb} GB SSD`
                            : "Standard SSD"}
                        </span>
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Display */}
                <tr>
                  <td className="p-3 font-medium text-xs text-muted-foreground bg-muted/20">
                    Display
                  </td>
                  {items.map((item) => (
                    <td key={item.unitSku ?? item.productId} className="p-3">
                      <div className="flex items-center gap-1.5">
                        <Monitor className="size-3.5 text-muted-foreground shrink-0" />
                        <span>{String(item.specs.screen ?? "Standard Display")}</span>
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Graphics (GPU) */}
                <tr>
                  <td className="p-3 font-medium text-xs text-muted-foreground bg-muted/20">
                    Graphics (GPU)
                  </td>
                  {items.map((item) => (
                    <td key={item.unitSku ?? item.productId} className="p-3">
                      {item.specs.gpu ? (
                        <span className="rounded bg-purple-500/10 px-2 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300">
                          {String(item.specs.gpu)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Integrated Intel/AMD Graphics
                        </span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Warranty */}
                <tr>
                  <td className="p-3 font-medium text-xs text-muted-foreground bg-muted/20">
                    Warranty
                  </td>
                  {items.map((item) => (
                    <td key={item.unitSku ?? item.productId} className="p-3">
                      <div className="flex items-center gap-1.5 text-xs">
                        <ShieldCheck className="size-3.5 text-emerald-600 shrink-0" />
                        <span>{warrantyLabel(item.warrantyMonths ?? 6)}</span>
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Action Row */}
                <tr>
                  <td className="p-3 font-medium text-xs text-muted-foreground bg-muted/20">
                    Order / Offer
                  </td>
                  {items.map((item) => (
                    <td key={item.unitSku ?? item.productId} className="p-3">
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleAddToCart(item)}
                          className="w-full gap-1.5 text-xs"
                        >
                          <ShoppingCart className="size-3.5" />
                          Add to Cart
                        </Button>

                        <MakeAnOfferModal
                          productId={item.productId}
                          productName={item.name}
                          originalPrice={item.price}
                          unitId={item.unitId}
                          unitSku={item.unitSku}
                        />

                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="w-full text-xs"
                        >
                          <Link
                            href={`/product/${item.productSlug}`}
                            onClick={() => setOpenModal(false)}
                          >
                            Full Details
                          </Link>
                        </Button>
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
