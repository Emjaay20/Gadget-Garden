"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Save,
  Loader2,
  Plus,
  Trash2,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Product } from "@/lib/types";

type Props = {
  product: Product;
};

export function ProductDetailsEditor({ product }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState(product.name ?? "");
  const [brand, setBrand] = useState(product.brand ?? "");
  const [shortDescription, setShortDescription] = useState(
    product.short_description ?? "",
  );
  const [description, setDescription] = useState(product.description ?? "");
  const [highlights, setHighlights] = useState<string[]>(
    product.highlights && product.highlights.length > 0
      ? product.highlights
      : [""],
  );
  const [warrantyMonths, setWarrantyMonths] = useState(
    String(product.warranty_months ?? 3),
  );

  function handleAddHighlight() {
    if (highlights.length < 8) {
      setHighlights([...highlights, ""]);
    }
  }

  function handleRemoveHighlight(index: number) {
    const updated = highlights.filter((_, i) => i !== index);
    setHighlights(updated.length > 0 ? updated : [""]);
  }

  function handleHighlightChange(index: number, value: string) {
    const updated = [...highlights];
    updated[index] = value;
    setHighlights(updated);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const filteredHighlights = highlights
        .map((h) => h.trim())
        .filter(Boolean);

      const payload = {
        name: name.trim(),
        brand: brand.trim(),
        short_description: shortDescription.trim() || null,
        description: description.trim() || null,
        highlights: filteredHighlights,
        warranty_months: parseInt(warrantyMonths, 10) || 0,
      };

      const res = await fetch(`/api/inventory/${encodeURIComponent(product.slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? "Could not save product details.");
      }

      toast.success("Product details & highlights saved successfully!");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-emerald-600" />
            <h2 className="text-sm font-semibold tracking-wide uppercase text-foreground">
              Product Listing Copy & Highlights
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Shown on customer product pages, Google search snippets, and cart lines.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={loading}
          className="gap-1.5 self-start sm:self-auto"
        >
          {loading ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="size-3.5" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Name and Brand Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2 space-y-1">
            <Label htmlFor="edit-name" className="text-xs font-semibold">
              Listing Title
            </Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. 15" Laptop Backpack'
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit-brand" className="text-xs font-semibold">
              Brand
            </Label>
            <Input
              id="edit-brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. Targus"
            />
          </div>
        </div>

        {/* Short Description */}
        <div className="space-y-1">
          <Label htmlFor="edit-short-desc" className="text-xs font-semibold">
            Short Tagline (Displayed above price)
          </Label>
          <Input
            id="edit-short-desc"
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            placeholder='e.g. Padded 15" compartment, water-resistant weather shell.'
          />
        </div>


        {/* Full Commercial Description */}
        <div className="space-y-1">
          <Label htmlFor="edit-desc" className="text-xs font-semibold">
            Full Product Description (Markdown / Commercial Copy)
          </Label>
          <Textarea
            id="edit-desc"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detailed features, durability, materials, ergonomics, warranty..."
            className="text-sm font-sans"
          />
        </div>

        {/* Highlights Bullet Points */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">
              Key Selling Highlights (Card Badges)
            </Label>
            {highlights.length < 8 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddHighlight}
                className="h-7 text-xs text-emerald-600 hover:text-emerald-700"
              >
                <Plus className="size-3 mr-1" />
                Add Highlight
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {highlights.map((h, i) => (
              <div key={i} className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                <Input
                  value={h}
                  onChange={(e) => handleHighlightChange(i, e.target.value)}
                  placeholder={`Feature ${i + 1} (e.g. Dedicated shock-absorbing laptop compartment)`}
                  className="text-xs h-9"
                />
                {highlights.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveHighlight(i)}
                    className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <Button type="submit" size="sm" disabled={loading} className="gap-1.5">
            {loading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="size-3.5" />
                Save Product Details
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
