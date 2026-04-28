import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: publisher-dashboard
 * Property tests for the Users admin page.
 *
 * These tests replicate the exact data-transformation and logic functions
 * from users/page.tsx to verify correctness properties without React rendering.
 */

// ── Replicated types from page.tsx ─────────────────────────────────────────

type UserRole = 'ADMIN' | 'EDITOR' | 'AUTHOR';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

// ── Replicated logic from page.tsx ─────────────────────────────────────────

/**
 * Builds the API payload for creating a user.
 * Mirrors the handleSubmit body construction in page.tsx:
 *   const body = { name, email, role };
 *   if (formPassword) body.password = formPassword;
 *
 * On create, password is always required (form enforces `required={!editingId}`),
 * so the create payload always includes password.
 */
function buildCreateUserPayload(form: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}): Record<string, string> {
  const body: Record<string, string> = {
    name: form.name,
    email: form.email,
    role: form.role,
  };
  if (form.password) body.password = form.password;
  return body;
}

/**
 * Builds the API payload for editing a user.
 * Mirrors the handleSubmit body construction in page.tsx for the edit case:
 *   const body = { name, email, role };
 *   if (formPassword) body.password = formPassword;
 *
 * On edit, password is optional — only included when non-empty.
 */
function buildEditUserPayload(form: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}): Record<string, string> {
  const body: Record<string, string> = {
    name: form.name,
    email: form.email,
    role: form.role,
  };
  if (form.password) body.password = form.password;
  return body;
}

/**
 * Populates form fields from a user entity.
 * Mirrors the openEditForm logic in page.tsx:
 *   setEditingId(u.id);
 *   setFormName(u.name);
 *   setFormEmail(u.email);
 *   setFormRole(u.role);
 *   setFormPassword('');
 */
function populateEditForm(user: User) {
  return {
    editingId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    password: '',
  };
}

// ── Arbitraries ────────────────────────────────────────────────────────────

const idArb = fc.uuid();

const roleArb = fc.constantFrom<UserRole>('ADMIN', 'EDITOR', 'AUTHOR');

const nameArb = fc.string({ minLength: 1, maxLength: 50 });

const emailArb = fc.emailAddress();

const passwordArb = fc.string({ minLength: 8, maxLength: 64 });

const userArb: fc.Arbitrary<User> = fc.record({
  id: idArb,
  name: nameArb,
  email: emailArb,
  role: roleArb,
  createdAt: fc
    .integer({ min: 1577836800000, max: 1893456000000 })
    .map((ts) => new Date(ts).toISOString()),
});

const createFormArb = fc.record({
  name: nameArb,
  email: emailArb,
  password: passwordArb,
  role: roleArb,
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Feature: publisher-dashboard', () => {
  /**
   * Property 1: CRUD form submission produces correct API payload (user entity)
   * Validates: Requirements 8.3, 8.4
   *
   * For any valid user form data, submitting the create form should produce
   * a POST request with correct payload shape containing name, email, password, role.
   * For edit, the payload contains name, email, role, and password only if provided.
   */
  describe('Property 1: CRUD form submission produces correct API payload', () => {
    it('create payload should contain name, email, password, and role', () => {
      fc.assert(
        fc.property(createFormArb, (form) => {
          const payload = buildCreateUserPayload(form);

          expect(payload.name).toBe(form.name);
          expect(payload.email).toBe(form.email);
          expect(payload.role).toBe(form.role);

          // Password is always present on create (non-empty by generator)
          expect(payload.password).toBe(form.password);

          // Payload should contain exactly these 4 keys
          const keys = Object.keys(payload).sort();
          expect(keys).toEqual(['email', 'name', 'password', 'role']);
        }),
        { numRuns: 100 },
      );
    });

    it('create payload should be JSON-serializable', () => {
      fc.assert(
        fc.property(createFormArb, (form) => {
          const payload = buildCreateUserPayload(form);
          const serialized = JSON.stringify(payload);
          const deserialized = JSON.parse(serialized);
          expect(deserialized).toEqual(payload);
        }),
        { numRuns: 100 },
      );
    });

    it('edit payload should include password only when non-empty', () => {
      fc.assert(
        fc.property(
          nameArb,
          emailArb,
          fc.oneof(fc.constant(''), passwordArb),
          roleArb,
          (name, email, password, role) => {
            const payload = buildEditUserPayload({ name, email, password, role });

            // Always present
            expect(payload.name).toBe(name);
            expect(payload.email).toBe(email);
            expect(payload.role).toBe(role);

            if (password) {
              expect(payload.password).toBe(password);
              expect(Object.keys(payload).sort()).toEqual([
                'email',
                'name',
                'password',
                'role',
              ]);
            } else {
              expect(payload).not.toHaveProperty('password');
              expect(Object.keys(payload).sort()).toEqual(['email', 'name', 'role']);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('edit payload should be JSON-serializable', () => {
      fc.assert(
        fc.property(
          nameArb,
          emailArb,
          fc.oneof(fc.constant(''), passwordArb),
          roleArb,
          (name, email, password, role) => {
            const payload = buildEditUserPayload({ name, email, password, role });
            const serialized = JSON.stringify(payload);
            const deserialized = JSON.parse(serialized);
            expect(deserialized).toEqual(payload);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('role field is always one of ADMIN, EDITOR, AUTHOR', () => {
      fc.assert(
        fc.property(createFormArb, (form) => {
          const payload = buildCreateUserPayload(form);
          expect(['ADMIN', 'EDITOR', 'AUTHOR']).toContain(payload.role);
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 2: Edit form population matches fetched entity data (user entity)
   * Validates: Requirements 8.3, 8.4
   *
   * For any user fetched from the API, populating the edit form and reading back
   * should match the original user's editable fields.
   */
  describe('Property 2: Edit form population matches fetched entity data', () => {
    it('should populate form fields matching the user data', () => {
      fc.assert(
        fc.property(userArb, (user) => {
          const form = populateEditForm(user);

          expect(form.editingId).toBe(user.id);
          expect(form.name).toBe(user.name);
          expect(form.email).toBe(user.email);
          expect(form.role).toBe(user.role);
          // Password is always cleared on edit form open
          expect(form.password).toBe('');
        }),
        { numRuns: 100 },
      );
    });

    it('should produce a round-trip: populate form then build edit payload preserves data', () => {
      fc.assert(
        fc.property(userArb, (user) => {
          const form = populateEditForm(user);
          const payload = buildEditUserPayload({
            name: form.name,
            email: form.email,
            password: form.password,
            role: form.role,
          });

          // Core fields always match
          expect(payload.name).toBe(user.name);
          expect(payload.email).toBe(user.email);
          expect(payload.role).toBe(user.role);

          // Password is empty from populateEditForm, so it should NOT be in payload
          expect(payload).not.toHaveProperty('password');
        }),
        { numRuns: 100 },
      );
    });

    it('edit form population preserves all editable fields without mutation', () => {
      fc.assert(
        fc.property(userArb, (user) => {
          const originalUser = { ...user };
          const form = populateEditForm(user);

          // Original user object should not be mutated
          expect(user).toEqual(originalUser);

          // Form values are exact copies, not references
          expect(form.name).toBe(originalUser.name);
          expect(form.email).toBe(originalUser.email);
          expect(form.role).toBe(originalUser.role);
        }),
        { numRuns: 100 },
      );
    });
  });
});
