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

interface DeleteUnitDialogProps {
  sku: string;
  serial?: string | null;
}

export function DeleteUnitDialog({ sku, serial }: DeleteUnitDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);

    try {
      const response = await fetch(`/admin/api/inventory/units/${encodeURIComponent(sku)}`, {
        method: "DELETE",
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg =
          body.errors?.unit?.[0] ??
          body.message ??
          "Could not delete machine unit.";
        toast.error(errorMsg);
        setIsDeleting(false);
        return;
      }

      toast.success(body.message ?? `Unit "${sku}" deleted successfully.`);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Network error while deleting unit.");
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          title={`Delete machine ${sku}`}
          aria-label={`Delete machine ${sku}`}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Machine Unit</DialogTitle>
          <DialogDescription className="pt-2 text-sm text-foreground/80">
            Are you sure you want to delete unit <span className="font-semibold text-foreground">{sku}</span>
            {serial && ` (Serial: ${serial})`}?
          </DialogDescription>
        </DialogHeader>

        <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md border">
          This unit will be removed from available inventory. Machines that have already been sold or reserved cannot be deleted.
        </p>

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
