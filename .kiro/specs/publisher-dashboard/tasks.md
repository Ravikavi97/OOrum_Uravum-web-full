# Implementation Plan: Publisher Dashboard

## Overview

Enhance the existing admin placeholder pages into a fully functional CMS dashboard. The work covers: (1) backend route extensions for tags, obituaries, and comments, (2) a shared admin fetch helper, (3) enhanced admin layout with full sidebar navigation, (4) 10 admin page implementations, and (5) home layout configuration via site settings. All frontend pages are client components using `'use client'` with JWT auth from `AuthContext`.

## Tasks

- [x] 1. Backend route extensions
  - [x] 1.1 Add PUT /:id and DELETE /:id endpoints to tags route
    - Add `updateTagSchema` with optional `name` field
    - Implement `PUT /:id` with `requireAuth`, `requireRole('ADMIN', 'EDITOR')`, slug regeneration on name change, cache invalidation
    - Implement `DELETE /:id` with `requireAuth`, `requireRole('ADMIN', 'EDITOR')`, confirmation that tag exists before deletion
    - _Requirements: 7.3, 7.4_

  - [x] 1.2 Add POST, PUT /:id, and DELETE /:id endpoints to obituaries route
    - Add `createObituarySchema` (name required, content required, publishedAt optional) and `updateObituarySchema`
    - Implement `POST /` with `requireAuth`, `requireRole('ADMIN', 'EDITOR', 'AUTHOR')`, multer image upload support storing image as `imageData` bytes
    - Implement `PUT /:id` with same auth, allowing update of name, content, imageData, publishedAt
    - Implement `DELETE /:id` with `requireAuth`, `requireRole('ADMIN', 'EDITOR')`
    - _Requirements: 6.2, 6.3, 6.4, 6.5_

  - [x] 1.3 Add GET /admin/all endpoint to comments route for admin listing
    - Implement `GET /admin/all` with `requireAuth`, `requireRole('ADMIN', 'EDITOR')`
    - Accept `status` query param to filter by PENDING, FLAGGED, APPROVED, REJECTED
    - Return paginated comments with article title included via Prisma include
    - _Requirements: 9.1, 9.4_

  - [x] 1.4 Write unit tests for new backend endpoints
    - Test tag PUT/DELETE with valid and invalid inputs
    - Test obituary CRUD with image upload
    - Test comment admin listing with status filters
    - _Requirements: 1.1, 6.1, 7.1, 9.1_

- [x] 2. Shared admin fetch helper and layout enhancements
  - [x] 2.1 Create admin fetch helper at `frontend/src/app/admin/_lib/api.ts`
    - Implement `adminFetch<T>(path, options)` that prepends `API_URL`, sets `Authorization: Bearer ${token}` header, parses JSON, throws `AdminApiError` on non-OK responses with parsed error body
    - Export `AdminApiError` class with `status`, `code`, and `message` fields
    - Export `toQueryString` utility for building query params
    - _Requirements: 12.5, 1.7, 4.3_

  - [x] 2.2 Enhance admin layout sidebar navigation
    - Add Obituaries nav item: `{ label: 'Obituaries', href: '/admin/obituaries', icon: '🕯️' }`
    - Add Home Layout nav item: `{ label: 'Home Layout', href: '/admin/home-layout', icon: '🏠', roles: ['ADMIN'] }`
    - Verify AUTHOR role hides Users, Comments, Settings, Home Layout links
    - Verify EDITOR role hides Users, Settings, Home Layout links
    - _Requirements: 11.1, 11.3, 11.4, 3.5, 9.5_

  - [x] 2.3 Write property tests for admin fetch helper and navigation
    - **Property 5: API error responses are displayed to the user**
    - **Property 17: Bearer token included in all admin API requests**
    - **Property 3: Role-based navigation visibility**
    - **Property 13: Active nav link matches current path**
    - **Validates: Requirements 12.5, 11.2, 11.3, 11.4**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Enhance Articles page
  - [x] 4.1 Enhance articles page with full CRUD, tag/category dropdowns, and RBAC
    - Refactor to use `adminFetch` helper from `_lib/api.ts`
    - Add category dropdown populated from `GET /api/categories` instead of raw ID input
    - Add tags multi-select populated from `GET /api/tags`
    - Add excerpt field, featured image field, breaking news toggle to the form
    - Implement AUTHOR restriction: filter articles by logged-in user's author slug, hide edit button for others' articles
    - Display validation errors from API response inline on form fields
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [x] 4.2 Write property tests for articles page
    - **Property 1: CRUD form submission produces correct API payload** (article entity)
    - **Property 2: Edit form population matches fetched entity data** (article entity)
    - **Property 4: AUTHOR role article editing restriction**
    - **Property 6: Status filtering returns only matching items** (article status)
    - **Property 7: Inline status change produces correct PUT request**
    - **Validates: Requirements 1.3, 1.4, 1.5, 1.6, 1.8**

- [x] 5. Enhance Categories page
  - [x] 5.1 Enhance categories page with parent category display and article count
    - Refactor to use `adminFetch` helper
    - Add parent category name column and article count column to the table
    - Show `HAS_ARTICLES` error message on failed delete attempts
    - Ensure AUTHOR role sees read-only view (no create/edit/delete buttons)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 5.2 Write property test for categories page
    - **Property 1: CRUD form submission produces correct API payload** (category entity)
    - **Property 2: Edit form population matches fetched entity data** (category entity)
    - **Validates: Requirements 2.3, 2.4**

