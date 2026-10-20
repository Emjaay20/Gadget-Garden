"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

export type CompareItem = {
  productId: string;
  productSlug: string;
  name: string;
  brand?: string | null;
  price: number;
  imageUrl?: string | null;
  condition?: string | null;
  grade?: string | null;
  warrantyMonths?: number;
  specs: Record<string, unknown>;
  unitId?: string | null;
  unitSku?: string | null;
};

const STORAGE_KEY = "gg_compare_v1";
const listeners = new Set<() => void>();
let cachedSnapshot: readonly CompareItem[] = [];

function getSnapshot(): readonly CompareItem[] {
  return cachedSnapshot;
}

function getServerSnapshot(): readonly CompareItem[] {
  return [];
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

function write(next: readonly CompareItem[]): void {
  cachedSnapshot = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // quota exceeded or private mode
  }
  notify();
}

function readStored(): readonly CompareItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

if (typeof window !== "undefined") {
  cachedSnapshot = readStored();
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      cachedSnapshot = readStored();
      notify();
    }
  });
}

export function useCompare() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const addItem = useCallback((item: CompareItem) => {
    const current = getSnapshot();
    if (current.some((i) => i.productId === item.productId && i.unitSku === item.unitSku)) {
      return;
    }
    // Limit to max 3 items for side-by-side comparison
    const updated = current.length >= 3 ? [...current.slice(1), item] : [...current, item];
    write(updated);
  }, []);

  const removeItem = useCallback((identifier: string) => {
    const current = getSnapshot();
    write(current.filter((i) => (i.unitSku ?? i.productId) !== identifier));
  }, []);

  const clear = useCallback(() => {
    write([]);
  }, []);

  const isInCompare = useCallback(
    (identifier: string) => {
      return items.some((i) => (i.unitSku ?? i.productId) === identifier);
    },
    [items],
  );

  return useMemo(
    () => ({
      items,
      count: items.length,
      addItem,
      removeItem,
      clear,
      isInCompare,
    }),
    [items, addItem, removeItem, clear, isInCompare],
  );
}
