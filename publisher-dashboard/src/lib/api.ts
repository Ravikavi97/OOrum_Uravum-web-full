/**
 * Shared admin fetch helper for authenticated API calls.
 *
 * Automatically refreshes the access token on 401 responses using the
 * stored refresh token, then retries the original request once.
 * 
 * Mutating requests (POST/PUT/DELETE) with JSON body are routed through
 * a Next.js API proxy to avoid Imunify360 WAF blocking HTML content
 * in cross-origin requests.
 */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// Proxy URL — routes through Next.js API to avoid browser Origin header
const PROXY_BASE = '/api/proxy';

// Methods that may contain HTML content and need proxying
const PROXY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Fields that contain HTML content and need base64 encoding to bypass WAF
const HTML_FIELDS = ['content', 'excerpt'];

/**
 * Encode HTML fields in the request body as base64 with 'b64:' prefix.
 * This bypasses Imunify360 WAF rules that block Tamil Unicode in HTML content.
 */
function encodeHtmlFields(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const obj = body as Record<string, unknown>;
  const result: Record<string, unknown> = { ...obj };
  for (const field of HTML_FIELDS) {
    if (typeof result[field] === 'string' && result[field]) {
      result[field] = 'b64:' + btoa(unescape(encodeURIComponent(result[field] as string)));
    }
  }
  return result;
}

// ─── Error class ─────────────────────────────────────────────────────────────

export class AdminApiError extends Error {
  public status: number;
  public code: string;
  public details?: Record<string, string[]>;

  constructor(status: number, code: string, message: string, details?: Record<string, string[]>) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// ─── Token refresh (singleton to deduplicate concurrent refreshes) ───────────

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = localStorage.getItem('admin_refresh_token');
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return null;

      const data = await res.json();
      localStorage.setItem('admin_token', data.accessToken);
      if (data.refreshToken) {
        localStorage.setItem('admin_refresh_token', data.refreshToken);
      }
      return data.accessToken as string;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ─── Fetch helper ────────────────────────────────────────────────────────────

export interface AdminFetchOptions extends RequestInit {
  token: string;
}

export async function adminFetch<T>(
  path: string,
  options: AdminFetchOptions,
): Promise<T> {
  const { token, headers, body, ...rest } = options;
  const method = (rest.method || 'GET').toUpperCase();

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  // Use proxy for mutating JSON requests to bypass Imunify360 WAF
  // (WAF blocks cross-origin requests with HTML/Unicode content)
  const useProxy = PROXY_METHODS.has(method) && !isFormData;
  const baseUrl = useProxy ? `${PROXY_BASE}` : API_URL;
  const fullPath = useProxy
    ? `${PROXY_BASE}${path}` // e.g. /api/proxy/articles
    : `${API_URL}${path}`;   // e.g. https://api.oorumuravum.com/api/articles

  // Encode HTML fields to bypass WAF for JSON requests
  let encodedBody = body;
  if (!isFormData && body && typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      const encoded = encodeHtmlFields(parsed);
      if (encoded !== parsed) {
        encodedBody = JSON.stringify(encoded);
      }
    } catch {
      // Not JSON, use as-is
    }
  }

  const buildHeaders = (t: string): Record<string, string> => ({
    Authorization: `Bearer ${t}`,
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(headers as Record<string, string>),
  });

  // Suppress unused variable warning
  void baseUrl;

  let res = await fetch(fullPath, {
    ...rest,
    headers: buildHeaders(token),
    body: encodedBody,
  });

  // On 401, try refreshing the token and retry once
  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      // Dispatch event so AuthContext can pick up the new token
      window.dispatchEvent(new CustomEvent('token-refreshed', { detail: newToken }));

      res = await fetch(fullPath, {
        ...rest,
        headers: buildHeaders(newToken),
        body: encodedBody,
      });
    } else {
      // Both tokens expired — force logout
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      localStorage.removeItem('admin_refresh_token');
      window.dispatchEvent(new CustomEvent('session-expired'));
      throw new AdminApiError(401, 'SESSION_EXPIRED', 'Session expired. Please login again.');
    }
  }

  if (!res.ok) {
    let errorBody: { error?: { code?: string; message?: string; details?: Record<string, string[]> } };
    try {
      errorBody = await res.json();
    } catch {
      errorBody = {};
    }

    throw new AdminApiError(
      res.status,
      errorBody.error?.code ?? 'UNKNOWN_ERROR',
      errorBody.error?.message ?? res.statusText,
      errorBody.error?.details,
    );
  }

  return res.json() as Promise<T>;
}

// ─── Query string builder ────────────────────────────────────────────────────

export function toQueryString(
  params: Record<string, unknown>,
): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (entries.length === 0) return '';
  const qs = entries
    .map(
      ([k, v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
    )
    .join('&');
  return `?${qs}`;
}
