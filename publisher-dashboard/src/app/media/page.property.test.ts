import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateMediaFile } from './page';

/**
 * Feature: publisher-dashboard
 * Property 12: File upload validation rejects invalid files
 *
 * Validates: Requirements 5.3
 *
 * For any file with size exceeding 10MB or with a MIME type not in
 * [image/jpeg, image/png, image/webp, image/avif], the client-side
 * validation should reject the upload before sending the request.
 */

const VALID_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ── Helpers ────────────────────────────────────────────────────────────────

function makeFile(name: string, size: number, type: string): File {
  // Create a File-like object with the specified size and type
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

// ── Arbitraries ────────────────────────────────────────────────────────────

const validMimeArb = fc.constantFrom(...VALID_MIME_TYPES);

const invalidMimeArb = fc.oneof(
  fc.constantFrom(
    'application/pdf',
    'text/plain',
    'image/gif',
    'image/svg+xml',
    'image/bmp',
    'video/mp4',
    'application/octet-stream',
  ),
  fc.string({ minLength: 1, maxLength: 30 }).filter(
    (s) => !VALID_MIME_TYPES.includes(s),
  ),
);

// Valid size: 1 byte to 10MB inclusive
const validSizeArb = fc.integer({ min: 1, max: MAX_FILE_SIZE });

// Invalid size: exceeds 10MB (10MB + 1 to 50MB)
const invalidSizeArb = fc.integer({ min: MAX_FILE_SIZE + 1, max: 50 * 1024 * 1024 });

const filenameArb = fc.string({ minLength: 1, maxLength: 50 }).map((s) => s.replace(/\0/g, '_') + '.img');

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Feature: publisher-dashboard', () => {
  describe('Property 12: File upload validation rejects invalid files', () => {
    it('files with valid MIME types and valid sizes should pass validation', () => {
      fc.assert(
        fc.property(filenameArb, validSizeArb, validMimeArb, (name, size, mime) => {
          const file = makeFile(name, size, mime);
          const result = validateMediaFile(file);
          expect(result).toBeNull();
        }),
        { numRuns: 100 },
      );
    });

    it('files with invalid MIME types should be rejected', () => {
      fc.assert(
        fc.property(filenameArb, validSizeArb, invalidMimeArb, (name, size, mime) => {
          const file = makeFile(name, size, mime);
          const result = validateMediaFile(file);
          expect(result).not.toBeNull();
          expect(typeof result).toBe('string');
          expect(result!.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 },
      );
    });

    it('files exceeding 10MB should be rejected', () => {
      fc.assert(
        fc.property(filenameArb, invalidSizeArb, validMimeArb, (name, size, mime) => {
          const file = makeFile(name, size, mime);
          const result = validateMediaFile(file);
          expect(result).not.toBeNull();
          expect(typeof result).toBe('string');
          expect(result!.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 },
      );
    });

    it('files with both invalid type and size should be rejected', () => {
      fc.assert(
        fc.property(filenameArb, invalidSizeArb, invalidMimeArb, (name, size, mime) => {
          const file = makeFile(name, size, mime);
          const result = validateMediaFile(file);
          expect(result).not.toBeNull();
          expect(typeof result).toBe('string');
          expect(result!.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 },
      );
    });
  });
});
