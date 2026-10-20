import "server-only";

import { cookies } from "next/headers";

/**
 * The staff session.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE SANCTUM TOKEN NEVER REACHES CLIENT JAVASCRIPT.
 *
 * This is the entire reason the backoffice is a Next app rather than a Vite SPA.
 * Laravel hands back a bearer token on login; that token is written here into an
 * httpOnly cookie, and every subsequent call is made SERVER-SIDE by a route
 * handler that reads the cookie back out. The browser holds a cookie it cannot
 * read and never sees the token itself, so an XSS bug in the dashboard cannot
 * exfiltrate a credential that grants full staff access.
 *
 * A Vite SPA would keep that token in localStorage, where any injected script
 * can read it.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const COOKIE = "gg_staff_session";

/** Eight hours — a shop shift, not a fortnight. */
const MAX_AGE_SECONDS = 60 * 60 * 8;

export async function getToken(): Promise<string | null> {
  // `cookies()` is async in Next 16 — synchronous access was removed.
  const jar = await cookies();

  const raw = jar.get(COOKIE)?.value ?? null;
  return raw ? decodeURIComponent(raw) : null;
}

export async function setToken(token: string): Promise<void> {
  const jar = await cookies();

  jar.set(COOKIE, token, {
    httpOnly: true,
    // Off in development so the dashboard works over plain http on localhost;
    // on everywhere else, where the cookie must never cross an insecure hop.
    secure: process.env.NODE_ENV === "production",
    // `lax` rather than `strict`: strict would drop the cookie when staff follow
    // a link into the dashboard from an email, logging them out for no reason.
    // The API is same-origin through our route handlers, so CSRF exposure here
    // is limited to top-level navigations, which are GETs.
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearToken(): Promise<void> {
  const jar = await cookies();

  jar.delete(COOKIE);
}
