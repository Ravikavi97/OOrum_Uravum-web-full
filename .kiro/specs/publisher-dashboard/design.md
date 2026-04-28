# Design Document: Publisher Dashboard

## Overview

The Publisher Dashboard transforms the existing placeholder `/admin/*` pages into a fully functional CMS for the OORUM URAVUM Tamil news platform. It is a frontend-only feature — all admin pages are Next.js client components (`'use client'`) that communicate with the existing Express.js backend API at `http://localhost:4000/api/*`.

The dashboard provides 10 management interfaces (Articles, Categories, Home Layout, Settings, Media, Obituaries, Tags, Users, Comments, Dashboard Overview) wrapped in a role-gated sidebar layout. The existing `AuthContext` handles JWT authentication, and the existing admin layout provides the sidebar shell. Each admin page is a self-contained client component that fetches data from and mutates data through the backend REST API using `fetch` with Bearer token authorization.

No new backend routes or database schema changes are required. The backend already exposes all necessary CRUD endpoints. The work is entirely in the Next.js frontend under `frontend/src/app/admin/`.

## Architecture

```mermaid
graph TB
    subgraph "Next.js Frontend (Port 3000)"
        AL[Admin Layout<br/>Sidebar + Auth Guard]
        subgraph "Admin Pages (Client Components)"
            DP[Dashboard Page]
            AP[Articles Page]
            CP[Categories Page]
            TP[Tags Page]
            UP[Users Page]
            MP[Media Page]
            CM[Comments Page]
            OP[Obituaries Page]
            HL[Home Layout Page]
            SP[Settings Page]
        end
        AC[AuthContext<br/>JWT + Role State]
    end

    subgraph "Express.js Backend (Port 4000)"
        AR[/api/articles]
        CR[/api/categories]
        TR[/api/tags]
        UR[/api/users]
        MR[/api/media]
        CMR[/api/comments]
        OR[/api/obituaries]
        SR[/api/settings]
        AUR[/api/auth]
    end

    subgraph "MariaDB"
        DB[(Database<br/>Prisma ORM)]
    end

    AL --> AC
    AL --> DP & AP & CP & TP & UP & MP & CM & OP & HL & SP

    DP -->|GET| AR
    AP -->|CRUD| AR
    AP -->|GET| CR & TR & MR
    CP -->|CRUD| CR
    TP -->|CRUD| TR
    UP -->|CRUD| UR
    MP -->|POST upload, GET list| MR
    CM -->|GET, PUT approve/reject| CMR
    OP -->|CRUD| OR
    HL -->|GET/PUT| SR
    SP -->|GET/PUT| SR
    AC -->|POST login| AUR

    AR & CR & TR & UR & MR & CMR & OR & SR --> DB
```

### Key Architectural Decisions

1. **Client-only admin pages**: All admin pages use `'use client'` directive. They need auth state from `AuthContext` and interactive UI (forms, modals, dropdowns). No SSR for admin routes.

2. **Direct fetch to backend**: Each page uses `fetch()` with the JWT token from `useAuth()` rather than going through the `services/api.ts` module (which is designed for SSR with `next: { revalidate }` options). Admin pages need mutable, non-cached requests.

3. **No new backend routes**: The existing API already supports all required operations. The tags route needs PUT and DELETE endpoints added. The obituaries route needs POST, PUT, and DELETE endpoints added. The comments route needs a GET endpoint for listing all comments (not just per-article).

4. **Home Layout via SiteSettings**: Section visibility and ordering are stored as JSON in the `site_settings` table using keys like `homeLayout` via the existing `/api/settings` PUT endpoint.

5. **Role gating in sidebar**: The existing admin layout already filters nav items by role. We extend the `NAV_ITEMS` array to include Obituaries and Home Layout entries with appropriate role restrictions.

## Components and Interfaces

### 1. Admin Layout (Enhanced)

**File**: `frontend/src/app/admin/layout.tsx`

Extends the existing layout to add nav items for Obituaries and Home Layout:

