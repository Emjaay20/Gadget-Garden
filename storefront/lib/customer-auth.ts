"use client";

import type { Customer, Order, Wishlist } from "@/lib/types";

const TOKEN_KEY = "gg_customer_token";
const CUSTOMER_KEY = "gg_customer_data";

export function getCustomerToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setCustomerSession(token: string, customer: Customer): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
  window.dispatchEvent(new Event("gg-auth-changed"));
}

export function getCachedCustomer(): Customer | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(CUSTOMER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Customer;
  } catch {
    return null;
  }
}

export function clearCustomerSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(CUSTOMER_KEY);
  window.dispatchEvent(new Event("gg-auth-changed"));
}

export async function registerCustomer(payload: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<{ customer: Customer; token: string }> {
  const res = await fetch("/api/customer/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg =
      json.errors?.email?.[0] ||
      json.errors?.password?.[0] ||
      json.message ||
      "Registration failed.";
    throw new Error(errorMsg);
  }

  setCustomerSession(json.data.token, json.data.customer);
  return json.data;
}

export async function loginCustomer(payload: {
  email: string;
  password: string;
}): Promise<{ customer: Customer; token: string }> {
  const res = await fetch("/api/customer/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg =
      json.errors?.email?.[0] ||
      json.message ||
      "Invalid credentials.";
    throw new Error(errorMsg);
  }

  setCustomerSession(json.data.token, json.data.customer);
  return json.data;
}

export async function logoutCustomer(): Promise<void> {
  const token = getCustomerToken();
  if (token) {
    fetch("/api/customer/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  clearCustomerSession();
}

export async function fetchCustomerProfile(): Promise<{
  customer: Customer;
  orders_count: number;
  addresses: any[];
} | null> {
  const token = getCustomerToken();
  if (!token) return null;

  const res = await fetch("/api/customer/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearCustomerSession();
    }
    return null;
  }

  const json = await res.json();
  return json.data;
}

export async function fetchCustomerOrders(): Promise<Order[]> {
  const token = getCustomerToken();
  if (!token) return [];

  const res = await fetch("/api/customer/orders", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return [];

  const json = await res.json();
  return json.data ?? [];
}

export async function fetchCustomerOrder(reference: string): Promise<Order | null> {
  const token = getCustomerToken();
  if (!token) return null;

  const res = await fetch(`/api/customer/orders/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;

  const json = await res.json();
  return json.data ?? null;
}

async function wishlistRequest(path = "/api/customer/wishlist", init?: RequestInit): Promise<Response> {
  const token = getCustomerToken();
  if (!token) throw new Error("Sign in to use your wishlist.");
  return fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  });
}

export async function fetchWishlist(): Promise<Wishlist> {
  const response = await wishlistRequest();
  if (!response.ok) throw new Error("We could not load your wishlist.");
  return (await response.json()).data;
}

export async function saveWishlistItem(productId: string, productUnitId?: string): Promise<void> {
  const response = await wishlistRequest("/api/customer/wishlist/items", {
    method: "POST",
    body: JSON.stringify({ product_id: Number(productId), product_unit_id: productUnitId ? Number(productUnitId) : undefined }),
  });
  if (!response.ok) throw new Error("We could not save that item.");
}

export async function removeWishlistItem(itemId: string): Promise<void> {
  const response = await wishlistRequest(`/api/customer/wishlist/items/${encodeURIComponent(itemId)}`, { method: "DELETE" });
  if (!response.ok && response.status !== 204) throw new Error("We could not remove that item.");
}

export async function updateWishlist(input: Pick<Wishlist, "title" | "is_public" | "share_expires_at">): Promise<Wishlist> {
  const response = await wishlistRequest(undefined, { method: "PATCH", body: JSON.stringify(input) });
  if (!response.ok) throw new Error("We could not update your wishlist.");
  return (await response.json()).data;
}
