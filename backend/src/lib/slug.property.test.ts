import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generateTamilSlug, isValidSlug } from './slug';

/**
 * Property-based tests for Tamil slug generator.
 *
 * **Validates: Requirements 7.4, 1.6**
 *
 * Property 1: Slug URL-safety — For all valid Tamil titles, the generated slug
 * contains only URL-safe characters (a-z, 0-9, hyphens, percent-encoded sequences).
 */

// Arbitrary: generates random Tamil strings using Unicode range U+0B80–U+0BFF
const tamilCharArb = fc.integer({ min: 0x0b80, max: 0x0bff }).map((cp) => String.fromCodePoint(cp));
const tamilStringArb = fc
  .array(tamilCharArb, { minLength: 1, maxLength: 50 })
  .map((chars) => chars.join(''));

// Arbitrary: generates mixed Tamil + Latin strings
const mixedStringArb = fc
  .tuple(tamilStringArb, fc.string({ minLength: 1, maxLength: 20 }))
  .map(([tamil, latin]) => `${tamil} ${latin}`);

// Regex: matches only URL-safe slug characters (a-z, 0-9, hyphens, percent-encoded %XX)
const URL_SAFE_SLUG_RE = /^(?:[a-z0-9\-]|%[0-9A-Fa-f]{2})+$/;

describe('Tamil Slug Generator — Property Tests', () => {
  /**
   * **Property 1: Slug URL-safety**
   * **Validates: Requirements 7.4, 1.6**
   */
  describe('Property 1: Slug URL-safety', () => {
    it('should produce URL-safe slugs for all Tamil strings', () => {
      fc.assert(
        fc.property(tamilStringArb, (tamilTitle) => {
          const slug = generateTamilSlug(tamilTitle);

          // Slug must not be empty (or must be 'untitled' for empty-producing input)
          expect(slug.length).toBeGreaterThan(0);

          // Slug must contain only URL-safe characters
          expect(slug).toMatch(URL_SAFE_SLUG_RE);

          // Slug must not start or end with a hyphen
          expect(slug.startsWith('-')).toBe(false);
          expect(slug.endsWith('-')).toBe(false);

          // Slug must not contain consecutive hyphens
          expect(slug).not.toContain('--');
        }),
        { numRuns: 200 },
      );
    });

    it('should produce URL-safe slugs for mixed Tamil+Latin strings', () => {
      fc.assert(
        fc.property(mixedStringArb, (mixedTitle) => {
          const slug = generateTamilSlug(mixedTitle);

          expect(slug.length).toBeGreaterThan(0);
          expect(slug).toMatch(URL_SAFE_SLUG_RE);
          expect(slug.startsWith('-')).toBe(false);
          expect(slug.endsWith('-')).toBe(false);
          expect(slug).not.toContain('--');
        }),
        { numRuns: 200 },
      );
    });

    it('should return "untitled" for empty input', () => {
      const slug = generateTamilSlug('');
      expect(slug).toBe('untitled');
    });

    it('isValidSlug returns true for all generated Tamil slugs', () => {
      fc.assert(
        fc.property(tamilStringArb, (tamilTitle) => {
          const slug = generateTamilSlug(tamilTitle);
          expect(isValidSlug(slug)).toBe(true);
        }),
        { numRuns: 200 },
      );
    });

    it('isValidSlug returns true for all generated mixed Tamil+Latin slugs', () => {
      fc.assert(
        fc.property(mixedStringArb, (mixedTitle) => {
          const slug = generateTamilSlug(mixedTitle);
          expect(isValidSlug(slug)).toBe(true);
        }),
        { numRuns: 200 },
      );
    });
  });
});
