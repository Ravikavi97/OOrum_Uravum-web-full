import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: publisher-dashboard
 * Property tests for the Articles admin page.
 *
 * These tests replicate the exact data-transformation and logic functions
 * from articles/page.tsx to verify correctness properties without React rendering.
 */

// ── Replicated types from page.tsx ─────────────────────────────────────────

interface Author {
  id: string;
  name: string;
  slug: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Tag {
  id: string;
  name: string;
  slug: string;
}

type ArticleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  status: ArticleStatus;
  isBreaking: boolean;
  featuredImage: string | null;
  publishedAt: string | null;
  updatedAt: string;
  author: Author;
  category: Category;
  categoryId: string;
  tags: Tag[];
}

// ── Replicated logic from page.tsx ─────────────────────────────────────────

/**
 * Builds the API payload for creating/updating an article.
 * Mirrors the handleSubmit body construction in page.tsx.
 */
function buildArticlePayload(form: {
  title: string;
  content: string;
  excerpt: string;
  categoryId: string;
  tagIds: string[];
  featuredImage: string;
  isBreaking: boolean;
  status: ArticleStatus;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: form.title,
    content: form.content,
    categoryId: form.categoryId,
    status: form.status,
  };
  if (form.excerpt) body.excerpt = form.excerpt;
  if (form.tagIds.length > 0) body.tagIds = form.tagIds;
  if (form.featuredImage) body.featuredImage = form.featuredImage;
  body.isBreaking = form.isBreaking;
  return body;
}

/**
 * Populates form fields from an article entity.
 * Mirrors the openEditForm logic in page.tsx.
 */
function populateEditForm(article: Article) {
  return {
    editingId: article.id,
    title: article.title,
    content: article.content,
    excerpt: article.excerpt || '',
    categoryId: article.categoryId || article.category?.id || '',
    tagIds: article.tags?.map((t) => t.id) || [],
    featuredImage: article.featuredImage || '',
    isBreaking: article.isBreaking,
    status: article.status,
  };
}

/**
 * Determines if a user can edit an article.
 * Mirrors the canEditArticle logic in page.tsx.
 */
function canEditArticle(
  article: Article,
  userRole: string,
  userId: string,
): boolean {
  const isAuthor = userRole === 'AUTHOR';
  if (!isAuthor) return true; // ADMIN and EDITOR can edit any
  return article.author?.id === userId;
}

/**
 * Filters articles by status.
 * Mirrors the status filter behavior in page.tsx.
 */
function filterByStatus(articles: Article[], status: ArticleStatus | ''): Article[] {
  if (!status) return articles;
  return articles.filter((a) => a.status === status);
}

/**
 * Builds the inline status change request payload.
 * Mirrors the handleStatusChange logic in page.tsx.
 */
function buildStatusChangeRequest(articleId: string, newStatus: string) {
  return {
    url: `/articles/${articleId}`,
    method: 'PUT' as const,
    body: { status: newStatus },
  };
}

// ── Arbitraries ────────────────────────────────────────────────────────────

const statusArb = fc.constantFrom<ArticleStatus>('DRAFT', 'PUBLISHED', 'ARCHIVED');

const idArb = fc.uuid();

const slugArb = fc.stringMatching(/^[a-z0-9][a-z0-9\-]{0,30}[a-z0-9]$/).filter(s => s.length >= 2);

const authorArb = fc.record({
  id: idArb,
  name: fc.string({ minLength: 1, maxLength: 50 }),
  slug: slugArb,
});

const categoryArb = fc.record({
  id: idArb,
  name: fc.string({ minLength: 1, maxLength: 50 }),
  slug: slugArb,
});

const tagArb = fc.record({
  id: idArb,
  name: fc.string({ minLength: 1, maxLength: 30 }),
  slug: slugArb,
});

