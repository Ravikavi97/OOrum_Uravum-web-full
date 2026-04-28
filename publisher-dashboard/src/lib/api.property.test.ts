import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { adminFetch, AdminApiError } from './api';

/**
 * Feature: publisher-dashboard
 * Property tests for the admin fetch helper
 */

// Save and restore global fetch
const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('Feature: publisher-dashboard', () => {
  /**
   * Property 5: API error responses are displayed to the user
   * Validates: Requirements 12.5
   *
   * For any API error response with an error.message field,
   * the admin fetch helper should throw an error containing that message.
   */
  describe('Property 5: API error responses are displayed to the user', () => {
    it('should throw AdminApiError with the message from the API error body', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random HTTP error status codes (4xx and 5xx)
          fc.integer({ min: 400, max: 599 }),
          // Generate random error codes
          fc.stringMatching(/^[A-Z_]{3,30}$/),
          // Generate random error messages (non-empty)
          fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          // Generate a random token
          fc.string({ minLength: 1, maxLength: 100 }),
          async (status, code, message, token) => {
            const errorBody = { error: { code, message } };

            globalThis.fetch = vi.fn().mockResolvedValue({
              ok: false,
              status,
              statusText: 'Error',
              json: () => Promise.resolve(errorBody),
            });

            try {
              await adminFetch('/test', { token });
              // Should not reach here
              expect.unreachable('adminFetch should have thrown');
            } catch (err) {
              expect(err).toBeInstanceOf(AdminApiError);
              const apiErr = err as AdminApiError;
              expect(apiErr.message).toBe(message);
              expect(apiErr.status).toBe(status);
              expect(apiErr.code).toBe(code);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 17: Bearer token included in all admin API requests
   * Validates: Requirements 12.5
   *
   * For any API call made through the admin fetch helper,
   * the request should include an Authorization header with value Bearer ${token}.
   */
  describe('Property 17: Bearer token included in all admin API requests', () => {
    it('should include Authorization: Bearer <token> header in every request', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random API paths
          fc.stringMatching(/^\/[a-z\-_]{1,50}$/).map(s => s || '/test'),
          // Generate random tokens (non-empty, no whitespace)
          fc.stringMatching(/^[a-zA-Z0-9._\-]{1,100}$/),
          // Generate random HTTP methods
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH'),
          async (path, token, method) => {
            const mockFetch = vi.fn().mockResolvedValue({
              ok: true,
              json: () => Promise.resolve({ data: 'ok' }),
            });
            globalThis.fetch = mockFetch;

            await adminFetch(path, { token, method });

            expect(mockFetch).toHaveBeenCalledOnce();
            const [, requestInit] = mockFetch.mock.calls[0];
            const headers = requestInit.headers as Record<string, string>;
            expect(headers.Authorization).toBe(`Bearer ${token}`);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
