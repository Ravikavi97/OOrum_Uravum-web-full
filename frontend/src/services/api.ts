/**
 * API client for communicating with the Express backend.
 *
 * Uses Next.js `fetch` with cache/revalidate options for SSR/ISR support.
 * Base URL is configured via NEXT_PUBLIC_API_URL environment variable.
 */

// Server-side (SSR) uses Docker internal network; client-side uses localhost
const BASE_URL =
  typeof window === 'undefined'
    ? (process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api')
    : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api');

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Author {
  id: string;
  name: string;
  slug: string;
  profileImage?: string | null;
  bio?: string | null;
  socialLinks?: Record<string, string> | null;
  role?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  path?: string | null;
  description?: string | null;
  iconUrl?: string | null;
  iconKey?: string | null;
  parentId?: string | null;
  parent?: Pick<Category, 'id' | 'name' | 'slug'> | null;
  children?: Category[];
  _count?: {
    articles?: number;
  };
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt: string | null;
  isBreaking: boolean;
  featuredImage: string | null;
  author: Pick<Author, 'id' | 'name' | 'slug' | 'profileImage'>;
  category: Pick<Category, 'id' | 'name' | 'slug'>;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

// ─── Fetch helper ────────────────────────────────────────────────────────────

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public body: ApiError,
  ) {
    super(body.error.message);
    this.name = 'ApiRequestError';
  }
}

async function fetchApi<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let body: ApiError;
    try {
      body = await res.json();
    } catch {
      body = {
        error: { code: 'UNKNOWN_ERROR', message: res.statusText },
      };
    }
    throw new ApiRequestError(res.status, body);
  }

  return res.json() as Promise<T>;
}

// ─── Query param builder ─────────────────────────────────────────────────────

function toQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (entries.length === 0) return '';
  const qs = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `?${qs}`;
}

// ─── Article endpoints ───────────────────────────────────────────────────────

export interface GetArticlesParams {
  page?: number;
  pageSize?: number;
  category?: string;
  tag?: string;
  author?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  isBreaking?: boolean;
}

export async function getArticles(
  params?: GetArticlesParams,
): Promise<PaginatedResponse<Article>> {
  const qs = params ? toQueryString(params as Record<string, unknown>) : '';
  return fetchApi<PaginatedResponse<Article>>(`/articles${qs}`, {
    next: { revalidate: 10, tags: ['articles'] },
  });
}

export async function getArticleBySlug(slug: string): Promise<Article> {
  return fetchApi<Article>(`/articles/${encodeURIComponent(slug)}`, {
    next: { revalidate: 10, tags: ['articles', `article-${slug}`] },
  });
}

export async function getBreakingArticles(): Promise<PaginatedResponse<Article>> {
  return getArticles({ isBreaking: true, status: 'PUBLISHED' });
}

// ─── Category endpoints ──────────────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
  return fetchApi<Category[]>('/categories', {
    next: { revalidate: 600, tags: ['categories'] },
  });
}

export interface CategoryLatestArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImage: string | null;
  publishedAt: string;
}

export interface CategoryWithLatest {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl?: string | null;
  iconKey?: string | null;
  article: CategoryLatestArticle | null;
}

/**
 * Resolve the URL path for a category.
 * If the category has a custom path, use it; otherwise default to /category/{slug}
 */
export function resolveCategoryPath(category: Category): string {
  if (category.path && category.path.trim().length > 0) {
    // Ensure path starts with /
    const path = category.path.trim();
    return path.startsWith('/') ? path : `/${path}`;
  }
  return `/category/${category.slug}`;
}

/** Categories paired with their latest published article — powers the category card row. */
export async function getCategoriesWithLatest(rootOnly = true): Promise<CategoryWithLatest[]> {
  const qs = toQueryString({ rootOnly: rootOnly ? undefined : 'false' });
  return fetchApi<CategoryWithLatest[]>(`/categories/with-latest${qs}`, {
    next: { revalidate: 600, tags: ['categories', 'articles'] },
  });
}