```typescript
// Additional NAV_ITEMS entries
{ label: 'Obituaries', href: '/admin/obituaries', icon: '🕯️' },
{ label: 'Home Layout', href: '/admin/home-layout', icon: '🏠', roles: ['ADMIN'] },
```

### 2. Shared Admin Fetch Helper

**File**: `frontend/src/app/admin/_lib/api.ts`

A thin wrapper for authenticated admin API calls:

```typescript
interface AdminFetchOptions extends RequestInit {
  token: string;
}

async function adminFetch<T>(path: string, options: AdminFetchOptions): Promise<T>;
```

- Prepends `API_URL` to path
- Sets `Authorization: Bearer ${token}` header
- Parses JSON response, throws on non-OK status with error body

### 3. Articles Page

**File**: `frontend/src/app/admin/articles/page.tsx`

- **List view**: Paginated table with columns: title, author, category, status badge, updated date. Status filter tabs (All, Draft, Published, Archived). "New Article" button.
- **Form view**: Modal or inline form with: title input, rich text content (textarea for MVP), excerpt, category dropdown (fetched from `/api/categories`), tags multi-select (fetched from `/api/tags`), featured image selector (media ID input or picker), breaking news toggle, status dropdown.
- **Inline status change**: Dropdown on each row to change status via PUT.
- **RBAC**: AUTHORS see only their own articles (filtered by `author` query param using their user slug).

### 4. Categories Page

**File**: `frontend/src/app/admin/categories/page.tsx`

- **Table view**: Name, slug, description, parent category name, article count.
- **Form**: Name, description, parent category dropdown.
- **Delete**: Confirmation dialog. Shows error if `HAS_ARTICLES` response.
- **RBAC**: AUTHORS see read-only view (no create/edit/delete buttons).

### 5. Home Layout Page

**File**: `frontend/src/app/admin/home-layout/page.tsx`

- **Section list**: Predefined sections (Ticker, Hero, Topic Cards, Latest News, Obituary, Ad Sidebar, Archive Sidebar) with toggle switches and up/down reorder buttons.
- **Persistence**: Reads/writes a `homeLayout` key in site settings as JSON: `{ sections: [{ id: string, label: string, visible: boolean, order: number }] }`.
- **RBAC**: ADMIN only (hidden from sidebar for other roles).

### 6. Settings Page

**File**: `frontend/src/app/admin/settings/page.tsx`

- **Form**: Site title, site description, Facebook URL, Twitter URL, Instagram URL, analytics ID.
- **Load**: GET `/api/settings` (admin-authenticated).
- **Save**: PUT `/api/settings` with form data.
- **RBAC**: ADMIN only. Non-admins see "Admin access required" message.

### 7. Media Page

**File**: `frontend/src/app/admin/media/page.tsx`

- **Grid view**: Responsive image grid showing thumbnails, filename, file size.
- **Upload**: File input + upload button. Sends multipart POST to `/api/media/upload`.
- **Detail view**: Click image to see original/thumbnail/medium/large URLs for copying.
- **Validation**: Client-side check for 10MB limit and image MIME types before upload.

### 8. Obituaries Page

**File**: `frontend/src/app/admin/obituaries/page.tsx`

- **List view**: Paginated table with name, content preview, published date, image thumbnail (via `/api/obituaries/:id/image`).
- **Form**: Name, content textarea, image upload (converted to bytes), published date picker.
- **CRUD**: POST/PUT/DELETE to `/api/obituaries`.

### 9. Tags Page

**File**: `frontend/src/app/admin/tags/page.tsx`

- **Table view**: Name, slug columns.
- **Inline edit**: Click tag name to edit inline, saves via PUT.
- **Create**: "New Tag" button with name input.
- **Delete**: Confirmation dialog before DELETE.
- **RBAC**: AUTHORS see read-only view.

### 10. Users Page

**File**: `frontend/src/app/admin/users/page.tsx`

- **List view**: Paginated table with name, email, role badge, creation date.
- **Form**: Name, email, password (required on create, optional on edit), role dropdown.
- **Delete**: Confirmation dialog. Shows error if `HAS_ARTICLES` or `DUPLICATE_EMAIL`.
- **RBAC**: ADMIN only.