const articleArb = fc.record({
  id: idArb,
  title: fc.string({ minLength: 1, maxLength: 200 }),
  slug: slugArb,
  content: fc.string({ minLength: 1, maxLength: 500 }),
  excerpt: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
  status: statusArb,
  isBreaking: fc.boolean(),
  featuredImage: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
  publishedAt: fc.option(
    fc.integer({ min: 1577836800000, max: 1893456000000 }).map(ts => new Date(ts).toISOString()),
    { nil: null },
  ),
  updatedAt: fc.integer({ min: 1577836800000, max: 1893456000000 }).map(ts => new Date(ts).toISOString()),
  author: authorArb,
  category: categoryArb,
  categoryId: idArb,
  tags: fc.array(tagArb, { minLength: 0, maxLength: 5 }),
});

// Ensure categoryId matches category.id for consistency
const consistentArticleArb = articleArb.chain(article =>
  fc.constant({ ...article, categoryId: article.category.id }),
);

const formDataArb = fc.record({
  title: fc.string({ minLength: 1, maxLength: 200 }),
  content: fc.string({ minLength: 1, maxLength: 500 }),
  excerpt: fc.string({ minLength: 0, maxLength: 200 }),
  categoryId: idArb,
  tagIds: fc.array(idArb, { minLength: 0, maxLength: 5 }),
  featuredImage: fc.string({ minLength: 0, maxLength: 100 }),
  isBreaking: fc.boolean(),
  status: statusArb,
});