// ─── Tag endpoints ───────────────────────────────────────────────────────────

export async function getTags(): Promise<Tag[]> {
  return fetchApi<Tag[]>('/tags', {
    next: { revalidate: 30, tags: ['tags'] },
  });
}

// ─── Author endpoints ────────────────────────────────────────────────────────

export async function getAuthors(): Promise<Author[]> {
  return fetchApi<Author[]>('/authors', {
    next: { revalidate: 30, tags: ['authors'] },
  });
}

export async function getAuthorBySlug(slug: string): Promise<Author> {
  return fetchApi<Author>(`/authors/${encodeURIComponent(slug)}`, {
    next: { revalidate: 30, tags: ['authors'] },
  });
}

// ─── Search endpoint ─────────────────────────────────────────────────────────

export async function searchArticles(
  query: string,
  page?: number,
): Promise<PaginatedResponse<Article>> {
  const qs = toQueryString({ q: query, page });
  return fetchApi<PaginatedResponse<Article>>(`/search${qs}`, {
    next: { revalidate: 0 },
  });
}

// ─── Site settings endpoint ──────────────────────────────────────────────────

export interface Obituary {
  id: string;
  name: string;
  slug: string;
  content: string;
  sourceUrl: string | null;
  publishedAt: string;
  createdAt: string;
}

export async function getObituaries(
  params?: { page?: number; pageSize?: number },
): Promise<PaginatedResponse<Obituary>> {
  const qs = params ? toQueryString(params as Record<string, unknown>) : '';
  return fetchApi<PaginatedResponse<Obituary>>(`/obituaries${qs}`, {
    next: { revalidate: 10, tags: ['obituaries'] },
  });
}

export interface SiteSettings {
  siteTitle?: string;
  siteDescription?: string;
  siteTagline?: string;
  socialLinks?: string;
  homeLayout?: string;
  heroConfig?: string;
  headerLogo?: string;
  footerLogo?: string;
  themeColors?: string;
  videoHeroConfig?: string;
  [key: string]: string | undefined;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  return fetchApi<SiteSettings>('/settings/public', {
    next: { revalidate: 30, tags: ['settings'] },
  });
}

/**
 * Public origin of the backend, used to build `<img src>` values.
 *
 * Only `NEXT_PUBLIC_API_URL` is considered, never `INTERNAL_API_URL`: an
 * `<img src>` is emitted into SSR HTML and shipped to the browser, so a Docker
 * internal hostname such as `http://backend:4000` would be embedded verbatim and
 * the browser could not resolve it.
 */
const PUBLIC_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api')
  .replace(/\/api\/?$/, '');

/**
 * Turns a stored logo path into a URL the browser can actually load.
 *
 * The publisher dashboard writes an absolute URL, but a row that was seeded or
 * edited by hand holds the backend's own relative form (`/uploads/original/…`).
 * The backend serves `/uploads` from its root, outside the `/api` prefix every
 * API URL carries, so a relative value must be resolved against the backend
 * origin — otherwise the browser requests it from this app's origin, gets a 404,
 * and the header/footer shows a broken image with no recovery.
 *
 * Returns `null` for anything unrenderable so callers fall back to the bundled
 * wordmark instead of emitting an `<img>` with a broken `src`.
 */
export function resolveAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const value = path.trim();
  if (!value) return null;
  // Absolute URLs were validated by the API; pass them through as-is.
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/uploads/')) return `${PUBLIC_ORIGIN}${value}`;
  // Same-origin static asset (for example the bundled `/logo.png`).
  // `//host/...` is rejected: it is protocol-relative, so it would silently
  // resolve to a third-party origin rather than this app.
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  return null;
}

/** Bundled wordmark, used whenever the site has no usable logo configured. */
export const DEFAULT_LOGO_SRC = '/logo.png';

export interface HomeLayoutSection {
  id: string;
  label: string;
  visible: boolean;
  order: number;
}

