"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface DeleteProductDialogProps {
  slug: string;
  productName: string;
  triggerVariant?: "icon" | "button";
  redirectOnDelete?: string;
}

export function DeleteProductDialog({
  slug,
  productName,
  triggerVariant = "icon",
  redirectOnDelete,
}: DeleteProductDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);

    try {
      const response = await fetch(`/admin/api/inventory/${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg =
          body.errors?.product?.[0] ??
          body.message ??
          "Could not delete product. It may have active reservations.";
        toast.error(errorMsg);
        setIsDeleting(false);
        return;
      }

      toast.success(body.message ?? `Product "${productName}" deleted successfully.`);
      setOpen(false);

      if (redirectOnDelete) {
        router.push(redirectOnDelete);
      } else {
        router.refresh();
      }
    } catch {
      toast.error("Network error while deleting product.");
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerVariant === "icon" ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title={`Delete ${productName}`}
            aria-label={`Delete ${productName}`}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : (
          <Button
            variant="outline"
            className="text-destructive border-destructive/30 hover:bg-destructive hover:text-destructive-foreground gap-1.5"
          >
            <Trash2 className="size-4" />
            Delete Product
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Product Listing</DialogTitle>
          <DialogDescription className="pt-2 text-sm text-foreground/80">
            Are you sure you want to delete <span className="font-semibold text-foreground">{productName}</span>?
          </DialogDescription>
        </DialogHeader>

        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md border space-y-1">
          <p>• The product will be removed from the catalogue and customer storefront.</p>
          <p>• Unsold / available stock units for this product will be removed.</p>
          <p>• Products with units actively reserved in open checkout sessions cannot be deleted.</p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button variant="ghost" disabled={isDeleting}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            className="gap-1.5"
          >
            {isDeleting && <Loader2 className="size-4 animate-spin" />}
            Confirm Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
