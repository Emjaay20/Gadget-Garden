/**
 * The API contract, mirrored from the Laravel resources.
 *
 * Ids are STRINGS (Postgres bigints exceed JavaScript's safe integer range) and
 * money is an INTEGER OF WHOLE NAIRA — `620000` is ₦620,000.
 */

export type Permission =
  | "staff.manage"
  | "catalogue.manage"
  | "inventory.view"
  | "inventory.manage"
  | "orders.view"
  | "orders.manage"
  | "customers.view"
  | "customers.manage"
  | "reports.view"
  | "audit.view"
  | "offers.manage";

export type OfferStatus =
  | "pending"
  | "countered"
  | "accepted"
  | "declined"
  | "expired"
  | "converted";

export type OfferItem = {
  id: string;
  reference: string;
  status: OfferStatus;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  original_price: number;
  offered_price: number;
  counter_price: number | null;
  agreed_price: number | null;
  customer_note: string | null;
  staff_note: string | null;
  expires_at: string | null;
  is_expired: boolean;
  is_actionable: boolean;
  created_at: string;
  checkout_url: string | null;
  whatsapp_url: string | null;
  product?: {
    id: string;
    name: string;
    slug: string;
    brand: string;
    price: number;
  };
  unit?: {
    id: string;
    sku: string;
    condition: string;
    specs: UnitSpecs;
    price: number;
    status: string;
  } | null;
};

export type AuditLogItem = {
  id: number;
  user_id: number | null;
  action: string;
  auditable_type: string | null;
  auditable_id: number | null;
  description: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user?: {
    id: number;
    name: string;
    email: string;
  } | null;
};

export type StaffUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "owner" | "manager" | "sales" | null;
  permissions: Permission[];
  is_active: boolean;
  last_login_at: string | null;
};

export type Condition = "new" | "foreign_used" | "refurbished";

export type UnitSpecs = {
  cpu?: string | null;
  ram_gb?: number | null;
  storage_gb?: number | null;
  storage_type?: string | null;
  screen?: string | null;
  gpu?: string | null;
  battery_health?: number | null;
};

export type UnitStatus =
  | "available"
  | "reserved"
  | "sold"
  | "returned"
  | "faulty";

export type ProductUnit = {
  id: string;
  sku: string;
  condition: Condition;
  grade: "A" | "B" | "C" | null;
  specs: UnitSpecs;
  price: number;
  status: UnitStatus;
  is_available: boolean;
  /** Staff view only. */
  serial?: string | null;
  imei?: string | null;
  note?: string | null;
  reserved_until?: string | null;
  order_id?: string | null;
  /** Null unless the viewer holds `reports.view`. */
  cost?: number | null;
  created_at?: string;
  images?: ProductImage[];
};

export type ProductImage = {
  id: string;
  url: string;
  path?: string;
  alt: string | null;
  position: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  kind: "unit" | "stocked";
  category?: { id: string; slug: string; name: string };
  short_description: string | null;
  description?: string | null;
  highlights?: string[];
  summary_specs: UnitSpecs;
  warranty_months: number;
  from_price: number | null;
  compare_at_price: number | null;
  price_is_from: boolean;
  available_count: number;
  in_stock: boolean;
  is_low_stock: boolean;
  condition: Condition | null;
  is_featured: boolean;
  images?: ProductImage[];
};


export type StockMovement = {
  id: string;
  product: string | null;
  product_slug: string | null;
  delta: number;
  stock_before: number;
  stock_after: number;
  reason: "restock" | "sale" | "return" | "damage" | "correction";
  note: string | null;
  order_reference: string | null;
  /** Null means the shop did it — a paid order moving its own stock. */
  user: string | null;
  created_at: string;
};

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "failed"
  | "cancelled";

export type StaffOrder = {
  id: string;
  reference: string;
  status: OrderStatus;
  /** What the UI may offer — computed from the transition graph server-side. */
  next_statuses: OrderStatus[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  currency: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  placed_at: string | null;
  paid_at: string | null;
  reserved_until: string | null;
  staff_note: string | null;
  customer?: { id: string; name: string; email: string | null; phone: string | null };
  address?: {
    line1: string;
    city: string;
    state: string;
    landmark: string | null;
    note: string | null;
    zone: string | null;
  };
  items?: Array<{
    id: string;
    name: string;
    sku: string | null;
    condition: Condition | null;
    specs: UnitSpecs;
    unit_price: number;
    quantity: number;
    line_total: number;
    cost: number | null;
  }>;
  payments?: Array<{
    provider: string;
    status: string;
    amount: number;
    account_number: string | null;
    provider_transaction_id: string | null;
    paid_at: string | null;
  }>;
};

export type Paginated<T> = {
  data: T[];
  meta: {
    total: number;
    per_page?: number;
    current_page: number;
    last_page: number;
    counts?: Record<string, number>;
  };
};
