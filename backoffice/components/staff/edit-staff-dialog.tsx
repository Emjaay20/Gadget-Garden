"use client";

import { useState } from "react";
import { Edit2, KeyRound, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StaffUser } from "@/lib/types";

interface EditStaffDialogProps {
  staff: StaffUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function EditStaffDialog({ staff, open, onOpenChange, onUpdated }: EditStaffDialogProps) {
  const [name, setName] = useState(staff.name);
  const [role, setRole] = useState<string>(staff.role ?? "sales");
  const [phone, setPhone] = useState(staff.phone ?? "");
  const [isActive, setIsActive] = useState(staff.is_active);
  const [newPassword, setNewPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        role,
        phone: phone.trim() || null,
        is_active: isActive,
      };

      if (newPassword.trim()) {
        if (newPassword.trim().length < 8) {
          toast.error("Password must be at least 8 characters.");
          setIsSubmitting(false);
          return;
        }
        payload.password = newPassword.trim();
      }

      const res = await fetch(`/admin/api/staff/${staff.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? "Could not update staff member.");
      }

      toast.success(`Staff member "${name}" updated successfully!`);
      onOpenChange(false);
      onUpdated();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <form onSubmit={handleSave} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="size-5 text-primary" />
              Edit Staff Member
            </DialogTitle>
            <DialogDescription>
              Update permissions, role status, or reset credentials for {staff.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email Address</Label>
              <Input
                id="edit-email"
                value={staff.email}
                disabled
                className="bg-muted text-muted-foreground cursor-not-allowed"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-role">Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger id="edit-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales">Sales (Fulfilment)</SelectItem>
                    <SelectItem value="manager">Manager (Stock)</SelectItem>
                    <SelectItem value="owner">Owner (Full)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-phone">Phone Number</Label>
                <Input
                  id="edit-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="080 0000 0000"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-status">Account Status</Label>
              <Select
                value={isActive ? "active" : "suspended"}
                onValueChange={(val) => setIsActive(val === "active")}
              >
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active (Access Allowed)</SelectItem>
                  <SelectItem value="suspended">Suspended (Revoke Access)</SelectItem>
                </SelectContent>
              </Select>
              {!isActive && (
                <p className="text-[11px] text-destructive flex items-center gap-1 mt-1">
                  <ShieldAlert className="size-3.5 shrink-0" />
                  Suspending instantly terminates all active login sessions.
                </p>
              )}
            </div>

            <div className="space-y-1.5 pt-1">
              <Label htmlFor="edit-reset-pass" className="flex items-center gap-1.5 text-xs">
                <KeyRound className="size-3.5 text-muted-foreground" />
                Reset Password (Optional)
              </Label>
              <Input
                id="edit-reset-pass"
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password to overwrite"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
