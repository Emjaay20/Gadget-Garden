"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Loader2, ShieldCheck, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { StaffUser } from "@/lib/types";

interface ProfileDialogProps {
  user: StaffUser;
}

export function ProfileDialog({ user }: ProfileDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  // Profile Form State
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Security / Password State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Full name cannot be empty.");
      return;
    }

    setIsUpdatingProfile(true);
    try {
      const res = await fetch("/admin/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? "Failed to update profile.");
      }

      toast.success("Profile details updated successfully!");
      router.refresh();
      setOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setIsUpdatingProfile(false);
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Please enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await fetch("/admin/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          password: newPassword,
          password_confirmation: confirmPassword,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? "Failed to change password.");
      }

      toast.success("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Password update failed.");
    } finally {
      setIsUpdatingPassword(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-accent/40 px-3 py-1.5 text-left transition hover:bg-accent hover:border-border cursor-pointer select-none"
        >
          <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium text-xs">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="text-right leading-tight hidden sm:block">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-muted-foreground text-xs capitalize">{user.role}</p>
          </div>
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <UserIcon className="size-5 text-primary" />
            Account & Security Settings
          </DialogTitle>
          <DialogDescription>
            Manage your personal profile, credentials, and view your store permissions.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Profile Info</TabsTrigger>
            <TabsTrigger value="security">Password & Roles</TabsTrigger>
          </TabsList>

          {/* Profile Details Tab */}
          <TabsContent value="details">
            <form onSubmit={handleUpdateProfile} className="space-y-4 pt-3">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Full Name</Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-email">Email Address</Label>
                <Input
                  id="profile-email"
                  value={user.email}
                  disabled
                  className="bg-muted text-muted-foreground cursor-not-allowed"
                />
                <p className="text-[11px] text-muted-foreground">
                  Email changes must be performed by the store owner in Staff Management.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-phone">Phone Number (WhatsApp)</Label>
                <Input
                  id="profile-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 08012345678"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isUpdatingProfile}>
                  {isUpdatingProfile ? (
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
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <form onSubmit={handleUpdatePassword} className="space-y-4 pt-3">
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Assigned Role:</span>
                  <Badge variant="secondary" className="capitalize font-semibold">
                    {user.role ?? "Staff"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {user.permissions.map((p) => (
                    <span
                      key={p}
                      className="inline-flex items-center rounded-sm bg-background border px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="curr-pass" className="text-xs">Current Password</Label>
                  <Input
                    id="curr-pass"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="new-pass" className="text-xs">New Password</Label>
                  <Input
                    id="new-pass"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-pass" className="text-xs">Confirm New Password</Label>
                  <Input
                    id="confirm-pass"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    required
                  />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isUpdatingPassword}>
                  {isUpdatingPassword ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
