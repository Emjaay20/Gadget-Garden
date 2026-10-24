import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { StaffManager } from "@/components/staff/staff-manager";
import { api, ApiError } from "@/lib/server/api";
import type { StaffUser } from "@/lib/types";

export const metadata: Metadata = {
  title: "Staff & Access Control · Gadgets Garden",
};

export default async function StaffPage() {
  let user: StaffUser;

  try {
    const res = await api<{ data: StaffUser }>("/me");
    user = res.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/login");
    }
    throw error;
  }

  if (!user.permissions.includes("staff.manage")) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
          <h2 className="text-base font-semibold text-destructive">Access Restricted</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Only store owners have permission to manage team accounts and access levels.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Team & Access Control</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage staff members, roles, store permissions, and credential security.
        </p>
      </div>

      <StaffManager currentUser={user} />
    </div>
  );
}
