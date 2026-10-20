"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Condition } from "@/lib/types";

type Row = {
  sku: string;
  serial: string;
  condition: Condition;
  grade: string;
  price: string;
  cost: string;
  cpu: string;
  ram_gb: string;
  storage_gb: string;
  battery_health: string;
};

function blankRow(): Row {
  return {
    sku: "",
    serial: "",
    condition: "foreign_used",
    grade: "",
    price: "",
    cost: "",
    cpu: "",
    ram_gb: "",
    storage_gb: "",
    battery_health: "",
  };
}

/**
 * Bulk intake — a shipment, entered as a batch.
 *
 * A box of laptops arrives together and is entered together, so this is a
 * repeating row rather than a form you submit once per machine. The API takes
 * the whole batch in one transaction: if any row is bad, NOTHING is recorded.
 * That is the behaviour worth having, because half a shipment in the database
 * is worse than none — the shelf and the system then disagree silently.
 *
 * The last row can duplicate the one above it, because machines in a shipment
 * are usually near-identical and retyping four spec fields per unit is how
 * mistakes get made.
 */
export function IntakeForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([blankRow()]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const update = (index: number, patch: Partial<Row>) =>
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );

  const addRow = () =>
    setRows((current) => [
      ...current,
      // Carry the previous row's shape forward — same model, same specs, new
      // SKU. Only the identifying fields are cleared.
      current.length > 0
        ? { ...current[current.length - 1], sku: "", serial: "" }
        : blankRow(),
    ]);

  const removeRow = (index: number) =>
    setRows((current) =>
      current.length === 1 ? current : current.filter((_, i) => i !== index),
    );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});

    const payload = {
      units: rows.map((row) => ({
        sku: row.sku.trim(),
        serial: row.serial.trim() || undefined,
        condition: row.condition,
        grade: row.grade || undefined,
        price: Number(row.price),
        cost: row.cost ? Number(row.cost) : undefined,
        specs: {
          cpu: row.cpu.trim() || undefined,
          ram_gb: row.ram_gb ? Number(row.ram_gb) : undefined,
          storage_gb: row.storage_gb ? Number(row.storage_gb) : undefined,
          battery_health: row.battery_health
            ? Number(row.battery_health)
            : undefined,
        },
      })),
    };

    const response = await fetch(`/api/inventory/${slug}/units`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setBusy(false);

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setErrors(body.errors ?? {});
      toast.error(body.message ?? "Nothing was saved — check the rows below.");

      return;
    }

    const body = await response.json();
    toast.success(`${body.meta.created} machine(s) added to stock.`);
    setRows([blankRow()]);
    router.refresh();
  }

  /** Laravel reports per-row errors as `units.0.sku`. */
  const rowError = (index: number, field: string) =>
    errors[`units.${index}.${field}`]?.[0];

  return (
    <form onSubmit={submit} className="mt-4 space-y-4">
      {rows.map((row, index) => (
        <div key={index} className="rounded-xl border p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">
              Machine {index + 1}
            </span>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remove machine ${index + 1}`}
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="SKU"
              value={row.sku}
              onChange={(v) => update(index, { sku: v })}
              error={rowError(index, "sku")}
              required
            />
            <Field
              label="Serial"
              value={row.serial}
              onChange={(v) => update(index, { serial: v })}
              error={rowError(index, "serial")}
            />

            <div className="grid gap-1.5">
              <Label className="text-xs">Condition</Label>
              <Select
                value={row.condition}
                onValueChange={(v) => update(index, { condition: v as Condition })}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="foreign_used">Foreign used</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="refurbished">Refurbished</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">Grade</Label>
              <Select
                value={row.grade || "none"}
                onValueChange={(v) => update(index, { grade: v === "none" ? "" : v })}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                  <SelectItem value="C">C</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Field
              label="Price (₦)"
              value={row.price}
              onChange={(v) => update(index, { price: v })}
              error={rowError(index, "price")}
              type="number"
              required
            />
            <Field
              label="Cost (₦)"
              value={row.cost}
              onChange={(v) => update(index, { cost: v })}
              error={rowError(index, "cost")}
              type="number"
            />
            <Field
              label="CPU"
              value={row.cpu}
              onChange={(v) => update(index, { cpu: v })}
            />
            <Field
              label="RAM (GB)"
              value={row.ram_gb}
              onChange={(v) => update(index, { ram_gb: v })}
              type="number"
            />
            <Field
              label="Storage (GB)"
              value={row.storage_gb}
              onChange={(v) => update(index, { storage_gb: v })}
              type="number"
            />
            <Field
              label="Battery %"
              value={row.battery_health}
              onChange={(v) => update(index, { battery_health: v })}
              type="number"
            />
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="size-4" />
          Add another
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          Receive {rows.length} machine{rows.length === 1 ? "" : "s"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        value={value}
        type={type}
        required={required}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="h-9"
      />
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
