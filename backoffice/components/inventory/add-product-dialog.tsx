"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Sparkles,
  Loader2,
  Laptop,
  Package,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CategoryItem = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
};

const POPULAR_BRANDS = [
  "HP",
  "Dell",
  "Lenovo",
  "Apple",
  "ASUS",
  "Acer",
  "Alienware",
  "Anker",
  "Baseus",
  "Logitech",
];

export function AddProductDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [fetchingCategories, setFetchingCategories] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [kind, setKind] = useState<"unit" | "stocked">("unit");
  const [price, setPrice] = useState<string>("");
  const [compareAtPrice, setCompareAtPrice] = useState<string>("");
  const [openingStock, setOpeningStock] = useState<string>("0");
  const [warrantyMonths, setWarrantyMonths] = useState<string>("3");
  const [lowStockThreshold, setLowStockThreshold] = useState<string>("2");
  const [autoEnrich, setAutoEnrich] = useState(true);
  const [shortDescription, setShortDescription] = useState("");

  // Load categories when dialog opens
  useEffect(() => {
    if (!open || categories.length > 0) return;

    setFetchingCategories(true);
    fetch("/api/inventory/categories")
      .then((res) => res.json())
      .then((json) => {
        if (json.data && Array.isArray(json.data)) {
          setCategories(json.data);
          if (json.data.length > 0 && !categoryId) {
            setCategoryId(String(json.data[0].id));
          }
        }
      })
      .catch(() => {
        toast.error("Could not fetch categories list.");
      })
      .finally(() => setFetchingCategories(false));
  }, [open, categories.length, categoryId]);

  // Adjust default threshold when switching kind
  function handleKindChange(newKind: "unit" | "stocked") {
    setKind(newKind);
    if (newKind === "unit") {
      setLowStockThreshold("2");
      setWarrantyMonths("3");
    } else {
      setLowStockThreshold("5");
      setWarrantyMonths("1");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Product name is required.");
      return;
    }
    if (!brand.trim()) {
      toast.error("Brand is required.");
      return;
    }
    if (!categoryId) {
      toast.error("Please select a category.");
      return;
    }

    if (kind === "stocked") {
      const priceNum = parseInt(price, 10);
      if (isNaN(priceNum) || priceNum <= 0) {
        toast.error("Valid selling price is required for stocked items.");
        return;
      }
    }

    setLoading(true);

    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        brand: brand.trim(),
        kind,
        category_id: parseInt(categoryId, 10),
        warranty_months: parseInt(warrantyMonths, 10) || 0,
        low_stock_threshold: parseInt(lowStockThreshold, 10) || 2,
        auto_enrich: autoEnrich,
      };

      if (shortDescription.trim()) {
        payload.short_description = shortDescription.trim();
      }

      if (kind === "stocked") {
        payload.price = parseInt(price, 10);
        if (compareAtPrice) {
          payload.compare_at_price = parseInt(compareAtPrice, 10);
        }
        if (openingStock) {
          payload.opening_stock = parseInt(openingStock, 10);
        }
      }

      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message ?? "Could not create product.");
      }

      toast.success(
        autoEnrich
          ? `Product "${name}" created with AI photos & SEO!`
          : `Product "${name}" created successfully!`,
      );

      setOpen(false);
      resetForm();

      // Navigate directly to the new product's detail page
      if (json.data?.slug) {
        router.push(`/inventory/${encodeURIComponent(json.data.slug)}`);
      } else {
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create product.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setName("");
    setBrand("");
    setKind("unit");
    setPrice("");
    setCompareAtPrice("");
    setOpeningStock("0");
    setShortDescription("");
    setAutoEnrich(true);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 shadow-sm">
          <Plus className="size-4" />
          Add Product
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="size-5 text-emerald-600" />
            Add New Product
          </DialogTitle>
          <DialogDescription>
            Create a base catalogue listing. You can intake physical machines or
            adjust stock immediately after creating it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Tracking Kind Selector */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Inventory Type
            </Label>
            <div className="mt-1.5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleKindChange("unit")}
                className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors ${
                  kind === "unit"
                    ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary"
                    : "border-border hover:bg-muted/50 text-muted-foreground"
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Laptop className="size-4 text-emerald-600" />
                  Serialised Machine
                </div>
                <span className="text-xs text-muted-foreground">
                  Laptops & Phones. Tracks serial, grade, battery health, and specs.
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleKindChange("stocked")}
                className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors ${
                  kind === "stocked"
                    ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary"
                    : "border-border hover:bg-muted/50 text-muted-foreground"
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Package className="size-4 text-emerald-600" />
                  Quantity Stock
                </div>
                <span className="text-xs text-muted-foreground">
                  Chargers, Bags, Cables. Tracks single price & counted quantity.
                </span>
              </button>
            </div>
          </div>

          {/* Product Name */}
          <div className="space-y-1.5">
            <Label htmlFor="product-name" className="text-xs font-semibold">
              Product Model Name *
            </Label>
            <Input
              id="product-name"
              placeholder="e.g. HP EliteBook 840 G8 or 65W GaN Fast Charger"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Brand & Quick Selection */}
          <div className="space-y-1.5">
            <Label htmlFor="brand" className="text-xs font-semibold">
              Brand *
            </Label>
            <Input
              id="brand"
              placeholder="e.g. HP, Dell, Apple, Lenovo"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              required
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {POPULAR_BRANDS.map((b) => (
                <button
                  type="button"
                  key={b}
                  onClick={() => setBrand(b)}
                  className={`rounded border px-2 py-0.5 text-xs transition-colors ${
                    brand.toLowerCase() === b.toLowerCase()
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted text-muted-foreground"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Category Selector */}
          <div className="space-y-1.5">
            <Label htmlFor="category" className="text-xs font-semibold">
              Category *
            </Label>
            {fetchingCategories ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="size-3 animate-spin" /> Loading categories...
              </div>
            ) : (
              <select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                required
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Stocked Specific Fields */}
          {kind === "stocked" && (
            <div className="grid grid-cols-1 gap-3 rounded-lg border border-border/80 bg-muted/20 p-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="price" className="text-xs font-semibold">
                  Selling Price (₦) *
                </Label>
                <Input
                  id="price"
                  type="number"
                  min="1"
                  placeholder="25000"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="compare-at" className="text-xs font-semibold">
                  Compare Price (₦)
                </Label>
                <Input
                  id="compare-at"
                  type="number"
                  min="1"
                  placeholder="30000"
                  value={compareAtPrice}
                  onChange={(e) => setCompareAtPrice(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="opening-stock" className="text-xs font-semibold">
                  Opening Stock
                </Label>
                <Input
                  id="opening-stock"
                  type="number"
                  min="0"
                  placeholder="10"
                  value={openingStock}
                  onChange={(e) => setOpeningStock(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Warranty & Alert Threshold */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="warranty" className="text-xs font-semibold">
                Warranty (Months)
              </Label>
              <Input
                id="warranty"
                type="number"
                min="0"
                max="60"
                value={warrantyMonths}
                onChange={(e) => setWarrantyMonths(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="low-stock" className="text-xs font-semibold">
                Low Stock Threshold
              </Label>
              <Input
                id="low-stock"
                type="number"
                min="0"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
              />
            </div>
          </div>

          {/* Optional Short Description */}
          <div className="space-y-1.5">
            <Label htmlFor="short-desc" className="text-xs font-semibold">
              Short Summary (Optional)
            </Label>
            <Input
              id="short-desc"
              placeholder="e.g. Ultra-lightweight carbon fiber business laptop."
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
            />
          </div>

          {/* AI Auto-Enrichment Toggle */}
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3.5">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoEnrich}
                onChange={(e) => setAutoEnrich(e.target.checked)}
                className="mt-0.5 rounded border-border text-emerald-600 focus:ring-emerald-500"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
                  <Sparkles className="size-3.5 text-emerald-600" />
                  Auto-fill official photos & generate SEO copy with AI
                </div>
                <p className="text-xs text-muted-foreground">
                  Instantly searches official OEM photography for this brand/model and
                  generates Nigerian market SEO tags and commercial descriptions.
                </p>
              </div>
            </label>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="gap-1.5">
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {autoEnrich ? "Creating & Auto-Enriching..." : "Creating..."}
                </>
              ) : (
                <>
                  <Plus className="size-4" />
                  Create Product
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
