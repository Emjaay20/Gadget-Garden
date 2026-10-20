"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Loader2,
  Check,
  CheckCircle2,
  Image as ImageIcon,
  FileText,
  Search,
  ExternalLink,
  ShieldCheck,
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


type ImageCandidate = {
  url: string;
  alt: string;
  label: string;
};

type GeneratedData = {
  short_description: string;
  description: string;
  highlights: string[];
  meta_title: string;
  meta_description: string;
  seo_keywords: string[];
};

type Props = {
  slug: string;
  productName: string;
  brand: string | null;
};

export function AiEnrichmentModal({ slug, productName, brand }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  // Enrichment state
  const [imageCandidates, setImageCandidates] = useState<ImageCandidate[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [generated, setGenerated] = useState<GeneratedData | null>(null);
  const [customDescription, setCustomDescription] = useState("");
  const [newPhotoUrl, setNewPhotoUrl] = useState("");

  function handleAddCustomPhoto() {
    const url = newPhotoUrl.trim();
    if (!url) return;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      toast.error("Please enter a valid HTTP/HTTPS image URL.");
      return;
    }

    const customCandidate: ImageCandidate = {
      url,
      alt: `${productName} custom photo`,
      label: "Custom Added",
    };

    setImageCandidates((prev) => [customCandidate, ...prev]);
    setSelectedUrls((prev) => new Set(prev).add(url));
    setNewPhotoUrl("");
    toast.success("Photo card added!");
  }


  async function handleDiscover() {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory/${encodeURIComponent(slug)}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? "Could not generate product enrichment.");
      }

      const candidates: ImageCandidate[] = json.data.image_candidates ?? [];
      const genData: GeneratedData = json.data.generated;

      setImageCandidates(candidates);
      setGenerated(genData);
      setCustomDescription(genData.description);

      // Select all discovered photos by default for quick 1-click apply
      setSelectedUrls(new Set(candidates.map((c) => c.url)));
      toast.success(`Discovered ${candidates.length} official photos & drafted SEO copy!`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error discovering images.");
    } finally {
      setLoading(false);
    }
  }

  function toggleImageSelection(url: string) {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  async function handleApply() {
    setApplying(true);
    try {
      const selected = imageCandidates.filter((img) => selectedUrls.has(img.url));

      const res = await fetch(`/api/inventory/${encodeURIComponent(slug)}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apply: true,
          selected_images: selected.map((s) => ({ url: s.url, alt: s.alt })),
          custom_description: customDescription,
          custom_highlights: generated?.highlights,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? "Could not apply enrichment to product.");
      }

      toast.success("Product description updated & photos attached!");
      setOpen(false);
      setTimeout(() => {
        window.location.reload();
      }, 350);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error applying enrichment.");
    } finally {
      setApplying(false);
    }
  }


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
        >
          <Sparkles className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          ⚡ AI Auto-Fill & Image Search
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <Sparkles className="size-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Smart Catalogue Ingestion
            </span>
          </div>
          <DialogTitle className="text-lg font-bold">
            Auto-Fill & Media Finder for {productName}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Scans manufacturer imagery repositories for {brand ?? "official"} photos and writes SEO-optimized copy tailored for Lagos buyers.
          </DialogDescription>
        </DialogHeader>

        {/* Action Trigger if not generated yet */}
        {!generated && (
          <div className="my-6 rounded-xl border border-dashed border-border p-8 text-center">
            <ImageIcon className="mx-auto size-10 text-muted-foreground/60 mb-2" />
            <h4 className="text-sm font-semibold">No media attached yet?</h4>
            <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
              Our AI tool will search clean, official photography matching {productName} and generate an SEO-ready product description with Computer Village market keywords.
            </p>
            <Button
              type="button"
              onClick={handleDiscover}
              disabled={loading}
              className="mt-4 gap-2 text-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Scanning repositories & drafting copy…
                </>
              ) : (
                <>
                  <Search className="size-3.5" />
                  Discover Photos & Draft SEO Copy
                </>
              )}
            </Button>
          </div>
        )}

        {/* Discovered Media & Copy Preview */}
        {generated && (
          <div className="mt-4 space-y-6">
            {/* Image Selection Grid */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Select Photos to Attach ({selectedUrls.size} of {imageCandidates.length} chosen)
                </Label>
                <span className="text-xs text-muted-foreground">
                  Click an image to toggle selection
                </span>
              </div>

              {/* Quick Add Custom Photo URL */}
              <div className="flex gap-2 items-center">
                <Input
                  placeholder="Paste any direct photo URL (e.g. from brand website or CDN)..."
                  value={newPhotoUrl}
                  onChange={(e) => setNewPhotoUrl(e.target.value)}
                  className="text-xs h-8"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddCustomPhoto}
                  className="h-8 text-xs shrink-0"
                >
                  + Add URL
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

                {imageCandidates.map((img) => {
                  const isSelected = selectedUrls.has(img.url);
                  return (
                    <div
                      key={img.url}
                      onClick={() => toggleImageSelection(img.url)}
                      className={`group relative aspect-video cursor-pointer overflow-hidden rounded-lg border-2 transition ${
                        isSelected
                          ? "border-emerald-600 ring-2 ring-emerald-500/20"
                          : "border-border opacity-60 hover:opacity-100"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.alt}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                      <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-xs">
                        {img.label}
                      </span>
                      {isSelected && (
                        <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Generated SEO Description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="custom-desc" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Commercial Product Description (SEO-Optimized)
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  Editable before saving
                </span>
              </div>
              <Textarea
                id="custom-desc"
                rows={4}
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                className="text-xs leading-relaxed"
              />
            </div>

            {/* Bullet Highlights */}
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Key Selling Highlights
              </Label>
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                {generated.highlights.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* SEO Keywords Pill Box */}
            <div className="rounded-lg bg-muted/40 p-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                Target SEO Search Terms:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {generated.seo_keywords.map((kw) => (
                  <span
                    key={kw}
                    className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-foreground font-mono"
                  >
                    #{kw}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="mt-6 flex items-center justify-between border-t border-border pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>

          {generated && (
            <Button
              type="button"
              onClick={handleApply}
              disabled={applying || selectedUrls.size === 0}
              className="gap-2 text-xs"
            >
              {applying ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Applying to Product…
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  Apply {selectedUrls.size} Images & Description
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
