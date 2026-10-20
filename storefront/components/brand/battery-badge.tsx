import { BatteryCharging, Battery, BatteryMedium, BatteryLow } from "lucide-react";
import { cn } from "@/lib/utils";

export function BatteryBadge({
  health,
  className,
  size = "default",
}: {
  health: number;
  className?: string;
  size?: "default" | "sm";
}) {
  const isExcellent = health >= 90;
  const isVeryGood = health >= 85 && health < 90;
  const isGood = health >= 80 && health < 85;

  const toneClass = isExcellent
    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
    : isVeryGood
      ? "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/30"
      : isGood
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
        : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30";

  const Icon = isExcellent
    ? BatteryCharging
    : isVeryGood
      ? Battery
      : isGood
        ? BatteryMedium
        : BatteryLow;

  const label = isExcellent
    ? "Certified Peak"
    : isVeryGood
      ? "Solid Health"
      : isGood
        ? "Good Health"
        : "Moderate";

  return (
    <span
      title={`Verified battery health: ${health}% (${label})`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        toneClass,
        className,
      )}
    >
      <Icon className={size === "sm" ? "size-3" : "size-3.5"} />
      <span>{health}% Battery</span>
      <span className="opacity-75 text-[10px] hidden sm:inline">({label})</span>
    </span>
  );
}
