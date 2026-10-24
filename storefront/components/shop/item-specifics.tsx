import {
  Cpu,
  HardDrive,
  Laptop,
  Layers,
  Monitor,
  Palette,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

import type { Product, ProductUnit } from "@/lib/types";

interface ItemSpecificsProps {
  product: Product;
  selectedUnit?: ProductUnit;
}

export function ItemSpecifics({ product, selectedUnit }: ItemSpecificsProps) {
  // Merge product level specs and selected unit specs
  const cpu =
    selectedUnit?.specs?.cpu ??
    product.processor ??
    product.summary_specs?.cpu ??
    null;

  const ram =
    selectedUnit?.specs?.ram_gb ??
    product.ram_gb ??
    product.summary_specs?.ram_gb ??
    null;

  const storage =
    selectedUnit?.specs?.storage_gb ??
    product.storage_gb ??
    product.summary_specs?.storage_gb ??
    null;

  const storageType =
    selectedUnit?.specs?.storage_type ??
    product.storage_type ??
    "SSD";

  const screen =
    selectedUnit?.specs?.screen ??
    product.screen_size ??
    product.summary_specs?.screen ??
    null;

  const resolution = product.resolution ?? null;

  const gpu =
    selectedUnit?.specs?.gpu ??
    product.graphics ??
    product.summary_specs?.gpu ??
    null;

  const color = product.color ?? null;

  const specsList = [
    {
      label: "Processor / CPU",
      value: cpu,
      icon: Cpu,
    },
    {
      label: "RAM / Memory",
      value: ram ? `${ram} GB` : null,
      icon: Layers,
    },
    {
      label: "Storage",
      value: storage ? (storage >= 1024 ? `${storage / 1024} TB ${storageType}` : `${storage} GB ${storageType}`) : null,
      icon: HardDrive,
    },
    {
      label: "Screen & Display",
      value: screen ? (resolution ? `${screen} (${resolution})` : screen) : resolution,
      icon: Monitor,
    },
    {
      label: "Graphics / GPU",
      value: gpu,
      icon: Zap,
    },
    {
      label: "Color / Finish",
      value: color,
      icon: Palette,
    },
    {
      label: "Brand",
      value: product.brand,
      icon: Laptop,
    },
    {
      label: "Warranty",
      value: product.warranty_months > 0 ? `${product.warranty_months} Months Warranty` : "Showroom Warranty",
      icon: ShieldCheck,
    },
  ].filter((item) => Boolean(item.value));

  if (specsList.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
      <div className="flex items-center gap-2 border-b pb-4 mb-4">
        <Sparkles className="size-4 text-primary" />
        <h2 className="text-sm font-semibold tracking-wider uppercase text-foreground">
          Item Specifics & Technical Specifications
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {specsList.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3.5 transition-colors hover:bg-muted/40"
          >
            <div className="size-8 rounded-lg bg-background border flex items-center justify-center shrink-0 text-muted-foreground">
              <Icon className="size-4 text-primary" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                {label}
              </span>
              <span className="text-sm font-semibold text-foreground mt-0.5 block truncate">
                {value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
