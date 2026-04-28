import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: publisher-dashboard
 * Property tests for the Comments admin page.
 *
 * These tests replicate the exact data-transformation and logic functions
 * from comments/page.tsx to verify correctness properties without React rendering.
 */

// ── Replicated types from page.tsx ─────────────────────────────────────────

type CommentStatus = 'PENDING' | 'APPROVED' | 'FLAGGED' | 'REJECTED';
type ModeratableStatus = 'PENDING' | 'FLAGGED';
type ModerationAction = 'approve' | 'reject';
type StatusFilter = 'PENDING' | 'FLAGGED' | '';

interface Comment {
  id: string;
  displayName: string;
  email: string;
  content: string;
  status: CommentStatus;
  articleId: string;
  createdAt: string;
  article?: { title: string };
}

// ── Replicated logic from page.tsx ─────────────────────────────────────────

/**
 * Builds the moderation action API request.
 * Mirrors the handleAction logic in page.tsx:
 *   adminFetch(`/comments/${id}/${action}`, { token: token!, method: 'PUT' })
 */
function buildModerationRequest(commentId: string, action: ModerationAction) {
  return {
    url: `/comments/${commentId}/${action}`,
    method: 'PUT' as const,
  };
}

/**
 * Computes the optimistic status update after a moderation action.
 * Mirrors the setComments callback in handleAction:
 *   { ...c, status: action === 'approve' ? 'APPROVED' : 'REJECTED' }
 */
function optimisticStatusUpdate(action: ModerationAction): CommentStatus {
  return action === 'approve' ? 'APPROVED' : 'REJECTED';
}

/**
 * Applies optimistic update to a comments list for a given comment id and action.
 * Mirrors: prev.map(c => c.id === id ? { ...c, status: ... } : c)
 */
function applyOptimisticUpdate(
  comments: Comment[],
  targetId: string,
  action: ModerationAction,
): Comment[] {
  return comments.map((c) =>
    c.id === targetId
      ? { ...c, status: optimisticStatusUpdate(action) }
      : c,
  );
}

/**
 * Filters comments by status.
 * Mirrors the server-side filter behavior triggered by the status query param.
 * When filter is '', all comments are returned.
 */
function filterByStatus(comments: Comment[], filter: StatusFilter): Comment[] {
  if (!filter) return comments;
  return comments.filter((c) => c.status === filter);
}

// ── Arbitraries ────────────────────────────────────────────────────────────

const idArb = fc.uuid();

const commentStatusArb = fc.constantFrom<CommentStatus>(
  'PENDING', 'APPROVED', 'FLAGGED', 'REJECTED',
);

const moderatableStatusArb = fc.constantFrom<ModeratableStatus>('PENDING', 'FLAGGED');

const moderationActionArb = fc.constantFrom<ModerationAction>('approve', 'reject');

const statusFilterArb = fc.constantFrom<StatusFilter>('PENDING', 'FLAGGED', '');

