import "server-only";

import type {
  CatalogueFacets,
  CatalogueQuery,
  Category,
  DeliveryZone,
  Order,
  Paginated,
  Product,
  Wishlist,
} from "@/lib/types";

/**
 * Server-side reads against the Laravel API.
 *
 * `server-only` at the top is a build-time guard: importing this from a client
 * component fails the build rather than shipping the API base URL and these
 * request paths into the browser bundle. The storefront's data all flows through
 * Server Components, so nothing here should ever be reachable from the client.
 *
 * NOTE ON CACHING — Next 16 does NOT cache `fetch` by default, and an uncached
 * read that is not wrapped in `<Suspense>` (or marked `use cache`) is a build
 * error. These functions are deliberately uncached: `available_count` is the
 * difference between selling a laptop and selling one that is already gone.
 * Callers wrap them in Suspense and render a skeleton, which is also the better
 * experience.
 */

const API_URL = process.env.API_URL ?? "http://localhost:8000/api";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiEnvelope<T> = { data: T; meta?: unknown };

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiEnvelope<T>> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { Accept: "application/json", ...init?.headers },
      cache: "no-store",
    });
  } catch (error) {
    /*
     | ONLY a genuine network failure is converted.
     |
     | Next throws values through `fetch` as CONTROL FLOW — a prerender that
     | touches uncached data aborts by throwing, which is how the framework
     | decides a route must render dynamically. A blanket catch swallows that
     | signal and rethrows it as an ApiError, and the build then fails with a
     | fabricated "could not reach the API" against a backend that is up and
     | answering. That cost a real debugging cycle; do not widen this catch.
     |
     | A dead server surfaces as a TypeError. Everything else is rethrown
     | untouched so the framework still sees its own signal.
     */
    if (!(error instanceof TypeError)) {
      throw error;
    }

    throw new ApiError(
      503,
      `Could not reach the API at ${API_URL}${path}. Is the backend running?`,
    );
  }

  if (!response.ok) {
    // Error bodies follow the shapes in CLAUDE.md; fall back gracefully if the
    // API returned something else entirely (a proxy error page, say).
    const body = await response.json().catch(() => ({}));

    throw new ApiError(
      response.status,
      body.message ?? `Request failed with ${response.status}.`,
      body.errors ?? {},
    );
  }

  return response.json();
}

/* ------------------------------------------------------------------ shop */

/** Turns the filter state into the query string the API expects. */
function toSearchParams(query: CatalogueQuery): string {
  const params = new URLSearchParams();

  if (query.search) params.set("search", query.search);
  if (query.category) params.set("category", query.category);
  if (query.sort) params.set("sort", query.sort);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  if (query.per_page) params.set("per_page", String(query.per_page));

  if (query.min_ram) params.set("min_ram", String(query.min_ram));
  if (query.min_storage) params.set("min_storage", String(query.min_storage));
  if (query.min_price) params.set("min_price", String(query.min_price));
  if (query.max_price) params.set("max_price", String(query.max_price));

  // Laravel reads repeated `brand[]` keys as an array.
  query.brand?.forEach((b) => params.append("brand[]", b));
  query.condition?.forEach((c) => params.append("condition[]", c));

  const qs = params.toString();

  return qs ? `?${qs}` : "";
}

export async function getProducts(
  query: CatalogueQuery = {},
): Promise<Paginated<Product>> {
  const response = await request<Product[]>(
    `/shop/products${toSearchParams(query)}`,
  );

  return response as Paginated<Product>;
}

/** Null rather than throwing on 404, so a page can call `notFound()` itself. */
export async function getProduct(slug: string): Promise<Product | null> {
  try {
    const { data } = await request<Product>(
      `/shop/products/${encodeURIComponent(slug)}`,
    );

    return data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function getFacets(): Promise<CatalogueFacets> {
  const { data } = await request<CatalogueFacets>("/shop/products/filters");

  return data;
}

export async function getCategories(): Promise<Category[]> {
  const { data } = await request<Category[]>("/shop/categories");

  return data;
}

export async function getDeliveryZones(): Promise<DeliveryZone[]> {
  const { data } = await request<DeliveryZone[]>("/shop/delivery-zones");

  return data;
}

export async function getSharedWishlist(slug: string): Promise<Wishlist | null> {
  try {
    const { data } = await request<Wishlist>(`/shop/wishlists/${encodeURIComponent(slug)}`);
    return data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * An order by its reference. Null on 404 so the page can call `notFound()`.
 *
 * The reference is the only credential — there are no customer accounts — which
 * is why the API returns a deliberately narrow view.
 */
export async function getOrder(reference: string): Promise<Order | null> {
  try {
    const { data } = await request<Order>(
      `/shop/orders/${encodeURIComponent(reference)}`,
    );

    return data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}