### 11. Comments Page

**File**: `frontend/src/app/admin/comments/page.tsx`

- **List view**: Comments with commenter name, email, content, status badge, timestamp.
- **Filters**: Status tabs (Pending, Flagged, All).
- **Actions**: Approve/Reject buttons on each comment row.
- **RBAC**: ADMIN and EDITOR only.

### 12. Dashboard Page (Enhanced)

**File**: `frontend/src/app/admin/page.tsx`

Already partially implemented. Enhancements:
- Ensure count cards show Draft/Published/Archived counts.
- Show 5 most recent articles with status badges.
- Quick action links to new article and category management.
- Graceful fallback when API is unreachable.

## Data Models

No new database models are required. All data models already exist in the Prisma schema:

### Existing Models Used

| Model | Admin Page | Operations |
|-------|-----------|------------|
| `Article` | Articles | CRUD, status change, filter by status/author |
| `Category` | Categories | CRUD, hierarchical parent-child |
| `Tag` | Tags | CRUD |
| `User` | Users | CRUD, role assignment |
| `Comment` | Comments | Read, approve, reject |
| `Media` | Media | Upload, list, detail view |
| `Obituary` | Obituaries | CRUD with image bytes |
| `SiteSetting` | Settings, Home Layout | Read/write key-value pairs |

### Home Layout Data Shape (stored in SiteSetting)

```typescript
interface HomeLayoutConfig {
  sections: Array<{
    id: string;       // e.g. 'ticker', 'hero', 'topicCards', 'latestNews', 'obituary', 'adSidebar', 'archiveSidebar'
    label: string;    // Display name
    visible: boolean; // Toggle on/off
    order: number;    // Sort order
  }>;
}
```

Stored as JSON string under `SiteSetting.key = 'homeLayout'`.

### API Request/Response Shapes

All API shapes are already defined by the backend. Key patterns:

- **Paginated list**: `{ data: T[], total: number, page: number, pageSize: number, totalPages: number }`
- **Error response**: `{ error: { code: string, message: string, details?: Record<string, string[]> } }`
- **Article**: Includes nested `author`, `category`, `tags` (flattened from junction table)
- **Category**: Includes `_count.articles`, `parent`, `children`
- **Media upload**: Multipart form data with `file` field, returns Media record with URLs

### Backend Endpoints Requiring Extension

The following existing routes need additional endpoints:

1. **Tags** (`backend/src/routes/tags.ts`): Add `PUT /:id` and `DELETE /:id`
2. **Obituaries** (`backend/src/routes/obituaries.ts`): Add `POST /`, `PUT /:id`, `DELETE /:id` with image upload support
3. **Comments** (`backend/src/routes/comments.ts`): Add `GET /admin/all` for listing all comments with status filter (current GET is per-article only)


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: CRUD form submission produces correct API payload

*For any* entity type (article, category, tag, user, obituary) and *for any* valid form data for that entity, submitting the create form should produce a POST request to the correct endpoint with a payload whose keys and value types match the entity's schema.

**Validates: Requirements 1.3, 2.3, 6.3, 7.2, 8.3**

### Property 2: Edit form population matches fetched entity data

*For any* entity (article, category, tag, user, obituary) fetched from the API, populating the edit form and reading back the form values should produce data equivalent to the original entity's editable fields.

**Validates: Requirements 1.4, 2.4, 6.4, 7.3, 8.4**

### Property 3: Role-based navigation visibility

*For any* user role (ADMIN, EDITOR, AUTHOR), the set of visible sidebar navigation items should exactly match the permitted items for that role: ADMIN sees all 10 items, EDITOR sees all except Users/Settings/Home Layout, AUTHOR sees all except Users/Comments/Settings/Home Layout.

**Validates: Requirements 2.7, 3.5, 7.5, 8.8, 9.5, 11.3, 11.4, 12.6**

### Property 4: AUTHOR role article editing restriction

