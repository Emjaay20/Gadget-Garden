"use client";

import { CheckCircle2, HelpCircle, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function GradingGuideDialog({
  triggerText = "What does this grade mean?",
}: {
  triggerText?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition"
        >
          <HelpCircle className="size-3.5" />
          {triggerText}
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="size-5" />
            <span className="text-xs font-semibold tracking-wider uppercase">
              Inspection Standard
            </span>
          </div>
          <DialogTitle className="text-lg font-bold">
            Gadgets Garden Hardware Grading Scale
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Every machine arriving at our Computer Village showroom undergoes a 25-point hardware stress test before listing. Here is our cosmetic and battery benchmark.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4 text-sm">
          {/* Grade A+ */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                Grade A+ (Mint / Like New)
              </span>
              <span className="rounded bg-emerald-600/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Flawless
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              No visible scratches, zero chassis dents, screen is 100% spotless with pristine anti-reflective coating. Battery health tested at 90% – 100%. Keyboard and trackpad show zero gloss or wear.
            </p>
          </div>

          {/* Grade A */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Grade A (Excellent Condition)</span>
              <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                Showroom Clean
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              Extremely clean body. May show micro-scuffs on bottom panel from desk resting, invisible from normal viewing distance. Screen is free of scratches or dead pixels. Battery health verified at 85% – 95%.
            </p>
          </div>

          {/* Grade B */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Grade B (Value Workhorse)</span>
              <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                High Value Savings
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              100% internally flawless motherboard, CPU, and RAM. Light cosmetic handling marks or transit scuffs on outer lid. Fully tested keyboard and display. Ideal for power users who prioritize specs over exterior perfection.
            </p>
          </div>

          {/* 25-Point Checklist */}
          <div className="rounded-xl bg-muted/40 p-4">
            <div className="flex items-center gap-1.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
              <Wrench className="size-3.5" />
              Our 25-Point Pre-Listing Stress Test
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                <span>CPU / GPU thermal throttling</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                <span>Display backlight & RGB pixels</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                <span>SSD read/write health & SMART</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                <span>Battery cycle count & capacity</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                <span>Thunderbolt & HDMI output</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                <span>Full keyboard & trackpad latency</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
