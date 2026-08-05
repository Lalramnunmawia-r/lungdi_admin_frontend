// Thin fetch wrapper for the admin API (lungdi_backend's /admin/* routes).
//
// Token storage is deliberately split: the ACCESS token lives only in module
// state (never touches disk), the REFRESH token lives in localStorage. This
// mirrors the trade-off documented in the backend plan — Bearer headers are
// never sent ambiently by the browser, which is what makes CORS +
// Authorization safe without CSRF tokens, but it also means XSS in this panel
// is a full session takeover regardless of where either token lives. Keeping
// the access token out of localStorage at least keeps it out of anything that
// dumps storage (devtools screenshots, browser sync, extensions), even though
// it's still reachable to injected JS at runtime — there is no storage
// location fetch() can use that fixes that; only a strict CSP does.
const REFRESH_TOKEN_KEY = "lungdi_admin_refresh_token";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setStoredRefreshToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
  else window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/** Called once from AuthProvider — invoked when a request can't be recovered by refreshing. */
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return false;

  // Concurrent 401s (a page firing several queries at once) must share ONE
  // refresh call, not each fire their own — a second refresh call while the
  // first is in flight is wasted at best; racing writes to accessToken at
  // worst.
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const data = (await res.json()) as { accessToken: string };
        setAccessToken(data.accessToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Query params — undefined values are dropped, everything else stringified. An array becomes a repeated key (?status=a&status=b), matching the backend's array-query DTOs. */
  query?: Record<string, string | number | boolean | string[] | undefined>;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(`${API_BASE}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, item);
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
  isRetry = false,
): Promise<T> {
  const res = await fetch(buildUrl(path, options.query), {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && !isRetry) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, options, true);
    onUnauthorized?.();
    // Falls through to the normal error path below so the caller's own
    // catch/error-boundary still sees a rejected promise, not a silent hang.
  }

  if (!res.ok) {
    let body: unknown = null;
    let message = res.statusText;
    try {
      body = await res.json();
      if (body && typeof body === "object" && "message" in body) {
        const m = (body as { message: unknown }).message;
        message = Array.isArray(m) ? m.join(", ") : String(m);
      }
    } catch {
      // Non-JSON error body (a proxy 502, etc.) — keep statusText.
    }
    throw new ApiError(res.status, message, body);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions["query"]) =>
    request<T>(path, { method: "GET", query }),
  post: <T>(path: string, body?: unknown, query?: RequestOptions["query"]) =>
    request<T>(path, { method: "POST", body, query }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "DELETE", body }),
};