*For any* user with the AUTHOR role and *for any* list of articles, the edit action should only be available on articles where the article's `authorId` matches the logged-in user's ID.

**Validates: Requirements 1.8**

### Property 5: API error responses are displayed to the user

*For any* API error response with an `error.message` field, the admin fetch helper should throw an error containing that message, enabling the UI to display it.

**Validates: Requirements 1.7, 4.3**

### Property 6: Status filtering returns only matching items

*For any* status filter value (DRAFT, PUBLISHED, ARCHIVED for articles; PENDING, FLAGGED for comments) and *for any* set of items, applying the filter should return only items whose status matches the selected filter.

**Validates: Requirements 1.6, 9.4**

### Property 7: Inline status change produces correct PUT request

*For any* article and *for any* valid status value (DRAFT, PUBLISHED, ARCHIVED), changing the status via the inline dropdown should produce a PUT request to `/api/articles/:id` with `{ status: selectedStatus }` in the body.

**Validates: Requirements 1.5**

### Property 8: Comment moderation actions produce correct API calls

*For any* comment with PENDING or FLAGGED status, clicking Approve should produce a PUT to `/api/comments/:id/approve` and clicking Reject should produce a PUT to `/api/comments/:id/reject`, and the resulting comment status should update accordingly.

**Validates: Requirements 9.2, 9.3**

### Property 9: Home layout configuration round-trip

*For any* home layout configuration (any combination of section visibilities and any permutation of section ordering), saving the configuration via PUT to `/api/settings` and then reading it back via GET should produce an equivalent configuration.

**Validates: Requirements 3.2, 3.3**

### Property 10: Home page renders sections per layout config

*For any* home layout configuration, the public home page should render only sections marked as `visible: true` and in the order specified by the `order` field.

**Validates: Requirements 3.4**

### Property 11: Settings round-trip

*For any* valid settings object (site title, description, social links, analytics ID), saving via PUT `/api/settings` and then fetching via GET `/api/settings` should return values equivalent to what was saved.

**Validates: Requirements 4.1, 4.2**

### Property 12: File upload validation rejects invalid files

*For any* file with size exceeding 10MB or with a MIME type not in [image/jpeg, image/png, image/webp, image/avif], the client-side validation should reject the upload before sending the request.

**Validates: Requirements 5.3**

### Property 13: Active nav link matches current path

*For any* admin page path, the sidebar navigation should highlight exactly one nav item — the one whose `href` matches the current pathname (exact match for `/admin`, prefix match for all others).

**Validates: Requirements 11.2**

### Property 14: Logout clears auth state

*For any* authenticated session, clicking logout should remove `admin_token`, `admin_user`, and `admin_refresh_token` from localStorage, and the auth context should have `user: null` and `token: null`.

**Validates: Requirements 11.6**

### Property 15: Auth guard shows login for unauthenticated users

*For any* admin route, when no valid token exists in localStorage, the admin layout should render the login form instead of the admin content.

**Validates: Requirements 12.1**

### Property 16: Login stores JWT and user in localStorage

*For any* successful login response containing `accessToken` and `user` fields, the auth context should store the token under `admin_token` and the user JSON under `admin_user` in localStorage.

**Validates: Requirements 12.2**

### Property 17: Bearer token included in all admin API requests

*For any* API call made through the admin fetch helper, the request should include an `Authorization` header with value `Bearer ${token}` where token is the current auth token.

**Validates: Requirements 12.5**

### Property 18: Dashboard shows most recent articles

*For any* set of articles, the dashboard should display at most 5 articles sorted by `updatedAt` descending.

**Validates: Requirements 10.2**

## Error Handling

### API Error Handling Strategy

All admin pages use a shared `adminFetch` helper that standardizes error handling:

1. **Network errors**: Caught by try/catch around `fetch()`. Display "Unable to connect to server" message. Dashboard specifically shows placeholder values (requirement 10.4).

2. **HTTP error responses (4xx/5xx)**: The helper parses the JSON error body `{ error: { code, message, details? } }` and throws an `AdminApiError` with the parsed data. Each page catches this and displays `error.message` to the user.