const roleArb = fc.constantFrom('ADMIN', 'EDITOR', 'AUTHOR');

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Feature: publisher-dashboard', () => {
  /**
   * Property 1: CRUD form submission produces correct API payload (article entity)
   * Validates: Requirements 1.3
   *
   * For any valid article form data, submitting the create form should produce
   * a POST request with correct payload shape.
   */
  describe('Property 1: CRUD form submission produces correct API payload', () => {
    it('should produce a payload with required fields and correct types', () => {
      fc.assert(
        fc.property(
          formDataArb,
          (form) => {
            const payload = buildArticlePayload(form);

            // Required fields are always present
            expect(payload.title).toBe(form.title);
            expect(payload.content).toBe(form.content);
            expect(payload.categoryId).toBe(form.categoryId);
            expect(payload.status).toBe(form.status);
            expect(typeof payload.isBreaking).toBe('boolean');
            expect(payload.isBreaking).toBe(form.isBreaking);

            // Optional fields: excerpt included only when non-empty
            if (form.excerpt) {
              expect(payload.excerpt).toBe(form.excerpt);
            } else {
              expect(payload).not.toHaveProperty('excerpt');
            }

            // Optional fields: tagIds included only when non-empty array
            if (form.tagIds.length > 0) {
              expect(payload.tagIds).toEqual(form.tagIds);
            } else {
              expect(payload).not.toHaveProperty('tagIds');
            }

            // Optional fields: featuredImage included only when non-empty
            if (form.featuredImage) {
              expect(payload.featuredImage).toBe(form.featuredImage);
            } else {
              expect(payload).not.toHaveProperty('featuredImage');
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should produce JSON-serializable payload', () => {
      fc.assert(
        fc.property(
          formDataArb,
          (form) => {
            const payload = buildArticlePayload(form);
            const serialized = JSON.stringify(payload);
            const deserialized = JSON.parse(serialized);
            expect(deserialized).toEqual(payload);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 2: Edit form population matches fetched entity data (article entity)
   * Validates: Requirements 1.4
   *
   * For any article fetched from API, populating the edit form and reading back
   * should match the original article's editable fields.
   */
  describe('Property 2: Edit form population matches fetched entity data', () => {
    it('should populate form fields matching the article data', () => {
      fc.assert(
        fc.property(
          consistentArticleArb,
          (article) => {
            const form = populateEditForm(article);

            expect(form.editingId).toBe(article.id);
            expect(form.title).toBe(article.title);
            expect(form.content).toBe(article.content);
            expect(form.excerpt).toBe(article.excerpt || '');
            expect(form.categoryId).toBe(article.categoryId || article.category?.id || '');
            expect(form.tagIds).toEqual(article.tags?.map(t => t.id) || []);
            expect(form.featuredImage).toBe(article.featuredImage || '');
            expect(form.isBreaking).toBe(article.isBreaking);
            expect(form.status).toBe(article.status);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should produce a round-trip: populate form then build payload preserves data', () => {
      fc.assert(
        fc.property(
          consistentArticleArb,
          (article) => {
            const form = populateEditForm(article);
            const payload = buildArticlePayload({
              title: form.title,
              content: form.content,
              excerpt: form.excerpt,
              categoryId: form.categoryId,
              tagIds: form.tagIds,
              featuredImage: form.featuredImage,
              isBreaking: form.isBreaking,
              status: form.status,
            });

            // Core fields always match
            expect(payload.title).toBe(article.title);
            expect(payload.content).toBe(article.content);
            expect(payload.categoryId).toBe(article.categoryId);
            expect(payload.status).toBe(article.status);
            expect(payload.isBreaking).toBe(article.isBreaking);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 4: AUTHOR role article editing restriction
   * Validates: Requirements 1.8
   *
   * For any user with AUTHOR role and any list of articles, edit action should
   * only be available on articles where authorId matches logged-in user.
   */
  describe('Property 4: AUTHOR role article editing restriction', () => {
    it('AUTHOR can only edit articles they authored', () => {
      fc.assert(
        fc.property(
          idArb,
          fc.array(consistentArticleArb, { minLength: 1, maxLength: 10 }),
          (userId, articles) => {
            for (const article of articles) {
              const canEdit = canEditArticle(article, 'AUTHOR', userId);
              if (article.author.id === userId) {
                expect(canEdit).toBe(true);
              } else {
                expect(canEdit).toBe(false);
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('ADMIN and EDITOR can always edit any article', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('ADMIN', 'EDITOR'),
          idArb,
          fc.array(consistentArticleArb, { minLength: 1, maxLength: 10 }),
          (role, userId, articles) => {
            for (const article of articles) {
              expect(canEditArticle(article, role, userId)).toBe(true);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('AUTHOR can always edit their own articles', () => {
      fc.assert(
        fc.property(
          consistentArticleArb,
          (article) => {
            // Use the article's own author ID as the logged-in user
            const canEdit = canEditArticle(article, 'AUTHOR', article.author.id);
            expect(canEdit).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 6: Status filtering returns only matching items (article status)
   * Validates: Requirements 1.6
   *
   * For any status filter and set of articles, applying filter returns only
   * matching items.
   */
  describe('Property 6: Status filtering returns only matching items', () => {
    it('filtered articles all have the selected status', () => {
      fc.assert(
        fc.property(
          statusArb,
          fc.array(consistentArticleArb, { minLength: 0, maxLength: 20 }),
          (status, articles) => {
            const filtered = filterByStatus(articles, status);
            for (const article of filtered) {
              expect(article.status).toBe(status);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('no matching articles are excluded by the filter', () => {
      fc.assert(
        fc.property(
          statusArb,
          fc.array(consistentArticleArb, { minLength: 0, maxLength: 20 }),
          (status, articles) => {
            const filtered = filterByStatus(articles, status);
            const expectedCount = articles.filter(a => a.status === status).length;
            expect(filtered.length).toBe(expectedCount);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('empty filter returns all articles', () => {
      fc.assert(
        fc.property(
          fc.array(consistentArticleArb, { minLength: 0, maxLength: 20 }),
          (articles) => {
            const filtered = filterByStatus(articles, '');
            expect(filtered.length).toBe(articles.length);
            expect(filtered).toEqual(articles);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 7: Inline status change produces correct PUT request
   * Validates: Requirements 1.5
   *
   * For any article and valid status, changing status produces correct PUT request.
   */
  describe('Property 7: Inline status change produces correct PUT request', () => {
    it('should produce PUT to /articles/:id with { status } body', () => {
      fc.assert(
        fc.property(
          idArb,
          statusArb,
          (articleId, newStatus) => {
            const request = buildStatusChangeRequest(articleId, newStatus);

            expect(request.url).toBe(`/articles/${articleId}`);
            expect(request.method).toBe('PUT');
            expect(request.body).toEqual({ status: newStatus });
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should produce a JSON-serializable body', () => {
      fc.assert(
        fc.property(
          idArb,
          statusArb,
          (articleId, newStatus) => {
            const request = buildStatusChangeRequest(articleId, newStatus);
            const serialized = JSON.stringify(request.body);
            const deserialized = JSON.parse(serialized);
            expect(deserialized).toEqual({ status: newStatus });
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
