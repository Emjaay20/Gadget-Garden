import "server-only";

/**
 * Thin pass-through from the storefront's own route handlers to Laravel.
 *
 * The browser talks to `/api/*` on this origin and never to the Laravel host
 * directly. Three things fall out of that:
 *
 *   - the API's location stays server-side, out of the client bundle;
 *   - there is no cross-origin request from the browser, so no CORS preflight
 *     on the checkout path;
 *   - the same seam is where an auth cookie is attached in the backoffice.
 *
 * Error bodies are forwarded VERBATIM with their status. The API already speaks
 * the `{ message, errors }` shape the UI parses, and re-wrapping it here would
 * mean maintaining that contract twice.
 */
const API_URL = process.env.API_URL ?? "http://localhost:8000/api";

export async function proxyJson(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<Response> {
  let upstream: Response;

  try {
    upstream = await fetch(`${API_URL}${path}`, {
      method: init.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    // The API being unreachable is an outage, not a client mistake — 503 so
    // monitoring and the UI both read it correctly.
    return Response.json(
      { message: "We could not reach our systems. Please try again in a moment." },
      { status: 503 },
    );
  }

  const text = await upstream.text();

  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Forward a provider webhook without interpreting its body. Keeping the payload
 * and headers intact lets a payment provider authenticate at the Laravel edge
 * while the public app continues to expose only the storefront origin.
 */
export async function proxyWebhook(
  path: string,
  request: Request,
): Promise<Response> {
  let upstream: Response;

  try {
    upstream = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": request.headers.get("content-type") ?? "application/json",
        Accept: "application/json",
        ...(request.headers.get("authorization")
          ? { Authorization: request.headers.get("authorization")! }
          : {}),
      },
      body: await request.text(),
      cache: "no-store",
    });
  } catch {
    return Response.json(
      { message: "We could not reach our systems. Please try again in a moment." },
      { status: 503 },
    );
  }

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
