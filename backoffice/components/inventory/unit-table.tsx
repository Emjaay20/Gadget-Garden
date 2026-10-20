import { DeleteUnitDialog } from "@/components/inventory/delete-unit-dialog";
import { margin, naira, specSummary } from "@/lib/format";
import type { ProductUnit, UnitStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Every machine on record, sold ones included.
 *
 * The storefront hides anything unavailable; this must not. "Where did that
 * ThinkPad go" is answered by the sold rows, and for one-of-a-kind stock that is
 * a question staff genuinely ask.
 */
const STATUS: Record<UnitStatus, { label: string; className: string }> = {
  available: {
    label: "Available",
    className: "text-emerald-700 dark:text-emerald-400",
  },
  reserved: {
    label: "Reserved",
    className: "text-amber-700 dark:text-amber-400",
  },
  sold: { label: "Sold", className: "text-muted-foreground" },
  returned: { label: "Returned", className: "text-muted-foreground" },
  faulty: { label: "Faulty", className: "text-destructive" },
};

export function UnitTable({ units }: { units: ProductUnit[] }) {
  if (units.length === 0) {
    return (
      <p className="text-muted-foreground mt-4 text-sm">
        No machines on record for this listing yet.
      </p>
    );
  }

  // Present only when the viewer holds `reports.view` — decided by the API.
  const showCost = units.some((unit) => unit.cost !== null && unit.cost !== undefined);

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground border-b text-left">
            <th className="py-2 pr-4 font-medium">SKU</th>
            <th className="py-2 pr-4 font-medium">Specs</th>
            <th className="py-2 pr-4 font-medium">Condition</th>
            <th className="py-2 pr-4 text-right font-medium">Price</th>
            {showCost && (
              <th className="py-2 pr-4 text-right font-medium">Cost / margin</th>
            )}
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {units.map((unit) => {
            const m = margin(unit.price, unit.cost);
            const tone = STATUS[unit.status];

            return (
              <tr
                key={unit.id}
                className={cn("border-b", unit.status === "sold" && "opacity-60")}
              >
                <td className="gg-numeric py-3 pr-4 font-medium">
                  {unit.sku}
                  {unit.serial && (
                    <div className="text-muted-foreground text-xs font-normal">
                      {/* Staff need this for warranty claims; the storefront
                          never sees it. */}
                      {unit.serial}
                    </div>
                  )}
                </td>
                <td className="text-muted-foreground gg-numeric py-3 pr-4">
                  {specSummary(unit.specs) || "—"}
                  {unit.specs.battery_health != null && (
                    <div className="text-xs">
                      Battery {unit.specs.battery_health}%
                    </div>
                  )}
                </td>
                <td className="text-muted-foreground py-3 pr-4 capitalize">
                  {unit.condition.replace("_", " ")}
                  {unit.grade && ` · ${unit.grade}`}
                </td>
                <td className="gg-numeric py-3 pr-4 text-right font-medium">
                  {naira(unit.price)}
                </td>
                {showCost && (
                  <td className="gg-numeric py-3 pr-4 text-right">
                    {unit.cost != null ? (
                      <>
                        {naira(unit.cost)}
                        {m && (
                          <div className="text-muted-foreground text-xs">
                            +{naira(m.profit)} ({m.percent}%)
                          </div>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                <td className={cn("py-3 pr-4 text-xs font-medium", tone.className)}>
                  {tone.label}
                </td>
                <td className="py-3 text-right">
                  {unit.status !== "sold" && unit.status !== "reserved" && (
                    <DeleteUnitDialog sku={unit.sku} serial={unit.serial} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
