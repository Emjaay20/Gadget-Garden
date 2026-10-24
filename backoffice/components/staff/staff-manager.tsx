"use client";

import { useEffect, useState } from "react";
import {
  Edit3,
  Loader2,
  Mail,
  Phone,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateStaffDialog } from "@/components/staff/create-staff-dialog";
import { EditStaffDialog } from "@/components/staff/edit-staff-dialog";
import type { StaffUser } from "@/lib/types";

interface StaffManagerProps {
  currentUser: StaffUser;
}

export function StaffManager({ currentUser }: StaffManagerProps) {
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);

  async function fetchStaff() {
    setIsLoading(true);
    try {
      const res = await fetch("/admin/api/staff");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? "Could not load staff list.");
      }
      setStaffList(json.data ?? []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load staff.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchStaff();
  }, []);

  const filteredStaff = staffList.filter((s) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.role ?? "").toLowerCase().includes(q) ||
      (s.phone ?? "").toLowerCase().includes(q)
    );
  });

  const activeCount = staffList.filter((s) => s.is_active).length;
  const ownerCount = staffList.filter((s) => s.role === "owner").length;
  const managerCount = staffList.filter((s) => s.role === "manager").length;
  const salesCount = staffList.filter((s) => s.role === "sales").length;

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{staffList.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeCount} active, {staffList.length - activeCount} suspended
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Store Owners</CardTitle>
            <Shield className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ownerCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Full pricing & admin control</p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Managers</CardTitle>
            <ShieldCheck className="size-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{managerCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Stock movements & unit intake</p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sales Reps</CardTitle>
            <UserCheck className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Order fulfilment & dispatch</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Staff Table Card */}
      <Card className="shadow-none">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
          <div>
            <CardTitle className="text-lg">Staff & Role Access Control</CardTitle>
            <CardDescription>
              Create team member accounts, assign roles, manage active status, and maintain store access security.
            </CardDescription>
          </div>
          <CreateStaffDialog onCreated={fetchStaff} />
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {/* Search Bar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search staff by name, email, role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              <Loader2 className="mr-2 size-5 animate-spin" />
              Loading team directory...
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              No staff members match your search.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Member</TableHead>
                    <TableHead>Role & Permissions</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff.map((staff) => {
                    const isSelf = staff.id === currentUser.id;

                    return (
                      <TableRow key={staff.id} className={!staff.is_active ? "opacity-60 bg-muted/20" : ""}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium text-xs shrink-0">
                              {staff.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">{staff.name}</span>
                                {isSelf && (
                                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                                    You
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Mail className="size-3" />
                                {staff.email}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="space-y-1">
                            <Badge
                              variant={
                                staff.role === "owner"
                                  ? "default"
                                  : staff.role === "manager"
                                    ? "secondary"
                                    : "outline"
                              }
                              className="capitalize text-xs"
                            >
                              {staff.role === "owner"
                                ? "Store Owner"
                                : staff.role === "manager"
                                  ? "Manager"
                                  : "Sales Rep"}
                            </Badge>
                            <p className="text-[11px] text-muted-foreground">
                              {staff.role === "owner"
                                ? "Full store & catalog control"
                                : staff.role === "manager"
                                  ? "Inventory intake & stock adjustments"
                                  : "Order shipping & customer service"}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell>
                          {staff.phone ? (
                            <span className="text-xs font-mono flex items-center gap-1 text-muted-foreground">
                              <Phone className="size-3" />
                              {staff.phone}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </TableCell>

                        <TableCell>
                          {staff.is_active ? (
                            <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 text-xs gap-1">
                              <ShieldCheck className="size-3" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-destructive/40 text-destructive bg-destructive/10 text-xs gap-1">
                              <ShieldAlert className="size-3" />
                              Suspended
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground">
                          {staff.last_login_at
                            ? new Date(staff.last_login_at).toLocaleDateString("en-NG", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Never"}
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 text-xs"
                            onClick={() => setEditingStaff(staff)}
                          >
                            <Edit3 className="size-3.5" />
                            Manage
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Staff Dialog */}
      {editingStaff && (
        <EditStaffDialog
          staff={editingStaff}
          open={!!editingStaff}
          onOpenChange={(open) => !open && setEditingStaff(null)}
          onUpdated={fetchStaff}
        />
      )}
    </div>
  );
}
