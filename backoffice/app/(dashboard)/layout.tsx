import { redirect } from "next/navigation";

import { DashboardNav } from "@/components/layout/dashboard-nav";
import { api, ApiError } from "@/lib/server/api";
import type { StaffUser } from "@/lib/types";

/**
 * The authenticated shell.
 *
 * The guard lives HERE rather than in a proxy (Next 16's renamed middleware),
 * and deliberately so: a proxy can only see whether a cookie exists, not whether
 * the token inside it is still valid. Calling `/api/me` proves the session is
 * live — it catches a token revoked when staff were deactivated, which is
 * exactly the case `EnsureUserIsActive` exists for and exactly what a
 * cookie-presence check would miss.
 *
 * It also gives every page below the user's permissions without a second fetch.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user: StaffUser;

  try {
    const response = await api<{ data: StaffUser }>("/me");
    user = response.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/login");
    }

    throw error;
  }

  return (
    <div className="flex min-h-svh flex-col">
      <DashboardNav user={user} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
