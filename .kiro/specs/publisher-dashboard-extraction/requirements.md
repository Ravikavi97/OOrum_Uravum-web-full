# Requirements Document

## Introduction

The Publisher Dashboard Extraction separates the admin CMS pages from the public-facing Tamil news frontend (`frontend/`) into a standalone Next.js project (`publisher-dashboard/`) at the workspace root. The existing `frontend/` project currently hosts both the public news site and the admin dashboard under `/admin/*`. This extraction creates a clean architectural boundary: the public site serves readers, and the publisher dashboard serves content managers. Both projects share the same Express.js backend API at port 4000. After extraction, the `frontend/` project retains no admin code, and the `publisher-dashboard/` project contains all admin pages, the auth context, the admin fetch helper, and all associated property-based tests.

## Glossary

- **Source_Project**: The existing Next.js project at `frontend/` containing both public pages and admin pages
- **Target_Project**: The new standalone Next.js project at `publisher-dashboard/` that receives all admin code
- **Admin_Pages**: The 10 admin page components currently at `frontend/src/app/admin/` (Dashboard, Articles, Categories, Tags, Users, Media, Comments, Obituaries, Home Layout, Settings)
- **Admin_Layout**: The admin layout component at `frontend/src/app/admin/layout.tsx` providing sidebar navigation and auth guard
- **Admin_Fetch_Helper**: The authenticated API client at `frontend/src/app/admin/_lib/api.ts`
- **Auth_Context**: The JWT authentication context at `frontend/src/contexts/AuthContext.tsx`
- **Property_Tests**: The fast-check + vitest property-based test files (`*.property.test.ts`) associated with admin pages and auth context
- **Backend_API**: The existing Express.js REST API at port 4000 shared by both projects
- **Docker_Compose**: The root `docker-compose.yml` orchestrating all services

## Requirements

### Requirement 1: Standalone Project Scaffolding

**User Story:** As a developer, I want the publisher dashboard to be a standalone Next.js project with its own configuration, so that it can be developed, built, and deployed independently from the public frontend.

#### Acceptance Criteria

1. THE Target_Project SHALL exist at the workspace root path `publisher-dashboard/` with a valid `package.json` containing project name, scripts (`dev`, `build`, `start`, `lint`), and all required dependencies (next, react, react-dom, tailwindcss, typescript)
2. THE Target_Project SHALL contain a `tsconfig.json` with path alias `@/*` mapped to `./src/*`, matching the Source_Project TypeScript configuration
3. THE Target_Project SHALL contain a `next.config.ts` with `output: 'standalone'` and image remote patterns for the Backend_API at localhost:4000
4. THE Target_Project SHALL contain a `vitest.config.ts` configured to run property tests from `src/**/*.property.test.ts` with the `@` path alias resolved
5. THE Target_Project SHALL contain dev dependencies for testing: `vitest`, `fast-check`, and `@vitejs/plugin-react`
6. THE Target_Project SHALL contain a `postcss.config.mjs` and Tailwind CSS configuration matching the Source_Project styling setup
7. THE Target_Project SHALL contain a `.env.example` file documenting the `NEXT_PUBLIC_API_URL` environment variable

### Requirement 2: Admin Page Migration

**User Story:** As a developer, I want all admin pages moved to the new project with correct routing, so that the publisher dashboard functions identically in its new location.

#### Acceptance Criteria

1. WHEN the Target_Project is created, THE Target_Project SHALL contain all 10 Admin_Pages under `src/app/` with routes matching their original paths minus the `/admin` prefix: Dashboard at `/`, Articles at `/articles`, Categories at `/categories`, Tags at `/tags`, Users at `/users`, Media at `/media`, Comments at `/comments`, Obituaries at `/obituaries`, Home Layout at `/home-layout`, Settings at `/settings`
2. THE Target_Project SHALL contain the Admin_Layout at `src/app/layout.tsx` providing sidebar navigation and auth guard wrapping all pages
3. THE Target_Project SHALL contain the Admin_Fetch_Helper at `src/lib/api.ts` with identical functionality to the Source_Project version
4. THE Target_Project SHALL contain the Auth_Context at `src/contexts/AuthContext.tsx` with identical functionality to the Source_Project version
5. WHEN an Admin_Page imports from `@/contexts/AuthContext`, THE Target_Project import path SHALL resolve correctly via the `@/*` path alias
6. WHEN an Admin_Page imports from `@/lib/api` (previously `../_lib/api`), THE Target_Project import path SHALL resolve correctly via the `@/*` path alias
7. THE Admin_Layout sidebar navigation links SHALL use updated paths without the `/admin` prefix (e.g., `/articles` instead of `/admin/articles`)