export async function getHomeLayout(): Promise<HomeLayoutSection[]> {
  const settings = await getSiteSettings();
  if (!settings.homeLayout) return [];
  try {
    const config = JSON.parse(settings.homeLayout);
    return (config.sections || []).sort((a: HomeLayoutSection, b: HomeLayoutSection) => a.order - b.order);
  } catch {
    return [];
  }
}

export interface HeroConfig {
  categorySlugs: string[];
  infoRowTitle: string;
}

export async function getHeroConfig(): Promise<HeroConfig> {
  const settings = await getSiteSettings();
  const defaults: HeroConfig = { categorySlugs: [], infoRowTitle: 'தகவல் கண்ணோட்டம்' };
  if (!settings.heroConfig) return defaults;
  try {
    return { ...defaults, ...JSON.parse(settings.heroConfig) };
  } catch {
    return defaults;
  }
}

export interface ThemeColors {
  primaryDark: string;
  accentRed: string;
  background: string;
  foreground: string;
  cardBg: string;
}

export async function getThemeColors(): Promise<ThemeColors | null> {
  const settings = await getSiteSettings();
  if (!settings.themeColors) return null;
  try { return JSON.parse(settings.themeColors); } catch { return null; }
}

/**
 * Resolved logo URL for the header or footer, falling back to the bundled
 * wordmark when the setting is empty, unreachable or not a renderable URL.
 */
export async function getLogo(kind: 'header' | 'footer'): Promise<string> {
  try {
    const settings = await getSiteSettings();
    const stored = kind === 'header' ? settings.headerLogo : settings.footerLogo;
    return resolveAssetUrl(stored) ?? DEFAULT_LOGO_SRC;
  } catch {
    return DEFAULT_LOGO_SRC;
  }
}

// ─── Video endpoints ─────────────────────────────────────────────────────────

export interface VideoPost {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  platform: string;
  active: boolean;
  order: number;
  categoryId: string | null;
  category: { id: string; name: string; slug: string } | null;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

export async function getVideoPosts(): Promise<VideoPost[]> {
  return fetchApi<VideoPost[]>('/videos', {
    next: { revalidate: 10, tags: ['videos'] },
  });
}

export async function getVideoBySlug(slug: string): Promise<VideoPost> {
  return fetchApi<VideoPost>(`/videos/${encodeURIComponent(slug)}`, {
    next: { revalidate: 10, tags: ['videos', `video-${slug}`] },
  });
}

export async function getObituaryBySlug(slug: string): Promise<Obituary> {
  return fetchApi<Obituary>(`/obituaries/slug/${encodeURIComponent(slug)}`, {
    next: { revalidate: 10, tags: ['obituaries', `obituary-${slug}`] },
  });
}

// ─── Advertisement endpoints ─────────────────────────────────────────────────

export interface Advertisement {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  position: string;
  cropPosition: string | null;
  active: boolean;
  order: number;
  variant: string;
  badge: string | null;
  metaText: string | null;
  icon: string | null;
  linkLabel: string | null;
}

export async function getAdvertisements(
  position?: 'sidebar' | 'banner' | 'header',
): Promise<Advertisement[]> {
  const qs = position ? toQueryString({ position }) : '';
  return fetchApi<Advertisement[]>(`/ads${qs}`, {
    next: { revalidate: 60, tags: ['ads'] },
  });
}

export interface VideoCat {
  id: string;
  name: string;
  slug: string;
}

export async function getVideoCategories(): Promise<VideoCat[]> {
  return fetchApi<VideoCat[]>('/videos/categories', {
    next: { revalidate: 30, tags: ['videos'] },
  });
}

export interface VideoHeroConfig {
  categorySlugs: string[];
  infoRowTitle: string;
}

export async function getVideoHeroConfig(): Promise<VideoHeroConfig> {
  const settings = await getSiteSettings();
  const defaults: VideoHeroConfig = { categorySlugs: [], infoRowTitle: 'அனைத்து வீடியோக்கள்' };
  if (!settings.videoHeroConfig) return defaults;
  try {
    return { ...defaults, ...JSON.parse(settings.videoHeroConfig) };
  } catch {
    return defaults;
  }
}
