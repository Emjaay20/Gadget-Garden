import type { CatalogueQuery, Condition } from "@/lib/types";

const SORTS = ["featured", "price_asc", "price_desc", "newest"] as const;
const CONDITIONS: Condition[] = ["new", "foreign_used", "refurbished"];

type RawSearchParams = Record<string, string | string[] | undefined>;

/**
 * Parse the URL into a filter state.
 *
 * The URL is user input — it is edited by hand, shared, and bookmarked — so
 * everything is validated here rather than forwarded blindly. The API validates
 * again and would 422, but a 422 on a shared link renders as a broken page,
 * whereas dropping a junk parameter renders as a working one.
 */
export function parseCatalogueQuery(params: RawSearchParams): CatalogueQuery {
  return {
    search: text(params.search),
    category: text(params.category),
    brand: list(params.brand),
    condition: list(params.condition).filter((value): value is Condition =>
      CONDITIONS.includes(value as Condition),
    ),
    min_ram: positiveInt(params.min_ram),
    min_storage: positiveInt(params.min_storage),
    min_price: positiveInt(params.min_price),
    max_price: positiveInt(params.max_price),
    sort: SORTS.includes(params.sort as never)
      ? (params.sort as CatalogueQuery["sort"])
      : undefined,
    page: positiveInt(params.page),
  };
}

/** Serialise back to a query string, for filter links and pagination. */
export function toQueryString(query: CatalogueQuery): string {
  const params = new URLSearchParams();

  if (query.search) params.set("search", query.search);
  if (query.category) params.set("category", query.category);
  if (query.sort) params.set("sort", query.sort);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  if (query.min_ram) params.set("min_ram", String(query.min_ram));
  if (query.min_storage) params.set("min_storage", String(query.min_storage));
  if (query.min_price) params.set("min_price", String(query.min_price));
  if (query.max_price) params.set("max_price", String(query.max_price));

  query.brand?.forEach((value) => params.append("brand", value));
  query.condition?.forEach((value) => params.append("condition", value));

  const qs = params.toString();

  return qs ? `?${qs}` : "";
}

/**
 * Toggle one value of a multi-select facet, and reset to page 1 — staying on
 * page 3 after narrowing the filters usually lands on an empty page.
 */
export function toggleFacet(
  query: CatalogueQuery,
  key: "brand" | "condition",
  value: string,
): CatalogueQuery {
  const current = (query[key] ?? []) as string[];
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];

  return {
    ...query,
    [key]: next.length ? next : undefined,
    page: undefined,
  };
}

/** How many facets are active — drives the "Clear all" affordance and its count. */
export function activeFilterCount(query: CatalogueQuery): number {
  return (
    (query.brand?.length ?? 0) +
    (query.condition?.length ?? 0) +
    (query.min_ram ? 1 : 0) +
    (query.min_storage ? 1 : 0) +
    (query.min_price || query.max_price ? 1 : 0)
  );
}

/* ------------------------------------------------------------------ parsing */

function text(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  const trimmed = first?.trim();

  return trimmed ? trimmed : undefined;
}

function list(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];

  return (Array.isArray(value) ? value : [value]).filter(Boolean);
}

function positiveInt(value: string | string[] | undefined): number | undefined {
  const first = Array.isArray(value) ? value[0] : value;

  if (first === undefined) return undefined;

  const parsed = Number.parseInt(first, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
