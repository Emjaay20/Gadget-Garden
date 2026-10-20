import type { Metadata } from "next";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/server/api";
import { shortDateTime } from "@/lib/format";
import type { AuditLogItem, Paginated } from "@/lib/types";

export const metadata: Metadata = { title: "Audit Trail · Gadgets Garden" };

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; search?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Trail</h1>
          <p className="text-muted-foreground mt-0.5 text-sm text-pretty">
            Immutable log of critical operations, price updates, order settlements, and staff actions.
          </p>
        </div>
      </div>

      <Suspense fallback={<Skeleton className="mt-8 h-96" />}>
        <AuditLogTable action={params.action} search={params.search} />
      </Suspense>
    </div>
  );
}

async function AuditLogTable({ action, search }: { action?: string; search?: string }) {
  const query = new URLSearchParams();
  if (action) query.set("action", action);
  if (search) query.set("search", search);

  const qs = query.toString();
  const path = qs ? `/audit-logs?${qs}` : "/audit-logs";

  const { data } = await api<Paginated<AuditLogItem>>(path);

  if (!data || data.length === 0) {
    return (
      <p className="text-muted-foreground py-16 text-center text-sm">
        No audit entries recorded yet.
      </p>
    );
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-muted-foreground">
            <th className="py-2.5 px-4 font-medium">Timestamp</th>
            <th className="py-2.5 px-4 font-medium">Actor</th>
            <th className="py-2.5 px-4 font-medium">Action</th>
            <th className="py-2.5 px-4 font-medium">Description</th>
            <th className="py-2.5 px-4 font-medium">IP Address</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.map((item) => (
            <tr key={item.id} className="hover:bg-muted/30 transition-colors">
              <td className="py-3 px-4 text-xs text-muted-foreground font-mono whitespace-nowrap">
                {shortDateTime(item.created_at)}
              </td>
              <td className="py-3 px-4 font-medium">
                {item.user ? (
                  <div>
                    <span className="text-foreground">{item.user.name}</span>
                    <span className="block text-xs text-muted-foreground">{item.user.email}</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic">System</span>
                )}
              </td>
              <td className="py-3 px-4 whitespace-nowrap">
                <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-mono font-medium text-secondary-foreground">
                  {item.action}
                </span>
              </td>
              <td className="py-3 px-4 max-w-md text-foreground">
                <p className="line-clamp-2">{item.description}</p>
                {item.new_values && Object.keys(item.new_values).length > 0 && (
                  <pre className="mt-1 text-[11px] text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5 inline-block">
                    {JSON.stringify(item.new_values)}
                  </pre>
                )}
              </td>
              <td className="py-3 px-4 text-xs text-muted-foreground font-mono whitespace-nowrap">
                {item.ip_address ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
