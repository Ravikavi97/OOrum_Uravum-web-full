import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: publisher-dashboard
 * Property tests for authentication flows: logout, auth guard, and login storage.
 *
 * These tests replicate the pure logic from AuthContext.tsx and the admin layout
 * auth guard to verify correctness properties without React rendering.
 */

// ── Replicated types from AuthContext.tsx ───────────────────────────────────

type UserRole = 'ADMIN' | 'EDITOR' | 'AUTHOR';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

// ── localStorage mock ──────────────────────────────────────────────────────

type MockLocalStorage = ReturnType<typeof createMockLocalStorage>;

function createMockLocalStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string): string | null => store[key] ?? null,
    setItem: (key: string, value: string): void => { store[key] = value; },
    removeItem: (key: string): void => { delete store[key]; },
  };
}

// ── Replicated logic from AuthContext.tsx ───────────────────────────────────

/**
 * Replicates the logout callback logic:
 *   localStorage.removeItem('admin_token');
 *   localStorage.removeItem('admin_user');
 *   localStorage.removeItem('admin_refresh_token');
 * Returns the resulting auth state (user: null, token: null).
 */
function logoutLogic(ls: MockLocalStorage) {
  ls.removeItem('admin_token');
  ls.removeItem('admin_user');
  ls.removeItem('admin_refresh_token');
  return { user: null, token: null };
}

/**
 * Replicates the auth guard logic from AdminGuard in layout.tsx:
 *   if (loading) return 'loading';
 *   if (!user) return 'show_login';
 *   return 'show_content';
 */
function authGuardDecision(user: AuthUser | null, loading: boolean): 'loading' | 'show_login' | 'show_content' {
  if (loading) return 'loading';
  if (!user) return 'show_login';
  return 'show_content';
}

/**
 * Replicates the initialization logic from AuthProvider useEffect:
 * Reads admin_token and admin_user from localStorage.
 * Returns { user, token } or { user: null, token: null } if missing/invalid.
 */
function initAuthFromStorage(ls: MockLocalStorage): { user: AuthUser | null; token: string | null } {
  const storedToken = ls.getItem('admin_token');
  const storedUser = ls.getItem('admin_user');
  if (storedToken && storedUser) {
    try {
      return { token: storedToken, user: JSON.parse(storedUser) };
    } catch {
      ls.removeItem('admin_token');
      ls.removeItem('admin_user');
      return { user: null, token: null };
    }
  }
  return { user: null, token: null };
}

/**
 * Replicates the login success path from AuthContext:
 * Stores accessToken under admin_token, user JSON under admin_user,
 * and optionally refreshToken under admin_refresh_token.
 */
function loginStoreLogic(
  ls: MockLocalStorage,
  data: { accessToken: string; user: AuthUser; refreshToken?: string },
) {
  ls.setItem('admin_token', data.accessToken);
  ls.setItem('admin_user', JSON.stringify(data.user));
  if (data.refreshToken) {
    ls.setItem('admin_refresh_token', data.refreshToken);
  }
  return { token: data.accessToken, user: data.user };
}

// ── Arbitraries ────────────────────────────────────────────────────────────

const roleArb = fc.constantFrom<UserRole>('ADMIN', 'EDITOR', 'AUTHOR');

const authUserArb = fc.record({
  id: fc.uuid(),
  email: fc.emailAddress(),
  name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  role: roleArb,
});

const jwtTokenArb = fc.string({ minLength: 10, maxLength: 500 }).filter(s => s.trim().length > 0 && !s.includes('\x00'));

