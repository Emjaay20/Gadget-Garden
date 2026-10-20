"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Boxes, ChartLine, Handshake, History, LogOut, Package, ScrollText } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Permission, StaffUser } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The dashboard's top bar.
 *
 * Links are filtered by the signed-in user's permissions. That is presentation,
 * not security — every route is enforced server-side too. Hiding them is about
 * not offering a receptionist a page that will only 403 at them.
 */
const LINKS: Array<{
  href: string;
  label: string;
  icon: typeof Package;
  requires: Permission;
}> = [
  { href: "/orders", label: "Orders", icon: Package, requires: "orders.view" },
  { href: "/offers", label: "Negotiations", icon: Handshake, requires: "offers.manage" },
  { href: "/inventory", label: "Inventory", icon: Boxes, requires: "inventory.view" },
  { href: "/ledger", label: "Stock ledger", icon: ScrollText, requires: "inventory.view" },
  // Owner-only: margin exposes what the business paid.
  { href: "/reports", label: "Sales", icon: ChartLine, requires: "reports.view" },
  { href: "/audit-logs", label: "Audit trail", icon: History, requires: "audit.view" },
];

export function DashboardNav({ user }: { user: StaffUser }) {
  const pathname = usePathname();
  const router = useRouter();

  const visible = LINKS.filter((link) => user.permissions.includes(link.requires));

  async function signOut() {
    await fetch("/admin/api/logout", { method: "POST" });
    router.refresh();
    router.push("/login");
  }

  return (
    <header className="bg-background sticky top-0 z-40 border-b">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/orders" className="font-semibold tracking-tight">
          Gadgets Garden
        </Link>

        <nav className="flex items-center gap-1">
          {visible.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="text-right leading-tight">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-muted-foreground text-xs capitalize">{user.role}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sign out">
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