### Requirement 3: Property Test Migration

**User Story:** As a developer, I want all property-based tests moved to the new project and passing, so that correctness guarantees are preserved after extraction.

#### Acceptance Criteria

1. THE Target_Project SHALL contain all Property_Tests from the Source_Project admin directory, with import paths updated to match the new project structure
2. THE Target_Project SHALL contain the Auth_Context property test (`AuthContext.property.test.ts`) under `src/contexts/`
3. THE Target_Project SHALL contain the Admin_Fetch_Helper property test (`api.property.test.ts`) under `src/lib/`
4. WHEN the vitest test suite runs in the Target_Project, all Property_Tests SHALL pass without modification to test logic
5. THE Target_Project vitest configuration SHALL include the `src/**/*.property.test.ts` glob pattern for test discovery

### Requirement 4: Source Project Cleanup

**User Story:** As a developer, I want all admin code removed from the public frontend, so that the frontend project contains only public-facing pages.

#### Acceptance Criteria

1. WHEN the extraction is complete, THE Source_Project SHALL have the entire `src/app/admin/` directory removed
2. WHEN the extraction is complete, THE Source_Project SHALL retain the `src/contexts/AuthContext.tsx` file only if other non-admin pages depend on it; IF no non-admin pages import Auth_Context, THEN THE Source_Project SHALL have `src/contexts/AuthContext.tsx` removed
3. WHEN the extraction is complete, THE Source_Project SHALL retain all public-facing pages, components, services, and configurations unchanged
4. WHEN the extraction is complete, THE Source_Project SHALL have the `src/contexts/AuthContext.property.test.ts` file removed

### Requirement 5: Docker Support

**User Story:** As a developer, I want the publisher dashboard to have Docker support and be included in the docker-compose stack, so that the full system can be run with a single command.

#### Acceptance Criteria

1. THE Target_Project SHALL contain a `Dockerfile` that builds the Next.js standalone output for production deployment
2. WHEN the Docker_Compose file is updated, THE Docker_Compose SHALL include a `publisher-dashboard` service running the Target_Project on port 3001
3. THE `publisher-dashboard` Docker_Compose service SHALL depend on the `backend` service
4. THE `publisher-dashboard` Docker_Compose service SHALL set `INTERNAL_API_URL` to `http://backend:4000/api` for server-side API access
5. THE `publisher-dashboard` Docker_Compose service SHALL expose port 3001 mapped to container port 3000
6. WHEN the backend `CORS_ORIGIN` environment variable is updated, THE Docker_Compose SHALL include `http://localhost:3001` in the allowed origins so the publisher dashboard can communicate with the Backend_API

### Requirement 6: Styling and Global Configuration

**User Story:** As a developer, I want the publisher dashboard to have its own Tailwind CSS setup and global styles, so that admin pages render correctly without depending on the public frontend styles.

#### Acceptance Criteria

1. THE Target_Project SHALL contain a `src/app/globals.css` file with Tailwind CSS imports and the admin-relevant CSS custom properties from the Source_Project
2. THE Target_Project SHALL contain a root layout at `src/app/layout.tsx` that imports `globals.css` and sets the HTML metadata for the publisher dashboard
3. WHEN an Admin_Page uses Tailwind utility classes, THE Target_Project Tailwind configuration SHALL resolve all utility classes used by the Admin_Pages

### Requirement 7: Import Path Consistency

**User Story:** As a developer, I want all import paths in the migrated code to be correct and consistent, so that the project compiles without errors.

#### Acceptance Criteria

1. WHEN Admin_Pages previously imported the Admin_Fetch_Helper via relative path `../_lib/api` or `./_lib/api`, THE Target_Project SHALL update the import to `@/lib/api`
2. WHEN Admin_Pages previously imported the Auth_Context via `@/contexts/AuthContext`, THE Target_Project SHALL retain the same import path since the path alias resolves identically
3. WHEN the Admin_Layout previously referenced `/admin/*` paths in navigation links, THE Target_Project SHALL update the paths to `/*` (root-relative within the new project)
4. THE Target_Project SHALL compile without TypeScript errors when running `npx tsc --noEmit`