const refreshTokenArb = fc.option(
  fc.string({ minLength: 10, maxLength: 500 }).filter(s => s.trim().length > 0 && !s.includes('\x00')),
  { nil: undefined },
);

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Feature: publisher-dashboard', () => {
  let ls: MockLocalStorage;

  beforeEach(() => {
    ls = createMockLocalStorage();
  });

  /**
   * Property 14: Logout clears auth state
   * Validates: Requirements 11.6
   *
   * For any authenticated session, clicking logout should remove admin_token,
   * admin_user, and admin_refresh_token from localStorage, and the auth context
   * should have user: null and token: null.
   */
  describe('Property 14: Logout clears auth state', () => {
    it('should clear all three localStorage keys and return null auth state for any session', () => {
      fc.assert(
        fc.property(
          authUserArb,
          jwtTokenArb,
          refreshTokenArb,
          (user, token, refreshToken) => {
            // Set up an authenticated session
            ls.setItem('admin_token', token);
            ls.setItem('admin_user', JSON.stringify(user));
            if (refreshToken) {
              ls.setItem('admin_refresh_token', refreshToken);
            }

            // Perform logout
            const result = logoutLogic(ls);

            // Verify localStorage is cleared
            expect(ls.getItem('admin_token')).toBeNull();
            expect(ls.getItem('admin_user')).toBeNull();
            expect(ls.getItem('admin_refresh_token')).toBeNull();

            // Verify auth state is null
            expect(result.user).toBeNull();
            expect(result.token).toBeNull();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 15: Auth guard shows login for unauthenticated users
   * Validates: Requirements 12.1
   *
   * For any admin route, when no valid token exists in localStorage,
   * the admin layout should render the login form instead of the admin content.
   */
  describe('Property 15: Auth guard shows login for unauthenticated users', () => {
    it('should return show_login when no token exists in localStorage', () => {
      fc.assert(
        fc.property(
          fc.constant(null), // no pre-existing data
          () => {
            // localStorage is empty — simulate initialization
            const authState = initAuthFromStorage(ls);

            // Auth guard should decide to show login
            const decision = authGuardDecision(authState.user, false);
            expect(decision).toBe('show_login');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return show_login after logout clears any previous session', () => {
      fc.assert(
        fc.property(
          authUserArb,
          jwtTokenArb,
          refreshTokenArb,
          (user, token, refreshToken) => {
            // Set up a session then log out
            ls.setItem('admin_token', token);
            ls.setItem('admin_user', JSON.stringify(user));
            if (refreshToken) {
              ls.setItem('admin_refresh_token', refreshToken);
            }

            logoutLogic(ls);

            // Re-initialize from storage (simulates page reload after logout)
            const authState = initAuthFromStorage(ls);
            const decision = authGuardDecision(authState.user, false);
            expect(decision).toBe('show_login');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return show_content when a valid token and user exist', () => {
      fc.assert(
        fc.property(
          authUserArb,
          jwtTokenArb,
          (user, token) => {
            ls.setItem('admin_token', token);
            ls.setItem('admin_user', JSON.stringify(user));

            const authState = initAuthFromStorage(ls);
            const decision = authGuardDecision(authState.user, false);
            expect(decision).toBe('show_content');
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 16: Login stores JWT and user in localStorage
   * Validates: Requirements 12.2
   *
   * For any successful login response containing accessToken and user fields,
   * the auth context should store the token under admin_token and the user JSON
   * under admin_user in localStorage.
   */
  describe('Property 16: Login stores JWT and user in localStorage', () => {
    it('should store accessToken and user in localStorage for any login response', () => {
      fc.assert(
        fc.property(
          authUserArb,
          jwtTokenArb,
          refreshTokenArb,
          (user, accessToken, refreshToken) => {
            // Fresh store each iteration to avoid cross-contamination
            const freshLs = createMockLocalStorage();
            const loginData = { accessToken, user, refreshToken };

            const result = loginStoreLogic(freshLs, loginData);

            // Verify token stored correctly
            expect(freshLs.getItem('admin_token')).toBe(accessToken);

            // Verify user stored as JSON and round-trips correctly
            const storedUser = freshLs.getItem('admin_user');
            expect(storedUser).not.toBeNull();
            expect(JSON.parse(storedUser!)).toEqual(user);

            // Verify refresh token stored only when present
            if (refreshToken) {
              expect(freshLs.getItem('admin_refresh_token')).toBe(refreshToken);
            } else {
              expect(freshLs.getItem('admin_refresh_token')).toBeNull();
            }

            // Verify returned auth state
            expect(result.token).toBe(accessToken);
            expect(result.user).toEqual(user);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should produce auth state recoverable from localStorage after login', () => {
      fc.assert(
        fc.property(
          authUserArb,
          jwtTokenArb,
          (user, accessToken) => {
            // Simulate login storing data
            loginStoreLogic(ls, { accessToken, user });

            // Simulate page reload — re-read from localStorage
            const recovered = initAuthFromStorage(ls);

            expect(recovered.token).toBe(accessToken);
            expect(recovered.user).toEqual(user);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
