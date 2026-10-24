"use client";

import { useState } from "react";
import { Copy, Check, KeyRound, Loader2, UserPlus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CreateStaffDialogProps {
  onCreated: () => void;
}

export function CreateStaffDialog({ onCreated }: CreateStaffDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<string>("sales");
  const [customPassword, setCustomPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Success result containing generated credentials
  const [createdResult, setCreatedResult] = useState<{
    email: string;
    temporaryPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter the staff member's name.");
      return;
    }
    if (!email.trim()) {
      toast.error("Please enter an email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        phone: phone.trim() || null,
      };

      if (customPassword.trim()) {
        payload.password = customPassword.trim();
      }

      const res = await fetch("/admin/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? "Could not create staff member.");
      }

      const tempPass = json.meta?.temporary_password || customPassword.trim() || "Configured";
      setCreatedResult({
        email: email.trim().toLowerCase(),
        temporaryPassword: tempPass,
      });

      toast.success(`Staff member "${name}" created successfully!`);
      onCreated();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error creating staff.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCopyCredentials() {
    if (!createdResult) return;
    const text = `Gadgets Garden Staff Login:\nEmail: ${createdResult.email}\nPassword: ${createdResult.temporaryPassword}\nLogin Portal: https://gadgetsgarden.aetherhost.com.ng/admin/login`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Credentials copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  }

  function handleClose() {
    setOpen(false);
    setCreatedResult(null);
    setName("");
    setEmail("");
    setPhone("");
    setRole("sales");
    setCustomPassword("");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? handleClose() : setOpen(true))}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <UserPlus className="size-4" />
          Add Staff Member
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[460px]">
        {createdResult ? (
          <div className="space-y-4 py-2">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <Check className="size-5" />
                Staff Member Created!
              </DialogTitle>
              <DialogDescription>
                Provide these initial credentials to the team member so they can access the backoffice.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border bg-muted/50 p-4 space-y-3 font-mono text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px] font-sans">Login Email:</span>
                <span className="font-semibold text-foreground text-sm">{createdResult.email}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-sans">Temporary Password:</span>
                <span className="font-semibold text-primary text-sm tracking-wide">
                  {createdResult.temporaryPassword}
                </span>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto gap-2"
                onClick={handleCopyCredentials}
              >
                {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy Login Credentials"}
              </Button>
              <Button type="button" className="w-full sm:w-auto" onClick={handleClose}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="size-5 text-primary" />
                Add Staff Member
              </DialogTitle>
              <DialogDescription>
                Assign roles and grant access to the backoffice portal.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="staff-name">Full Name</Label>
                <Input
                  id="staff-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Babatunde Adebayo"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="staff-email">Email Address</Label>
                <Input
                  id="staff-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@gadgetsgarden.ng or personal email"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Works with company domain or any standard email.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="staff-role">Role & Access</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger id="staff-role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">Sales (Orders & Shipments)</SelectItem>
                      <SelectItem value="manager">Manager (Inventory & Stock)</SelectItem>
                      <SelectItem value="owner">Co-Owner (Full Access)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="staff-phone">Phone / WhatsApp</Label>
                  <Input
                    id="staff-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="080 0000 0000"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="staff-pass" className="flex items-center justify-between">
                  <span>Initial Password (Optional)</span>
                  <span className="text-[11px] text-muted-foreground font-normal">
                    Leave blank to auto-generate
                  </span>
                </Label>
                <Input
                  id="staff-pass"
                  type="text"
                  value={customPassword}
                  onChange={(e) => setCustomPassword(e.target.value)}
                  placeholder="Custom initial password (min 8 chars)"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Staff Member"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
