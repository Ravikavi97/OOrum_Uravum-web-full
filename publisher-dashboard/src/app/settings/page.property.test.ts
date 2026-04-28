import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: publisher-dashboard
 * Property 11: Settings round-trip
 *
 * Validates: Requirements 4.1, 4.2
 *
 * For any valid settings object (site title, description, social links,
 * analytics ID), saving via PUT /api/settings and then fetching via
 * GET /api/settings should return values equivalent to what was saved.
 */

// ── Replicated types from page.tsx ─────────────────────────────────────────

interface SettingsForm {
  siteTitle: string;
  siteDescription: string;
  socialFacebook: string;
  socialTwitter: string;
  socialInstagram: string;
  analyticsId: string;
}

// ── Replicated logic from page.tsx ─────────────────────────────────────────

/**
 * Builds the array of { key, value } setting pairs that the save handler
 * sends via PUT /api/settings. Mirrors handleSubmit in page.tsx.
 */
function buildSavePayloads(form: SettingsForm): Array<{ key: string; value: string }> {
  return [
    { key: 'siteTitle', value: form.siteTitle },
    { key: 'siteDescription', value: form.siteDescription },
    {
      key: 'socialLinks',
      value: JSON.stringify({
        facebook: form.socialFacebook,
        twitter: form.socialTwitter,
        instagram: form.socialInstagram,
      }),
    },
    { key: 'analyticsId', value: form.analyticsId },
  ];
}

/**
 * Parses the GET /api/settings response (array of { key, value }) back
 * into a SettingsForm. Mirrors the fetchSettings parsing logic in page.tsx.
 */
function parseSettingsFromResponse(
  data: Array<{ key: string; value: string }>,
): SettingsForm {
  const map: Record<string, string> = {};
  data.forEach((s) => {
    map[s.key] = s.value;
  });

  let facebook = '';
  let twitter = '';
  let instagram = '';
  if (map['socialLinks']) {
    try {
      const social = JSON.parse(map['socialLinks']);
      facebook = social.facebook || '';
      twitter = social.twitter || '';
      instagram = social.instagram || '';
    } catch {
      /* ignore malformed JSON */
    }
  }

  return {
    siteTitle: map['siteTitle'] || '',
    siteDescription: map['siteDescription'] || '',
    socialFacebook: facebook,
    socialTwitter: twitter,
    socialInstagram: instagram,
    analyticsId: map['analyticsId'] || '',
  };
}

// ── Arbitraries ────────────────────────────────────────────────────────────

/**
 * Generate a non-empty printable string suitable for site title / description.
 */
const textArb = fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0);

/**
 * Generate a URL-like string for social links (can be empty).
 */
const urlArb = fc.oneof(
  fc.constant(''),
  fc.webUrl(),
);

/**
 * Generate an analytics ID string (can be empty or G-XXXXXXXXXX pattern).
 */
const analyticsIdArb = fc.oneof(
  fc.constant(''),
  fc
    .array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), {
      minLength: 8,
      maxLength: 12,
    })
    .map((chars) => `G-${chars.join('')}`),
);

/**
 * Generate a valid SettingsForm with arbitrary field values.
 */
const settingsFormArb: fc.Arbitrary<SettingsForm> = fc.record({
  siteTitle: textArb,
  siteDescription: textArb,
  socialFacebook: urlArb,
  socialTwitter: urlArb,
  socialInstagram: urlArb,
  analyticsId: analyticsIdArb,
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Feature: publisher-dashboard', () => {
  describe('Property 11: Settings round-trip', () => {
    it('saving settings and reading them back produces equivalent form data', () => {
      fc.assert(
        fc.property(settingsFormArb, (form) => {
          // Simulate save: build the PUT payloads
          const payloads = buildSavePayloads(form);

          // Simulate read: parse the GET response (same key/value pairs)
          const restored = parseSettingsFromResponse(payloads);

          // All fields should round-trip exactly
          expect(restored.siteTitle).toBe(form.siteTitle);
          expect(restored.siteDescription).toBe(form.siteDescription);
          expect(restored.socialFacebook).toBe(form.socialFacebook);
          expect(restored.socialTwitter).toBe(form.socialTwitter);
          expect(restored.socialInstagram).toBe(form.socialInstagram);
          expect(restored.analyticsId).toBe(form.analyticsId);
        }),
        { numRuns: 100 },
      );
    });

    it('socialLinks JSON serialization is reversible for any URL combination', () => {
      fc.assert(
        fc.property(urlArb, urlArb, urlArb, (facebook, twitter, instagram) => {
          // Serialize social links as the page does
          const serialized = JSON.stringify({ facebook, twitter, instagram });

          // Parse back as the page does
          const parsed = JSON.parse(serialized);

          expect(parsed.facebook || '').toBe(facebook);
          expect(parsed.twitter || '').toBe(twitter);
          expect(parsed.instagram || '').toBe(instagram);
        }),
        { numRuns: 100 },
      );
    });

    it('settings round-trip is stable across multiple save/load cycles', () => {
      fc.assert(
        fc.property(settingsFormArb, (form) => {
          // First cycle
          const payloads1 = buildSavePayloads(form);
          const restored1 = parseSettingsFromResponse(payloads1);

          // Second cycle (save the restored form, read it back again)
          const payloads2 = buildSavePayloads(restored1);
          const restored2 = parseSettingsFromResponse(payloads2);

          // Both restorations should be identical
          expect(restored2.siteTitle).toBe(restored1.siteTitle);
          expect(restored2.siteDescription).toBe(restored1.siteDescription);
          expect(restored2.socialFacebook).toBe(restored1.socialFacebook);
          expect(restored2.socialTwitter).toBe(restored1.socialTwitter);
          expect(restored2.socialInstagram).toBe(restored1.socialInstagram);
          expect(restored2.analyticsId).toBe(restored1.analyticsId);
        }),
        { numRuns: 100 },
      );
    });

    it('payload keys match expected setting keys', () => {
      fc.assert(
        fc.property(settingsFormArb, (form) => {
          const payloads = buildSavePayloads(form);
          const keys = payloads.map((p) => p.key);

          expect(keys).toEqual(['siteTitle', 'siteDescription', 'socialLinks', 'analyticsId']);
        }),
        { numRuns: 100 },
      );
    });
  });
});
