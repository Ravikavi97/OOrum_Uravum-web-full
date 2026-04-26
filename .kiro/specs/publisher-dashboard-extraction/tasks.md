# Tasks

## Task 1: Scaffold the publisher-dashboard project

- [x] 1.1 Create `publisher-dashboard/package.json` with name, scripts (dev, build, start, lint), dependencies (next, react, react-dom, @tailwindcss/typography), and dev dependencies (vitest, fast-check, @vitejs/plugin-react, @tailwindcss/postcss, tailwindcss, typescript, @types/node, @types/react, @types/react-dom, eslint, eslint-config-next)
- [x] 1.2 Create `publisher-dashboard/tsconfig.json` with `@/*` path alias mapped to `./src/*`, matching frontend config
- [x] 1.3 Create `publisher-dashboard/next.config.ts` with `output: 'standalone'` and image remote patterns for localhost:4000
- [x] 1.4 Create `publisher-dashboard/vitest.config.ts` with `@` path alias and `src/**/*.property.test.ts` glob
- [x] 1.5 Create `publisher-dashboard/postcss.config.mjs` with `@tailwindcss/postcss` plugin
- [x] 1.6 Create `publisher-dashboard/.env.example` with `NEXT_PUBLIC_API_URL=http://localhost:4000/api`
- [x] 1.7 Create `publisher-dashboard/Dockerfile` matching frontend Dockerfile pattern (node:22-slim, port 3000, standalone)

## Task 2: Migrate shared modules (auth context and API helper)

- [x] 2.1 Copy `frontend/src/contexts/AuthContext.tsx` to `publisher-dashboard/src/contexts/AuthContext.tsx` (no changes needed)
- [x] 2.2 Copy `frontend/src/app/admin/_lib/api.ts` to `publisher-dashboard/src/lib/api.ts` (no changes needed)
- [x] 2.3 Create `publisher-dashboard/src/app/globals.css` with Tailwind imports and admin-relevant CSS custom properties

## Task 3: Migrate the admin layout as root layout

- [x] 3.1 Create `publisher-dashboard/src/app/layout.tsx` based on `frontend/src/app/admin/layout.tsx`: add `<html>` and `<body>` tags, import `globals.css`, set HTML metadata, update all NAV_ITEMS hrefs to drop `/admin` prefix, update active link detection for `/` instead of `/admin`

## Task 4: Migrate admin page components

- [x] 4.1 Copy `frontend/src/app/admin/page.tsx` to `publisher-dashboard/src/app/page.tsx`, update import from `./_lib/api` to `@/lib/api`, update internal links from `/admin/articles` to `/articles` and `/admin/categories` to `/categories`
- [x] 4.2 Copy `frontend/src/app/admin/articles/page.tsx` to `publisher-dashboard/src/app/articles/page.tsx`, update import from `../_lib/api` to `@/lib/api`
- [x] 4.3 Copy `frontend/src/app/admin/categories/page.tsx` to `publisher-dashboard/src/app/categories/page.tsx`, update import from `../_lib/api` to `@/lib/api`
- [x] 4.4 Copy `frontend/src/app/admin/tags/page.tsx` to `publisher-dashboard/src/app/tags/page.tsx`, update import from `../_lib/api` to `@/lib/api`
- [x] 4.5 Copy `frontend/src/app/admin/users/page.tsx` to `publisher-dashboard/src/app/users/page.tsx`, update import from `../_lib/api` to `@/lib/api`
- [x] 4.6 Copy `frontend/src/app/admin/media/page.tsx` to `publisher-dashboard/src/app/media/page.tsx`, update import from `../_lib/api` to `@/lib/api`
- [x] 4.7 Copy `frontend/src/app/admin/comments/page.tsx` to `publisher-dashboard/src/app/comments/page.tsx`, update import from `../_lib/api` to `@/lib/api`
- [x] 4.8 Copy `frontend/src/app/admin/obituaries/page.tsx` to `publisher-dashboard/src/app/obituaries/page.tsx`, update import from `../_lib/api` to `@/lib/api`
- [x] 4.9 Copy `frontend/src/app/admin/home-layout/page.tsx` to `publisher-dashboard/src/app/home-layout/page.tsx`, update import from `../_lib/api` to `@/lib/api`
- [x] 4.10 Copy `frontend/src/app/admin/settings/page.tsx` to `publisher-dashboard/src/app/settings/page.tsx`, update import from `../_lib/api` to `@/lib/api`

## Task 5: Migrate property tests

- [x] 5.1 Copy `frontend/src/contexts/AuthContext.property.test.ts` to `publisher-dashboard/src/contexts/AuthContext.property.test.ts` (no import changes needed)
- [x] 5.2 Copy `frontend/src/app/admin/_lib/api.property.test.ts` to `publisher-dashboard/src/lib/api.property.test.ts`, update import from `./api` to `./api`
- [x] 5.3 Copy `frontend/src/app/admin/layout.property.test.ts` to `publisher-dashboard/src/app/layout.property.test.ts`, update NAV_ITEMS hrefs to drop `/admin` prefix, update active link test paths
- [x] 5.4 Copy `frontend/src/app/admin/page.property.test.ts` to `publisher-dashboard/src/app/page.property.test.ts` (no import changes needed — uses inline types)
- [x] 5.5 Copy `frontend/src/app/admin/articles/page.property.test.ts` to `publisher-dashboard/src/app/articles/page.property.test.ts` (no import changes needed)
- [x] 5.6 Copy `frontend/src/app/admin/categories/page.property.test.ts` to `publisher-dashboard/src/app/categories/page.property.test.ts` (no import changes needed)
- [x] 5.7 Copy `frontend/src/app/admin/tags/page.property.test.ts` to `publisher-dashboard/src/app/tags/page.property.test.ts` (no import changes needed)
- [x] 5.8 Copy `frontend/src/app/admin/users/page.property.test.ts` to `publisher-dashboard/src/app/users/page.property.test.ts` (no import changes needed)
- [x] 5.9 Copy `frontend/src/app/admin/media/page.property.test.ts` to `publisher-dashboard/src/app/media/page.property.test.ts`, update import from `./page` to `./page`
- [x] 5.10 Copy `frontend/src/app/admin/comments/page.property.test.ts` to `publisher-dashboard/src/app/comments/page.property.test.ts` (no import changes needed)
- [x] 5.11 Copy `frontend/src/app/admin/obituaries/page.property.test.ts` to `publisher-dashboard/src/app/obituaries/page.property.test.ts` (no import changes needed)
- [x] 5.12 Copy `frontend/src/app/admin/home-layout/page.property.test.ts` to `publisher-dashboard/src/app/home-layout/page.property.test.ts` (no import changes needed)
- [x] 5.13 Copy `frontend/src/app/admin/settings/page.property.test.ts` to `publisher-dashboard/src/app/settings/page.property.test.ts` (no import changes needed)

## Task 6: Update docker-compose.yml

- [x] 6.1 Add `publisher-dashboard` service to `docker-compose.yml` with port 3001:3000, INTERNAL_API_URL, depends_on backend, and volume mounts for standalone build
- [x] 6.2 Update backend `CORS_ORIGIN` environment variable to include `http://localhost:3001`

## Task 7: Clean up source project

- [x] 7.1 Delete `frontend/src/app/admin/` directory entirely
- [x] 7.2 Delete `frontend/src/contexts/AuthContext.tsx`
- [x] 7.3 Delete `frontend/src/contexts/AuthContext.property.test.ts`
