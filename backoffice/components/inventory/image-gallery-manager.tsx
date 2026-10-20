"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ImagePlus,
  Loader2,
  Trash2,
  UploadCloud,
  Link as LinkIcon,
  CheckCircle2,
  Star,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProductImage } from "@/lib/types";

type Props = {
  slug: string;
  initialImages?: ProductImage[];
};

export function ImageGalleryManager({ slug, initialImages = [] }: Props) {
  const [images, setImages] = useState<ProductImage[]>(initialImages);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileAlt, setFileAlt] = useState("");

  // URL State
  const [imageUrl, setImageUrl] = useState("");
  const [urlAlt, setUrlAlt] = useState("");

  async function handleFileUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("image", selectedFile);
    if (fileAlt) formData.append("alt", fileAlt);

    try {
      const res = await fetch(`/admin/api/inventory/${encodeURIComponent(slug)}/images`, {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? "Failed to upload image.");
      }

      toast.success("Image uploaded successfully!");
      setImages((prev) => [...prev, json.data]);
      setSelectedFile(null);
      setFileAlt("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload error.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleUrlAttach(e: React.FormEvent) {
    e.preventDefault();
    if (!imageUrl.trim()) return;

    setIsUploading(true);
    try {
      const res = await fetch(`/admin/api/inventory/${encodeURIComponent(slug)}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: imageUrl.trim(),
          alt: urlAlt.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? "Failed to attach image URL.");
      }

      toast.success("Image linked successfully!");
      setImages((prev) => [...prev, json.data]);
      setImageUrl("");
      setUrlAlt("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error attaching URL.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this photo?")) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/admin/api/inventory/images/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message ?? "Failed to delete image.");
      }

      toast.success("Image removed.");
      setImages((prev) => prev.filter((img) => img.id !== id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Deletion error.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Existing Images Gallery */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between pb-3 border-b border-border/50">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Current Media ({images.length})
          </span>
          <span className="text-xs text-muted-foreground">
            Position 1 is the primary listing thumbnail
          </span>
        </div>

        {images.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <ImagePlus className="mx-auto size-8 text-muted-foreground/50 mb-2" />
            No photos uploaded yet for this model.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {images.map((img, index) => (
              <div
                key={img.id}
                className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted/20"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.alt ?? `Photo ${index + 1}`}
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />

                {index === 0 && (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-neutral-900/80 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm backdrop-blur-xs">
                    <Star className="size-3 fill-amber-400 text-amber-400" />
                    Cover
                  </span>
                )}

                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(img.id)}
                    disabled={deletingId === img.id}
                    className="h-8 gap-1 text-xs"
                  >
                    {deletingId === img.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add New Image Form */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-3">Add New Photography</h3>

        <Tabs defaultValue="file" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="file" className="gap-1.5 text-xs">
              <UploadCloud className="size-3.5" />
              Upload Local File
            </TabsTrigger>
            <TabsTrigger value="url" className="gap-1.5 text-xs">
              <LinkIcon className="size-3.5" />
              Link Photo URL
            </TabsTrigger>
          </TabsList>

          {/* File Upload Tab */}
          <TabsContent value="file">
            <form onSubmit={handleFileUpload} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="image-file">Image File (JPG, PNG, WebP up to 10MB)</Label>
                <Input
                  id="image-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="image-alt">Alt Text / Description (optional)</Label>
                <Input
                  id="image-alt"
                  value={fileAlt}
                  onChange={(e) => setFileAlt(e.target.value)}
                  placeholder="e.g. Front display and keyboard layout"
                />
              </div>

              <Button type="submit" disabled={isUploading || !selectedFile} className="gap-1.5 text-xs">
                {isUploading ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
                Upload to Showroom Storage
              </Button>
            </form>
          </TabsContent>

          {/* URL Link Tab */}
          <TabsContent value="url">
            <form onSubmit={handleUrlAttach} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="image-url">Direct Image URL</Label>
                <Input
                  id="image-url"
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/... or CDN link"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="url-alt">Alt Text / Description (optional)</Label>
                <Input
                  id="url-alt"
                  value={urlAlt}
                  onChange={(e) => setUrlAlt(e.target.value)}
                  placeholder="e.g. Supplier press render"
                />
              </div>

              <Button type="submit" disabled={isUploading || !imageUrl.trim()} className="gap-1.5 text-xs">
                {isUploading ? <Loader2 className="size-4 animate-spin" /> : <LinkIcon className="size-4" />}
                Attach Photo URL
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
