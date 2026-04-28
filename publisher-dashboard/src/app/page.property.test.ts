import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: publisher-dashboard
 * Property tests for the Dashboard admin page.
 *
 * These tests verify the pure data-selection logic that determines
 * which recent articles are shown on the dashboard.
 */

// ── Replicated types from page.tsx ─────────────────────────────────────────

interface RecentArticle {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
}

// ── Replicated logic from page.tsx ─────────────────────────────────────────

/**
 * Selects the most recent articles for the dashboard display.
 * The dashboard shows at most 5 articles sorted by updatedAt descending.
 * This mirrors the backend query behavior: GET /articles?pageSize=5
 * which returns articles ordered by updatedAt DESC.
 */
function selectRecentArticles(articles: RecentArticle[], limit = 5): RecentArticle[] {
  return [...articles]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

// ── Arbitraries ────────────────────────────────────────────────────────────

const statusArb = fc.constantFrom('DRAFT', 'PUBLISHED', 'ARCHIVED');

const articleArb = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  status: statusArb,
  updatedAt: fc
    .integer({ min: 1577836800000, max: 1893456000000 })
    .map((ts) => new Date(ts).toISOString()),
});

const articlesArb = fc.array(articleArb, { minLength: 0, maxLength: 30 });

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Feature: publisher-dashboard, Property 18: Dashboard shows most recent articles', () => {
  /**
   * Property 18: Dashboard shows most recent articles
   * Validates: Requirements 10.2
   *
   * For any set of articles, the dashboard should display at most 5 articles
   * sorted by updatedAt descending.
   */

  it('should return at most 5 articles', () => {
    fc.assert(
      fc.property(articlesArb, (articles) => {
        const recent = selectRecentArticles(articles);
        expect(recent.length).toBeLessThanOrEqual(5);
      }),
      { numRuns: 100 },
    );
  });

  it('should return min(articles.length, 5) articles', () => {
    fc.assert(
      fc.property(articlesArb, (articles) => {
        const recent = selectRecentArticles(articles);
        expect(recent.length).toBe(Math.min(articles.length, 5));
      }),
      { numRuns: 100 },
    );
  });

  it('should return articles sorted by updatedAt descending', () => {
    fc.assert(
      fc.property(articlesArb, (articles) => {
        const recent = selectRecentArticles(articles);
        for (let i = 1; i < recent.length; i++) {
          const prev = new Date(recent[i - 1].updatedAt).getTime();
          const curr = new Date(recent[i].updatedAt).getTime();
          expect(prev).toBeGreaterThanOrEqual(curr);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('should only contain articles from the original set', () => {
    fc.assert(
      fc.property(articlesArb, (articles) => {
        const recent = selectRecentArticles(articles);
        const originalIds = new Set(articles.map((a) => a.id));
        for (const article of recent) {
          expect(originalIds.has(article.id)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('should not exclude any article more recent than a selected one', () => {
    fc.assert(
      fc.property(articlesArb, (articles) => {
        const recent = selectRecentArticles(articles);
        if (recent.length === 0) return;

        const oldestSelectedTime = new Date(recent[recent.length - 1].updatedAt).getTime();
        const selectedIds = new Set(recent.map((a) => a.id));

        for (const article of articles) {
          if (selectedIds.has(article.id)) continue;
          const articleTime = new Date(article.updatedAt).getTime();
          // Any excluded article must be older than or equal to the oldest selected
          expect(articleTime).toBeLessThanOrEqual(oldestSelectedTime);
        }
      }),
      { numRuns: 100 },
    );
  });
});