const commentArb: fc.Arbitrary<Comment> = fc.record({
  id: idArb,
  displayName: fc.string({ minLength: 1, maxLength: 50 }),
  email: fc.emailAddress(),
  content: fc.string({ minLength: 1, maxLength: 300 }),
  status: commentStatusArb,
  articleId: idArb,
  createdAt: fc.integer({ min: 1577836800000, max: 1893456000000 })
    .map((ts) => new Date(ts).toISOString()),
  article: fc.option(
    fc.record({ title: fc.string({ minLength: 1, maxLength: 100 }) }),
    { nil: undefined },
  ),
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Feature: publisher-dashboard', () => {
  /**
   * Property 8: Comment moderation actions produce correct API calls
   * Validates: Requirements 9.2, 9.3
   *
   * For any comment with PENDING or FLAGGED status, clicking Approve should
   * produce a PUT to /api/comments/:id/approve and clicking Reject should
   * produce a PUT to /api/comments/:id/reject.
   */
  describe('Property 8: Comment moderation actions produce correct API calls', () => {
    it('approve action produces PUT to /comments/:id/approve', () => {
      fc.assert(
        fc.property(idArb, (commentId) => {
          const request = buildModerationRequest(commentId, 'approve');

          expect(request.url).toBe(`/comments/${commentId}/approve`);
          expect(request.method).toBe('PUT');
        }),
        { numRuns: 100 },
      );
    });

    it('reject action produces PUT to /comments/:id/reject', () => {
      fc.assert(
        fc.property(idArb, (commentId) => {
          const request = buildModerationRequest(commentId, 'reject');

          expect(request.url).toBe(`/comments/${commentId}/reject`);
          expect(request.method).toBe('PUT');
        }),
        { numRuns: 100 },
      );
    });

    it('moderation URL always contains the comment id and action', () => {
      fc.assert(
        fc.property(idArb, moderationActionArb, (commentId, action) => {
          const request = buildModerationRequest(commentId, action);

          expect(request.url).toContain(commentId);
          expect(request.url).toContain(action);
          expect(request.url).toBe(`/comments/${commentId}/${action}`);
          expect(request.method).toBe('PUT');
        }),
        { numRuns: 100 },
      );
    });

    it('optimistic update sets APPROVED for approve action', () => {
      fc.assert(
        fc.property(
          commentArb.filter((c) => c.status === 'PENDING' || c.status === 'FLAGGED'),
          (comment) => {
            const updated = applyOptimisticUpdate([comment], comment.id, 'approve');
            expect(updated[0].status).toBe('APPROVED');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('optimistic update sets REJECTED for reject action', () => {
      fc.assert(
        fc.property(
          commentArb.filter((c) => c.status === 'PENDING' || c.status === 'FLAGGED'),
          (comment) => {
            const updated = applyOptimisticUpdate([comment], comment.id, 'reject');
            expect(updated[0].status).toBe('REJECTED');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('optimistic update only modifies the targeted comment', () => {
      fc.assert(
        fc.property(
          fc.array(commentArb, { minLength: 2, maxLength: 15 }),
          moderationActionArb,
          (comments, action) => {
            // Pick the first comment as the target
            const targetId = comments[0].id;
            const updated = applyOptimisticUpdate(comments, targetId, action);

            // All non-target comments remain unchanged
            for (let i = 1; i < comments.length; i++) {
              if (comments[i].id !== targetId) {
                expect(updated[i]).toEqual(comments[i]);
              }
            }

            // Target comment has updated status
            const expectedStatus = optimisticStatusUpdate(action);
            const targetUpdated = updated.find((c) => c.id === targetId);
            expect(targetUpdated?.status).toBe(expectedStatus);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 6: Status filtering returns only matching items (comment status)
   * Validates: Requirements 9.4
   *
   * For any status filter and set of comments, applying filter returns only
   * matching items.
   */
  describe('Property 6: Status filtering returns only matching items', () => {
    it('filtered comments all have the selected status', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<StatusFilter>('PENDING', 'FLAGGED'),
          fc.array(commentArb, { minLength: 0, maxLength: 20 }),
          (filter, comments) => {
            const filtered = filterByStatus(comments, filter);
            for (const comment of filtered) {
              expect(comment.status).toBe(filter);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('no matching comments are excluded by the filter', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<StatusFilter>('PENDING', 'FLAGGED'),
          fc.array(commentArb, { minLength: 0, maxLength: 20 }),
          (filter, comments) => {
            const filtered = filterByStatus(comments, filter);
            const expectedCount = comments.filter((c) => c.status === filter).length;
            expect(filtered.length).toBe(expectedCount);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('empty filter returns all comments', () => {
      fc.assert(
        fc.property(
          fc.array(commentArb, { minLength: 0, maxLength: 20 }),
          (comments) => {
            const filtered = filterByStatus(comments, '');
            expect(filtered.length).toBe(comments.length);
            expect(filtered).toEqual(comments);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('filter preserves comment order', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<StatusFilter>('PENDING', 'FLAGGED'),
          fc.array(commentArb, { minLength: 0, maxLength: 20 }),
          (filter, comments) => {
            const filtered = filterByStatus(comments, filter);
            const manual = comments.filter((c) => c.status === filter);
            expect(filtered).toEqual(manual);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
