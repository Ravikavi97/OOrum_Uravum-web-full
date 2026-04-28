import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  serializeArticle,
  deserializeArticle,
  ArticleWithRelations,
} from './serializer';

/**
 * Property-based tests for Article serialization round-trip.
 *
 * **Validates: Requirements 8.7, 1.7**
 *
 * Property 2: Article serialization round-trip — For all valid Article objects,
 * serializing to JSON then deserializing produces an equivalent Article object.
 */

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const statusArb = fc.constantFrom('DRAFT' as const, 'PUBLISHED' as const, 'ARCHIVED' as const);

const entityRefArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
  slug: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
});

const tagArb = entityRefArb.map((ref) => ({ tag: ref }));

const dateArb = fc.date({
  min: new Date('2000-01-01T00:00:00.000Z'),
  max: new Date('2099-12-31T23:59:59.999Z'),
}).filter((d) => !isNaN(d.getTime()));

const articleArb: fc.Arbitrary<ArticleWithRelations> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
  title: fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
  slug: fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
  content: fc.string({ minLength: 1, maxLength: 500 }),
  excerpt: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
  status: statusArb,
  publishedAt: fc.option(dateArb, { nil: null }),
  isBreaking: fc.boolean(),
  featuredImage: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
  createdAt: dateArb,
  updatedAt: dateArb,
  author: entityRefArb,
  category: entityRefArb,
  tags: fc.array(tagArb, { minLength: 0, maxLength: 5 }),
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Article Serializer — Property Tests', () => {
  /**
   * **Property 2: Article serialization round-trip**
   * **Validates: Requirements 8.7, 1.7**
   */
  describe('Property 2: Article serialization round-trip', () => {
    it('serialize then deserialize preserves all scalar fields', () => {
      fc.assert(
        fc.property(articleArb, (article) => {
          const serialized = serializeArticle(article);
          const deserialized = deserializeArticle(serialized);

          expect(deserialized.id).toBe(article.id);
          expect(deserialized.title).toBe(article.title);
          expect(deserialized.slug).toBe(article.slug);
          expect(deserialized.content).toBe(article.content);
          expect(deserialized.excerpt).toBe(article.excerpt);
          expect(deserialized.status).toBe(article.status);
          expect(deserialized.isBreaking).toBe(article.isBreaking);
          expect(deserialized.featuredImage).toBe(article.featuredImage);
        }),
        { numRuns: 200 },
      );
    });

    it('serialize then deserialize preserves date fields', () => {
      fc.assert(
        fc.property(articleArb, (article) => {
          const serialized = serializeArticle(article);
          const deserialized = deserializeArticle(serialized);

          expect(deserialized.createdAt.getTime()).toBe(article.createdAt.getTime());
          expect(deserialized.updatedAt.getTime()).toBe(article.updatedAt.getTime());

          if (article.publishedAt) {
            expect(deserialized.publishedAt).not.toBeNull();
            expect(deserialized.publishedAt!.getTime()).toBe(article.publishedAt.getTime());
          } else {
            expect(deserialized.publishedAt).toBeNull();
          }
        }),
        { numRuns: 200 },
      );
    });

    it('serialize then deserialize preserves author relation', () => {
      fc.assert(
        fc.property(articleArb, (article) => {
          const serialized = serializeArticle(article);
          const deserialized = deserializeArticle(serialized);

          expect(deserialized.author).toEqual(article.author);
        }),
        { numRuns: 200 },
      );
    });

    it('serialize then deserialize preserves category relation', () => {
      fc.assert(
        fc.property(articleArb, (article) => {
          const serialized = serializeArticle(article);
          const deserialized = deserializeArticle(serialized);

          expect(deserialized.category).toEqual(article.category);
        }),
        { numRuns: 200 },
      );
    });

    it('serialize then deserialize preserves tags relation', () => {
      fc.assert(
        fc.property(articleArb, (article) => {
          const serialized = serializeArticle(article);
          const deserialized = deserializeArticle(serialized);

          const originalTags = article.tags.map((at) => at.tag);
          expect(deserialized.tags).toEqual(originalTags);
        }),
        { numRuns: 200 },
      );
    });

    it('serialized form has ISO date strings, not Date objects', () => {
      fc.assert(
        fc.property(articleArb, (article) => {
          const serialized = serializeArticle(article);

          expect(typeof serialized.createdAt).toBe('string');
          expect(typeof serialized.updatedAt).toBe('string');
          if (serialized.publishedAt !== null) {
            expect(typeof serialized.publishedAt).toBe('string');
          }

          // Verify they are valid ISO strings
          expect(new Date(serialized.createdAt).toISOString()).toBe(serialized.createdAt);
          expect(new Date(serialized.updatedAt).toISOString()).toBe(serialized.updatedAt);
          if (serialized.publishedAt !== null) {
            expect(new Date(serialized.publishedAt).toISOString()).toBe(serialized.publishedAt);
          }
        }),
        { numRuns: 200 },
      );
    });

    it('round-trip through JSON.stringify/parse preserves equivalence', () => {
      fc.assert(
        fc.property(articleArb, (article) => {
          const serialized = serializeArticle(article);
          // Simulate actual JSON transport
          const jsonString = JSON.stringify(serialized);
          const parsed = JSON.parse(jsonString);
          const deserialized = deserializeArticle(parsed);

          expect(deserialized.id).toBe(article.id);
          expect(deserialized.title).toBe(article.title);
          expect(deserialized.slug).toBe(article.slug);
          expect(deserialized.content).toBe(article.content);
          expect(deserialized.excerpt).toBe(article.excerpt);
          expect(deserialized.status).toBe(article.status);
          expect(deserialized.isBreaking).toBe(article.isBreaking);
          expect(deserialized.featuredImage).toBe(article.featuredImage);
          expect(deserialized.createdAt.getTime()).toBe(article.createdAt.getTime());
          expect(deserialized.updatedAt.getTime()).toBe(article.updatedAt.getTime());
          expect(deserialized.author).toEqual(article.author);
          expect(deserialized.category).toEqual(article.category);
          expect(deserialized.tags).toEqual(article.tags.map((at) => at.tag));
        }),
        { numRuns: 200 },
      );
    });
  });
});