3. **Specific error codes**:
   - `VALIDATION_ERROR`: Display field-level errors from `details` object next to form fields.
   - `HAS_ARTICLES`: Display message about reassigning articles before deletion (categories, users).
   - `DUPLICATE_EMAIL`: Display "email already in use" message on user form.
   - `ACCOUNT_LOCKED`: Display lockout message on login form.
   - `INVALID_CREDENTIALS`: Display "invalid email or password" on login form.
   - `FILE_TOO_LARGE`: Display file size limit message on media upload.
   - `UPLOAD_ERROR`: Display unsupported format message on media upload.

4. **Auth errors (401/403)**: If a request returns 401, the auth context should clear the token and show the login form. 403 responses display "Access denied" for role-restricted pages.

### Client-Side Validation

- **Article form**: Title and content required. Category required.
- **Category form**: Name required.
- **Tag form**: Name required.
- **User form**: Email (valid format), password (min 8 chars on create), name required.
- **Media upload**: File size ≤ 10MB, MIME type in allowed list.
- **Settings form**: Site title required (min 1 char).

### Graceful Degradation

- Dashboard page renders with placeholder values (`—`) when API calls fail.
- List pages show "Failed to load data" message with retry button.
- Form submissions show inline error messages without losing form state.

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage.

**Unit tests** cover:
- Specific UI rendering examples (e.g., "articles page shows correct columns")
- Integration points (e.g., "delete confirmation dialog appears before API call")
- Edge cases (e.g., "empty article list shows placeholder message")
- Specific error code handling (e.g., "HAS_ARTICLES error shows reassignment message")

**Property-based tests** cover:
- Universal properties that hold across all inputs (Properties 1–18 above)
- Comprehensive input coverage through randomized entity data

### Property-Based Testing Configuration

- **Library**: `fast-check` (already compatible with the project's Vitest setup)
- **Minimum iterations**: 100 per property test
- **Tag format**: Each test tagged with `Feature: publisher-dashboard, Property {N}: {title}`
- **Each correctness property is implemented by a single property-based test**

### Test File Organization

```
frontend/src/app/admin/
  _lib/
    api.test.ts              # Unit + property tests for admin fetch helper (P5, P17)
    adminFetch.property.test.ts  # Property tests for fetch helper
  articles/
    page.test.tsx            # Unit tests for articles page
  ...
backend/src/routes/
  tags.test.ts               # Unit tests for new tag PUT/DELETE endpoints
  obituaries.test.ts         # Unit tests for new obituary CRUD endpoints
  comments.test.ts           # Unit tests for admin comment listing endpoint
```

### Key Test Scenarios

| Property | Test Description | Type |
|----------|-----------------|------|
| P1 | Generate random valid entity data, verify POST payload shape | Property |
| P2 | Generate random entity, populate form, verify field values match | Property |
| P3 | For each role, verify visible nav items match expected set | Property |
| P4 | Generate articles with various authorIds, verify edit availability for AUTHOR | Property |
| P5 | Generate random error responses, verify message extraction | Property |
| P6 | Generate items with mixed statuses, apply filter, verify all results match | Property |
| P7 | Generate random article + status, verify PUT payload | Property |
| P8 | Generate random comments, verify approve/reject endpoint calls | Property |
| P9 | Generate random layout configs, save and read back, verify equivalence | Property |
| P10 | Generate random layout configs, verify rendered sections match visible+ordered | Property |
| P11 | Generate random settings, save and read back, verify equivalence | Property |
| P12 | Generate random files with various sizes/types, verify validation | Property |
| P13 | Generate random admin paths, verify correct nav item highlighted | Property |
| P14 | Verify localStorage cleared after logout | Property |
| P15 | Verify login form shown when no token | Property |
| P16 | Generate random login responses, verify localStorage storage | Property |
| P17 | Generate random API calls, verify Authorization header present | Property |
| P18 | Generate random article sets, verify top 5 by updatedAt shown | Property |
