// In-memory cache — no Redis dependency needed.
// Same API as the previous Redis-based implementation.

// TTL constants (in seconds)
export const ARTICLE_TTL = 300;
export const CATEGORY_TTL = 600;
export const TAG_TTL = 600;
export const BREAKING_TTL = 60;
export const AUTHOR_TTL = 600;
export const SEARCH_TTL = 120;
export const SETTINGS_TTL = 3600;

// ─── Internal store ──────────────────────────────────────────────────────────

interface CacheEntry {
  value: string;
  expiresAt: number; // Date.now() + ttl*1000
}

const store = new Map<string, CacheEntry>();
const tagSets = new Map<string, Set<string>>(); // tag → set of cache keys

function isExpired(entry: CacheEntry): boolean {
  return Date.now() > entry.expiresAt;
}

// Lazy cleanup: evict expired entries periodically
let cleanupTimer: ReturnType<typeof setInterval> | null = null;
function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    for (const [key, entry] of store) {
      if (isExpired(entry)) store.delete(key);
    }
  }, 60_000); // every 60s
  if (cleanupTimer.unref) cleanupTimer.unref(); // don't keep process alive
}

// ─── Public API (same signatures as before) ──────────────────────────────────

export async function getCached<T>(key: string): Promise<T | null> {
  const entry = store.get(key);
  if (!entry) return null;
  if (isExpired(entry)) {
    store.delete(key);
    return null;
  }
  return JSON.parse(entry.value) as T;
}

export async function setCached<T>(
  key: string,
  value: T,
  ttl: number = ARTICLE_TTL,
): Promise<void> {
  ensureCleanup();
  store.set(key, {
    value: JSON.stringify(value),
    expiresAt: Date.now() + ttl * 1000,
  });
}

export async function addTagsToKey(key: string, tags: string[]): Promise<void> {
  for (const tag of tags) {
    let set = tagSets.get(tag);
    if (!set) {
      set = new Set();
      tagSets.set(tag, set);
    }
    set.add(key);
  }
}

export async function invalidateByPattern(pattern: string): Promise<void> {
  // Convert glob pattern to regex (simple: * → .*)
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  for (const key of store.keys()) {
    if (regex.test(key)) store.delete(key);
  }
}

export async function invalidateByTags(tags: string[]): Promise<void> {
  for (const tag of tags) {
    const keys = tagSets.get(tag);
    if (keys) {
      for (const key of keys) store.delete(key);
      tagSets.delete(tag);
    }
  }
}

export function getClient(): null {
  return null;
}

export async function disconnectCache(): Promise<void> {
  store.clear();
  tagSets.clear();
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
