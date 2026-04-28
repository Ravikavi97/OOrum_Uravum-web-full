/**
 * Property-based test for RSS feed round-trip.
 *
 * **Validates: Requirements 5.8**
 *
 * Property 3: RSS feed round-trip — For all valid article lists,
 * generating RSS feed then parsing the output produces article metadata
 * equivalent to the original input.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateRssFeed, parseRssFeed, FeedArticle } from './feed';

// Generator for a valid FeedArticle
const feedArticleArb = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 100 })
    .filter((s) => s.trim().length > 0)
    .map((s) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim())
    .filter((s) => s.length > 0),
  slug: fc.stringMatching(/^[a-z0-9]+(-[a-z0-9]+)*$/).filter((s) => s.length > 0 && s.length <= 80),
  content: fc.string({ minLength: 1, maxLength: 500 })
    .map((s) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim())
    .filter((s) => s.length > 0),
  excerpt: fc.string({ minLength: 1, maxLength: 200 })
    .map((s) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim())
    .filter((s) => s.length > 0),
  publishedAt: fc.date({
    min: new Date('2020-01-01'),
    max: new Date('2030-01-01'),
  }).filter((d) => !isNaN(d.getTime())),
  author: fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 })
      .filter((s) => s.trim().length > 0)
      .map((s) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim())
      .filter((s) => s.length > 0),
    slug: fc.stringMatching(/^[a-z0-9]+(-[a-z0-9]+)*$/).filter((s) => s.length > 0),
  }),
  category: fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 })
      .filter((s) => s.trim().length > 0)
      .map((s) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim())
      .filter((s) => s.length > 0),
    slug: fc.stringMatching(/^[a-z0-9]+(-[a-z0-9]+)*$/).filter((s) => s.length > 0),
  }),
  tags: fc.array(
    fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 50 })
        .filter((s) => s.trim().length > 0)
        .map((s) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim())
        .filter((s) => s.length > 0),
      slug: fc.stringMatching(/^[a-z0-9]+(-[a-z0-9]+)*$/).filter((s) => s.length > 0),
    }),
    { minLength: 0, maxLength: 5 },
  ),
  featuredImage: fc.constant(null),
}) as fc.Arbitrary<FeedArticle>;

describe('RSS Feed Round-Trip Property', () => {
  it('Property 3: generating RSS then parsing produces equivalent article metadata', () => {
    fc.assert(
      fc.property(
        fc.array(feedArticleArb, { minLength: 1, maxLength: 10 }),
        (articles) => {
          const xml = generateRssFeed(articles);
          const parsed = parseRssFeed(xml);

          // Same number of articles
          expect(parsed.length).toBe(articles.length);

          for (let i = 0; i < articles.length; i++) {
            const original = articles[i];
            const result = parsed[i];

            // Title preserved
            expect(result.title).toBe(original.title);

            // Link contains slug
            expect(result.link).toContain(`/news/${original.slug}`);

            // Description matches excerpt
            const expectedDesc = original.excerpt || (original.content as string).substring(0, 200);
            expect(result.description.trim()).toBe(expectedDesc.trim());

            // Author name preserved
            expect(result.author).toBe(original.author.name);

            // Categories include category name and tag names
            const expectedCategories = [
              original.category.name,
              ...original.tags.map((t) => t.name),
            ];
            expect(result.categories).toEqual(expectedCategories);

            // pubDate is a valid date string
            expect(new Date(result.pubDate).getTime()).not.toBeNaN();
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});
