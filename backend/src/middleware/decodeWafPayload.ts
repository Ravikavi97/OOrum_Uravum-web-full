/**
 * The publisher dashboard base64-encodes HTML-bearing fields as `b64:<base64>`
 * before sending them, because Imunify360 blocks cross-origin JSON requests that
 * contain Tamil Unicode inside HTML.
 *
 * The backend is the counterpart that must undo that wrapping: it decodes the
 * fields on the way in so HTML is stored (and later published) as real markup.
 * Without this the raw `b64:...` string is persisted verbatim and the site renders
 * an unreadable base64 run instead of the article.
 */

const B64_PREFIX = 'b64:';

/** Field names the dashboard encodes. Mirrors HTML_FIELDS in the dashboard client. */
export const WAF_ENCODED_FIELDS = ['content', 'excerpt'] as const;

/** Write methods only — decoding a read request makes no sense. */
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH']);

/**
 * Decodes one `b64:`-prefixed string. Returns the input untouched when it is not
 * wrapped, and falls back to the original value if the payload is not valid
 * base64/UTF-8 — a corrupt field must never silently become `undefined`.
 */
export function decodeWafValue(value: string): string {
  if (!value.startsWith(B64_PREFIX)) return value;
  const payload = value.slice(B64_PREFIX.length);
  try {
    const decoded = Buffer.from(payload, 'base64');
    // Buffer.from silently drops invalid base64, so confirm the round trip.
    if (decoded.length === 0 || decoded.toString('base64').replace(/=+$/, '') !== payload.replace(/=+$/, '')) {
      return value;
    }
    return decoded.toString('utf8');
  } catch {
    return value;
  }
}

function walk(node: unknown, depth: number): void {
  if (depth > 6 || node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, depth + 1);
    return;
  }
  const record = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'string' && (WAF_ENCODED_FIELDS as readonly string[]).includes(key)) {
      record[key] = decodeWafValue(value);
    } else {
      walk(value, depth + 1);
    }
  }
}

/**
 * Express middleware that unwraps dashboard-encoded fields in place. Must be
 * mounted *after* `express.json()` so `req.body` is populated.
 */
export function decodeWafPayload(req: unknown, _res: unknown, next: () => void): void {
  const request = req as { method?: string; body?: unknown };
  if (request.method && WRITE_METHODS.has(request.method.toUpperCase())) {
    walk(request.body, 0);
  }
  next();
}
