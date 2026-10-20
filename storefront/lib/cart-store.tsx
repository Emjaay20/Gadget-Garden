"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * The cart.
 *
 * WHAT IS STORED IS ONLY IDENTIFIERS AND QUANTITIES — never prices, never
 * names. Everything displayed is re-read from the API (`POST /api/shop/cart`),
 * for two reasons:
 *
 *   1. A price cached in localStorage is a price a customer might later argue
 *      for. The server prices every line at checkout regardless, so a stale
 *      local copy could only ever disagree with what they are charged.
 *   2. Serialized stock disappears. A laptop added on Monday may be sold by
 *      Wednesday, and the cart must say so before the customer types an
 *      address — not after.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY `useSyncExternalStore` RATHER THAN useState + useEffect
 *
 * localStorage IS an external store shared across tabs, which is precisely what
 * this hook exists for. It gives us three things a state-plus-effect version had
 * to hand-roll and got subtly wrong:
 *
 *   - a defined SSR snapshot, so the server renders an empty cart and hydration
 *     cannot mismatch;
 *   - cross-tab sync through the same subscription, with no second effect;
 *   - no synchronous setState during an effect, which cascades renders (and
 *     which React 19's linter correctly refuses).
 *
 * The snapshot must be REFERENTIALLY STABLE between reads or the hook loops
 * forever re-rendering — hence the parsed cache below, invalidated only on
 * write or on a storage event.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type CartEntry = {
  /** Exactly one of these is set. */
  product_unit_id?: string;
  product_id?: string;
  quantity: number;
};

const STORAGE_KEY = "gg_cart_v1";

/** The key format the API echoes back on each resolved line. */
export function entryKey(entry: CartEntry): string {
  return entry.product_unit_id
    ? `unit:${entry.product_unit_id}`
    : `product:${entry.product_id}`;
}

/* ------------------------------------------------------------------ store */

const listeners = new Set<() => void>();

/**
 * The last parsed value. `useSyncExternalStore` compares snapshots by identity,
 * so returning a freshly-parsed array on every call would re-render forever.
 */
let cache: readonly CartEntry[] = [];
let cacheIsFresh = false;

/**
 * Server and pre-hydration snapshot.
 *
 * Typed `readonly` rather than cast: `useSyncExternalStore` compares snapshots
 * by identity, so this single frozen instance must be returned every time, and
 * nothing downstream may mutate it in place.
 */
const EMPTY: readonly CartEntry[] = Object.freeze([]);

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);

  // Another tab wrote to the cart.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cacheIsFresh = false;
      onChange();
    }
  };

  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): readonly CartEntry[] {
  if (!cacheIsFresh) {
    cache = readStored();
    cacheIsFresh = true;
  }

  return cache;
}

function getServerSnapshot(): readonly CartEntry[] {
  return EMPTY;
}

function write(next: readonly CartEntry[]): void {
  cache = next;
  cacheIsFresh = true;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private browsing, or a full quota. A cart that cannot persist is a
    // degraded experience, not a broken one — carry on in memory.
  }

  listeners.forEach((listener) => listener());
}

function readStored(): readonly CartEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) return EMPTY;

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return EMPTY;

    // Anything hand-edited in devtools is discarded rather than trusted. The
    // server re-validates regardless, but a malformed entry here would render
    // as a broken row instead of being quietly dropped.
    return parsed.filter(
      (entry): entry is CartEntry =>
        entry &&
        typeof entry === "object" &&
        typeof entry.quantity === "number" &&
        entry.quantity > 0 &&
        (typeof entry.product_unit_id === "string" ||
          typeof entry.product_id === "string"),
    );
  } catch {
    return EMPTY;
  }
}

/* ------------------------------------------------------------------- hook */

/**
 * True once the browser store is the source of truth.
 *
 * Before hydration both snapshots are the frozen empty array, so a count badge
 * rendered unconditionally would flash 0 → N. This lets callers hold it back.
 */
function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

export function useCart() {
  const entries = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isReady = useIsHydrated();

  const addUnit = useCallback((unitId: string) => {
    const current = getSnapshot();

    // A serialized machine is one-of-a-kind: adding it twice is meaningless, so
    // this is idempotent rather than incrementing a quantity.
    if (current.some((entry) => entry.product_unit_id === unitId)) return;

    write([...current, { product_unit_id: unitId, quantity: 1 }]);
  }, []);

  const addProduct = useCallback((productId: string, quantity = 1) => {
    const current = getSnapshot();
    const existing = current.find((entry) => entry.product_id === productId);

    write(
      existing
        ? current.map((entry) =>
            entry.product_id === productId
              ? { ...entry, quantity: entry.quantity + quantity }
              : entry,
          )
        : [...current, { product_id: productId, quantity }],
    );
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    write(
      getSnapshot()
        .map((entry) =>
          entryKey(entry) === key
            ? { ...entry, quantity: Math.max(0, quantity) }
            : entry,
        )
        .filter((entry) => entry.quantity > 0),
    );
  }, []);

  const remove = useCallback((key: string) => {
    write(getSnapshot().filter((entry) => entryKey(entry) !== key));
  }, []);

  const clear = useCallback(() => write([]), []);

  return useMemo(
    () => ({
      entries,
      /** Total item count, for the header badge. */
      count: entries.reduce((total, entry) => total + entry.quantity, 0),
      isReady,
      addUnit,
      addProduct,
      setQuantity,
      remove,
      clear,
      has: (key: string) => entries.some((entry) => entryKey(entry) === key),
    }),
    [entries, isReady, addUnit, addProduct, setQuantity, remove, clear],
  );
}

/**
 * Kept as a no-op boundary so the root layout still reads as declaring a cart,
 * and so a future move to context (or a server-backed cart) has an obvious seam
 * to land on. The store itself is module-level and needs no provider.
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