- [x] 6. Enhance Tags page with inline edit and delete
  - [x] 6.1 Add inline editing and delete functionality to tags page
    - Refactor to use `adminFetch` helper
    - Implement inline tag name editing: click tag name to show input, save via PUT `/api/tags/:id`
    - Add delete button with confirmation dialog, sends DELETE `/api/tags/:id`
    - Ensure AUTHOR role sees read-only view
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 6.2 Write property test for tags page
    - **Property 1: CRUD form submission produces correct API payload** (tag entity)
    - **Validates: Requirements 7.2, 7.3**

- [x] 7. Enhance Users page with error handling
  - [x] 7.1 Enhance users page with DUPLICATE_EMAIL and HAS_ARTICLES error handling
    - Refactor to use `adminFetch` helper
    - Display specific error messages for `DUPLICATE_EMAIL` and `HAS_ARTICLES` error codes from API
    - Ensure non-ADMIN users see "Admin access required" message
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [x] 7.2 Write property test for users page
    - **Property 1: CRUD form submission produces correct API payload** (user entity)
    - **Property 2: Edit form population matches fetched entity data** (user entity)
    - **Validates: Requirements 8.3, 8.4**

- [x] 8. Enhance Comments page with admin listing endpoint
  - [x] 8.1 Update comments page to use new admin listing endpoint
    - Refactor to use `adminFetch` helper
    - Change fetch URL to `GET /api/comments/admin/all` with status query param
    - Display article title alongside each comment
    - Ensure approve/reject buttons call correct endpoints and update status badge
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 8.2 Write property test for comments page
    - **Property 8: Comment moderation actions produce correct API calls**
    - **Property 6: Status filtering returns only matching items** (comment status)
    - **Validates: Requirements 9.2, 9.3, 9.4**

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement Media page enhancements
  - [x] 10.1 Add detail view and client-side validation to media page
    - Refactor to use `adminFetch` helper for listing (keep raw fetch for multipart upload)
    - Add click-to-view detail modal showing original, thumbnail, medium, and large variant URLs with copy buttons
    - Add client-side file validation: reject files > 10MB or non-image MIME types before upload
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 10.2 Write property test for media validation
    - **Property 12: File upload validation rejects invalid files**
    - **Validates: Requirements 5.3**

- [x] 11. Create Obituaries admin page
  - [x] 11.1 Create obituaries page at `frontend/src/app/admin/obituaries/page.tsx`
    - Implement paginated list view with name, content preview (truncated), published date, image thumbnail via `/api/obituaries/:id/image`
    - Implement create/edit form with name, content textarea, image file upload (sent as multipart), published date picker
    - Implement delete with confirmation dialog
    - Use `adminFetch` helper for all API calls
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 11.2 Write property test for obituaries page
    - **Property 1: CRUD form submission produces correct API payload** (obituary entity)
    - **Property 2: Edit form population matches fetched entity data** (obituary entity)
    - **Validates: Requirements 6.3, 6.4**

- [x] 12. Create Home Layout admin page
  - [x] 12.1 Create home layout page at `frontend/src/app/admin/home-layout/page.tsx`
    - Display predefined sections: Ticker, Hero Section, Topic Cards, Latest News, Obituary Section, Advertisement Sidebar, Archive Sidebar
    - Each section has a toggle switch (visible/hidden) and up/down reorder buttons
    - Load current config from `GET /api/settings` reading `homeLayout` key (JSON)
    - Save config via `PUT /api/settings` with `homeLayout` key containing JSON `{ sections: [...] }`
    - ADMIN only access — show "Admin access required" for other roles
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

  - [x] 12.2 Write property test for home layout configuration
    - **Property 9: Home layout configuration round-trip**
    - **Validates: Requirements 3.2, 3.3**

- [x] 13. Enhance Settings page
  - [x] 13.1 Enhance settings page to use adminFetch and handle social links as JSON
    - Refactor to use `adminFetch` helper
    - Map social link fields (Facebook, Twitter, Instagram) to/from the `socialLinks` JSON object in settings API
    - Display validation errors from API inline
    - Ensure non-ADMIN users see "Admin access required" message
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 13.2 Write property test for settings page
    - **Property 11: Settings round-trip**
    - **Validates: Requirements 4.1, 4.2**

- [x] 14. Enhance Dashboard page
  - [x] 14.1 Enhance dashboard page to use adminFetch with graceful fallback
    - Refactor to use `adminFetch` helper
    - Ensure count cards show Draft/Published/Archived counts with `—` placeholder on API failure
    - Ensure recent articles list shows 5 most recent with status badges and dates
    - Verify quick action links to new article and category management exist
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 14.2 Write property test for dashboard
    - **Property 18: Dashboard shows most recent articles**
    - **Validates: Requirements 10.2**

- [x] 15. Auth integration and final wiring
  - [x] 15.1 Verify auth guard, login, and logout flows
    - Ensure unauthenticated users see login form on all `/admin/*` routes (already implemented in layout)
    - Verify login stores JWT token and user in localStorage
    - Verify logout clears all auth data from localStorage
    - Verify locked account and invalid credentials error messages display correctly
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 15.2 Write property tests for auth flows
    - **Property 14: Logout clears auth state**
    - **Property 15: Auth guard shows login for unauthenticated users**
    - **Property 16: Login stores JWT and user in localStorage**
    - **Validates: Requirements 11.6, 12.1, 12.2**

- [x] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- All frontend pages use `'use client'` directive and communicate with the backend via `adminFetch` helper
- Existing placeholder pages are enhanced in-place, not replaced
