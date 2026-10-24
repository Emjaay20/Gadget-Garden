"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Sparkles,
  Loader2,
  Laptop,
  Cpu,
  Package,
  ShieldCheck,
  Tag,
  Image as ImageIcon,
  X,
  Upload,
  Link as LinkIcon,
} from "lucide-react";

function YoutubeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}
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
  "Microsoft Surface",
  "Microsoft",
  "ASUS",
  "Acer",
  "Alienware",
  "Anker",
  "Baseus",
  "Logitech",
];

const AVAILABLE_PROPERTIES = [
  "Touch screen",
  "2 in 1",
  "Detachable",
  "Standard Clamshell",
];

type ImageEntry =
  | { id: string; type: "file"; file: File; preview: string }
  | { id: string; type: "url"; url: string; preview: string };

export function AddProductDialog() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const [properties, setProperties] = useState<string[]>([]);
  const [youtubeUrl, setYoutubeUrl] = useState<string>("");
  const [processor, setProcessor] = useState<string>("");
  const [ramGb, setRamGb] = useState<string>("");
  const [storageGb, setStorageGb] = useState<string>("");
  const [storageType, setStorageType] = useState<string>("SSD");
  const [screenSize, setScreenSize] = useState<string>("");
  const [resolution, setResolution] = useState<string>("");
  const [graphics, setGraphics] = useState<string>("");
  const [color, setColor] = useState<string>("");
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState<string>("");

  // Load categories when dialog opens
  useEffect(() => {
    if (!open || categories.length > 0) return;

    setFetchingCategories(true);
    fetch("/admin/api/inventory/categories")
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

  function toggleProperty(prop: string) {
    setProperties((prev) =>
      prev.includes(prop) ? prev.filter((p) => p !== prop) : [...prev, prop],
    );
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0) return;
    const newEntries: ImageEntry[] = Array.from(e.target.files).map((file) => ({
      id: Math.random().toString(36).substring(2, 9),
      type: "file",
      file,
      preview: URL.createObjectURL(file),
    }));
    setImages((prev) => [...prev, ...newEntries]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleAddImageUrl() {
    const url = imageUrlInput.trim();
    if (!url) return;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      toast.error("Please enter a valid URL starting with http:// or https://");
      return;
    }
    setImages((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        type: "url",
        url,
        preview: url,
      },
    ]);
    setImageUrlInput("");
  }

  function handleRemoveImage(id: string) {
    setImages((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target && target.type === "file") {
        URL.revokeObjectURL(target.preview);
      }
      return prev.filter((item) => item.id !== id);
    });
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
      const imageUrls = images
        .filter((img): img is Extract<ImageEntry, { type: "url" }> => img.type === "url")
        .map((img) => img.url);

      const payload: Record<string, unknown> = {
        name: name.trim(),
        brand: brand.trim(),
        kind,
        category_id: parseInt(categoryId, 10),
        warranty_months: parseInt(warrantyMonths, 10) || 0,
        low_stock_threshold: parseInt(lowStockThreshold, 10) || 2,
        auto_enrich: autoEnrich,
      };

      if (properties.length > 0) {
        payload.properties = properties;
      }

      if (youtubeUrl.trim()) {
        payload.youtube_url = youtubeUrl.trim();
      }

      if (processor.trim()) payload.processor = processor.trim();
      if (ramGb) payload.ram_gb = parseInt(ramGb, 10);
      if (storageGb) payload.storage_gb = parseInt(storageGb, 10);
      if (storageType.trim()) payload.storage_type = storageType.trim();
      if (screenSize.trim()) payload.screen_size = screenSize.trim();
      if (resolution.trim()) payload.resolution = resolution.trim();
      if (graphics.trim()) payload.graphics = graphics.trim();
      if (color.trim()) payload.color = color.trim();

      if (imageUrls.length > 0) {
        payload.images = imageUrls;
      }

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

      const res = await fetch("/admin/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message ?? "Could not create product.");
      }

      // If any local files were selected, upload them now to the product
      const fileImages = images.filter(
        (img): img is Extract<ImageEntry, { type: "file" }> => img.type === "file",
      );
      if (fileImages.length > 0 && json.data?.slug) {
        let uploadedCount = 0;
        for (const item of fileImages) {
          try {
            const fd = new FormData();
            fd.append("image", item.file);
            fd.append("type", "real_device");
            const uploadRes = await fetch(
              `/admin/api/inventory/${encodeURIComponent(json.data.slug)}/images`,
              {
                method: "POST",
                body: fd,
              },
            );
            if (uploadRes.ok) uploadedCount++;
          } catch {
            // continue with remaining files
          }
        }
        if (uploadedCount > 0) {
          toast.success(`Attached ${uploadedCount} real device photo(s)!`);
        }
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
    images.forEach((img) => {
      if (img.type === "file") URL.revokeObjectURL(img.preview);
    });
    setName("");
    setBrand("");
    setKind("unit");
    setPrice("");
    setCompareAtPrice("");
    setOpeningStock("0");
    setShortDescription("");
    setProperties([]);
    setYoutubeUrl("");
    setProcessor("");
    setRamGb("");
    setStorageGb("");
    setStorageType("SSD");
    setScreenSize("");
    setResolution("");
    setGraphics("");
    setColor("");
    setImages([]);
    setImageUrlInput("");
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
              placeholder="e.g. HP, Dell, Apple, Lenovo, Microsoft Surface"
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
            <p className="text-[11px] text-muted-foreground pt-0.5">
              💡 Any custom brand you type here will automatically be registered and searchable across the store.
            </p>
          </div>

          {/* Properties / Form Factor */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Properties / Form Factor (Optional)
            </Label>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {AVAILABLE_PROPERTIES.map((prop) => {
                const active = properties.includes(prop);
                return (
                  <button
                    type="button"
                    key={prop}
                    onClick={() => toggleProperty(prop)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                      active
                        ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 ring-1 ring-emerald-600"
                        : "border-border hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    {active ? "✓ " : "+ "}
                    {prop}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Select key design traits (e.g. 2 in 1 convertible, Touch screen, Detachable tablet).
            </p>
          </div>

          {/* YouTube Video Review */}
          <div className="space-y-1.5">
            <Label htmlFor="youtube-url" className="text-xs font-semibold flex items-center gap-1.5">
              <YoutubeIcon className="size-3.5 text-red-600" />
              YouTube Video Review URL (Optional)
            </Label>
            <Input
              id="youtube-url"
              placeholder="e.g. https://www.youtube.com/watch?v=... or https://youtu.be/..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Streams directly from YouTube on the customer product page with zero hosting overhead.
            </p>
          </div>

          {/* Hardware & Technical Specifications (eBay / Swappa Style) */}
          <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-3.5">
            <div className="flex items-center justify-between border-b pb-2">
              <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <Cpu className="size-3.5 text-primary" />
                Technical Specifications (eBay / Swappa Style)
              </Label>
              <span className="text-[11px] text-muted-foreground">For laptops & workstations</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="spec-processor" className="text-xs">Processor / Chip</Label>
                <Input
                  id="spec-processor"
                  placeholder="e.g. Apple M1 Pro (8-Core) or Core i7-1185G7"
                  value={processor}
                  onChange={(e) => setProcessor(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="spec-ram" className="text-xs">RAM (GB)</Label>
                  <select
                    id="spec-ram"
                    value={ramGb}
                    onChange={(e) => setRamGb(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs shadow-xs"
                  >
                    <option value="">Select RAM</option>
                    <option value="8">8 GB</option>
                    <option value="16">16 GB</option>
                    <option value="24">24 GB</option>
                    <option value="32">32 GB</option>
                    <option value="64">64 GB</option>
                    <option value="128">128 GB</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="spec-storage" className="text-xs">Storage (GB)</Label>
                  <select
                    id="spec-storage"
                    value={storageGb}
                    onChange={(e) => setStorageGb(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs shadow-xs"
                  >
                    <option value="">Select SSD</option>
                    <option value="256">256 GB</option>
                    <option value="512">512 GB</option>
                    <option value="1024">1 TB (1024 GB)</option>
                    <option value="2048">2 TB (2048 GB)</option>
                    <option value="4096">4 TB (4096 GB)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="spec-screen" className="text-xs">Screen Size</Label>
                  <Input
                    id="spec-screen"
                    placeholder="e.g. 14.2 in or 13.3 in"
                    value={screenSize}
                    onChange={(e) => setScreenSize(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="spec-resolution" className="text-xs">Display Res</Label>
                  <Input
                    id="spec-resolution"
                    placeholder="e.g. Liquid Retina XDR / FHD"
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="spec-gpu" className="text-xs">Graphics / GPU</Label>
                  <Input
                    id="spec-gpu"
                    placeholder="e.g. Apple 14-Core / RTX 3060"
                    value={graphics}
                    onChange={(e) => setGraphics(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="spec-color" className="text-xs">Chassis Color</Label>
                  <Input
                    id="spec-color"
                    placeholder="e.g. Space Gray / Silver"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Direct Product Photos & URL input */}
          <div className="space-y-2 rounded-lg border border-border/80 bg-muted/15 p-3.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <ImageIcon className="size-3.5 text-emerald-600" />
                Product Photos (Optional)
              </Label>
              <span className="text-[11px] text-muted-foreground">
                {images.length > 0 ? `${images.length} added` : "AI auto-fills if empty"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Upload local photos or paste image URLs. If left empty, AI discovery will automatically find official studio photos for this model.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFilesSelected}
            />

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-3" />
                Upload Photos
              </Button>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Input
                placeholder="Or paste direct image URL (https://...)"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                className="h-8 text-xs"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 text-xs shrink-0 gap-1"
                onClick={handleAddImageUrl}
              >
                <Plus className="size-3" />
                Add URL
              </Button>
            </div>

            {images.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className="group relative size-16 overflow-hidden rounded-md border border-border bg-background shadow-xs"
                  >
                    <img
                      src={img.preview}
                      alt="Product preview"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(img.id)}
                      className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-black/70 text-white transition-opacity hover:bg-black"
                      title="Remove image"
                    >
                      <X className="size-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
