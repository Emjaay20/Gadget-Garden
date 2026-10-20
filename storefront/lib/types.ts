/**
 * The API contract, mirrored from the Laravel resources.
 *
 * Every `id` is a STRING. Postgres bigints exceed what JavaScript holds safely
 * in a Number, so they cross the wire as strings — see UserResource in the
 * backend for the reasoning. Never coerce them back to numbers.
 *
 * Every money value is an INTEGER OF WHOLE NAIRA. `620000` is ₦620,000.
 */

export type Condition = "new" | "foreign_used" | "refurbished";

export type ProductKind = "unit" | "stocked";

export type UnitSpecs = {
  cpu?: string | null;
  ram_gb?: number | null;
  storage_gb?: number | null;
  storage_type?: string | null;
  screen?: string | null;
  gpu?: string | null;
  battery_health?: number | null;
};

export type ProductImage = {
  id: string;
  url: string;
  alt: string | null;
  position: number;
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  product_count?: number;
};

/** One physical machine, as the storefront sees it. Never carries cost or serial. */
export type ProductUnit = {
  id: string;
  sku: string;
  condition: Condition;
  grade: "A" | "B" | "C" | null;
  specs: UnitSpecs;
  price: number;
  status: string;
  is_available: boolean;
  images?: ProductImage[];
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  kind: ProductKind;
  category?: Category;

  short_description: string | null;
  description?: string | null;
  youtube_url?: string | null;
  properties?: string[];
  highlights: string[];
  base_specs: UnitSpecs;
  /** Specs of the machine whose price is being shown — what the card prints. */
  summary_specs: UnitSpecs;
  warranty_months: number;

  /** What to show. Null when nothing is available. */
  from_price: number | null;
  compare_at_price: number | null;
  currency: string;

  /** Whether to prefix the price with "from" — true only when there is a real range. */
  price_is_from: boolean;

  available_count: number;
  in_stock: boolean;
  is_low_stock: boolean;

  /** Null when the available machines genuinely differ and no one badge is honest. */
  condition: Condition | null;

  is_featured: boolean;
  images: ProductImage[];

  /** Only present on the detail endpoint — the unit picker. */
  units?: ProductUnit[];
};

export type DeliveryZone = {
  id: string;
  slug: string;
  name: string;
  fee: number;
  free_above: number | null;
};

export type CatalogueFacets = {
  brands: string[];
  conditions: Condition[];
  ram_options: number[];
  storage_options: number[];
  price_range: { min: number; max: number };
};

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "failed"
  | "cancelled";

export type OrderItem = {
  name: string;
  sku: string | null;
  condition: Condition | null;
  specs: UnitSpecs;
  unit_price: number;
  quantity: number;
  line_total: number;
};

/**
 * An order as the customer sees it. Deliberately narrow: this endpoint is
 * reachable by anyone holding the reference, so it carries only what the buyer
 * already knows — no cost, no staff notes, no customer id.
 */
export type Order = {
  reference: string;
  status: OrderStatus;
  status_label: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  currency: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  placed_at: string | null;
  paid_at: string | null;
  /** When the hold on any serialized machines runs out. */
  reserved_until: string | null;
  address?: {
    line1: string;
    city: string;
    state: string;
    landmark: string | null;
    zone: string | null;
  };
  items?: OrderItem[];
};

export type Paginated<T> = {
  data: T[];
  meta: {
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
  };
};

/** The filter state the catalogue page reads from the URL. */
export type CatalogueQuery = {
  search?: string;
  category?: string;
  brand?: string[];
  condition?: Condition[];
  min_ram?: number;
  min_storage?: number;
  min_price?: number;
  max_price?: number;
  sort?: "featured" | "price_asc" | "price_desc" | "newest";
  page?: number;
  /** The API caps this at 48. */
  per_page?: number;
};
