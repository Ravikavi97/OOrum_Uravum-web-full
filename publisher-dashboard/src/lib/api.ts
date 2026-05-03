/**
 * Shared admin fetch helper for authenticated API calls.
 *
 * Automatically refreshes the access token on 401 responses using the
 * stored refresh token, then retries the original request once.
 */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

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

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const buildHeaders = (t: string): Record<string, string> => ({
    Authorization: `Bearer ${t}`,
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(headers as Record<string, string>),
  });

  let res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: buildHeaders(token),
    body,
  });

  // On 401, try refreshing the token and retry once
  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      // Dispatch event so AuthContext can pick up the new token
      window.dispatchEvent(new CustomEvent('token-refreshed', { detail: newToken }));

      res = await fetch(`${API_URL}${path}`, {
        ...rest,
        headers: buildHeaders(newToken),
        body,
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
