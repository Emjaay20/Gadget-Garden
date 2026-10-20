import "server-only";

import { getToken } from "@/lib/server/session";

/**
 * Authenticated server-side calls to Laravel.
 *
 * Every request attaches the bearer token from the httpOnly cookie. Nothing here
 * is reachable from the browser — `server-only` fails the build if a client
 * component imports it.
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

type Options = {
  method?: string;
  body?: unknown;
  /** Skip the auth header — only login does this. */
  anonymous?: boolean;
};

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(!isFormData && { "Content-Type": "application/json" }),
  };

  if (!options.anonymous) {
    const token = await getToken();

    if (!token) {
      // No cookie at all. Surfaced as 401 so callers treat it exactly like an
      // expired session rather than needing a separate "not logged in" path.
      throw new ApiError(401, "Unauthenticated.");
    }

    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: isFormData
        ? (options.body as FormData)
        : options.body === undefined
          ? undefined
          : JSON.stringify(options.body),
      cache: "no-store",
    });
  } catch (error) {
    /*
     | Only a genuine network failure is converted. Next throws through `fetch`
     | as control flow during prerendering, and swallowing that breaks the build
     | with a fabricated error against a healthy backend — see the storefront's
     | lib/api.ts, where exactly that cost a debugging cycle.
     */
    if (!(error instanceof TypeError)) throw error;

    throw new ApiError(503, "Could not reach the API. Is the backend running?");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload.message ?? `Request failed with ${response.status}.`,
      payload.errors ?? {},
    );
  }

  return payload as T;
}
