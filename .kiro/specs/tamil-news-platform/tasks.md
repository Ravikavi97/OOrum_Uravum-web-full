# Implementation Plan: Tamil News Platform

## Overview

A Tamil news platform with a separate Next.js frontend (`/frontend`) and Express.js backend (`/backend`), using MariaDB via Prisma ORM, Redis for caching, and local filesystem for media storage. Implementation is organized into 4 phases: core backend + basic frontend, categories/search/author pages, SEO + performance, and admin dashboard + editor tools.

## Tasks

### Phase 1: Core Backend + Database, Basic Frontend

- [x] 1. Initialize project structure and shared configuration
  - [x] 1.1 Create `/backend` directory with Express.js + TypeScript project setup (package.json, tsconfig.json, nodemon config)
    - Install dependencies: express, cors, helmet, dotenv, bcrypt, jsonwebtoken, multer, sharp, zod, ioredis, express-rate-limit
    - Create entry point `backend/src/index.ts` with Express app, CORS, JSON body parser, helmet
    - _Requirements: 8.1, 8.4, 8.5_
  - [x] 1.2 Create `/frontend` directory with Next.js + TypeScript + Tailwind CSS project setup
    - Initialize Next.js app with App Router, TypeScript, Tailwind CSS
    - Configure Tamil fonts (Noto Sans Tamil, Mukta Malar) via `next/font/google` with `display: swap`
    - Set root layout with `<html lang="ta" dir="ltr">`
    - _Requirements: 7.2, 7.3, 7.5_
  - [x] 1.3 Create `/prisma/schema.prisma` configured for MariaDB (mysql provider, utf8mb4 charset)
    - Define datasource with `provider = "mysql"` and `DATABASE_URL` env var
    - _Requirements: 15.3, 15.4_

- [x] 2. Define database schema and run initial migration
  - [x] 2.1 Define all Prisma models: User, Article, Category, Tag, ArticleTag, Comment, Media, SiteSetting, IngestionLog
    - Use `@db.Text` for content fields, enforce `utf8mb4` collation
    - Define enums: Role (ADMIN, EDITOR, AUTHOR), ArticleStatus (DRAFT, PUBLISHED, ARCHIVED), CommentStatus (PENDING, APPROVED, FLAGGED, REJECTED)
    - Add foreign key relations: Article→User, Article→Category (onDelete: Restrict), ArticleTag junction, Comment→Article, Media→Article
    - Add unique constraints on User.email, Article.slug, Category.slug, Tag.slug, User.slug, Article.sourceUrl
    - Add indexes on Article(status, publishedAt), Article(authorId), Article(categoryId), Comment(articleId, status)
    - _Requirements: 15.1, 15.2, 15.3, 15.5_
  - [x] 2.2 Generate and run Prisma migration against MariaDB
    - Run `npx prisma migrate dev --name init`
    - Verify all tables created with correct charset and constraints
    - _Requirements: 15.4_

- [x] 3. Implement authentication and RBAC middleware
  - [x] 3.1 Create `backend/src/lib/auth.ts` with JWT sign/verify functions and RBAC middleware
    - Implement `signAccessToken(payload)` returning JWT with 15-min expiry (HS256)
    - Implement `signRefreshToken(payload)` returning JWT with 7-day expiry
    - Implement `verifyToken(token)` returning decoded payload or null
    - Implement `requireAuth` Express middleware that validates JWT from Authorization header, returns 401 on invalid/expired token
    - Implement `requireRole(...roles)` Express middleware that checks user role, returns 403 on insufficient permissions
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 3.2 Create `backend/src/routes/auth.ts` with login, refresh, and password reset endpoints
    - `POST /api/auth/login`: validate credentials, check account lockout (3 failures in 15 min → 15-min lock), hash comparison with bcrypt (cost factor 10+), return access + refresh tokens
    - `POST /api/auth/refresh`: validate refresh token, issue new token pair
    - `POST /api/auth/reset-password`: generate time-limited reset token, log reset request
    - _Requirements: 3.1, 3.4, 3.5, 3.6_
  - [x] 3.3 Write unit tests for auth module
    - Test JWT sign/verify round-trip
    - Test account lockout after 3 failed attempts
    - Test RBAC middleware role enforcement
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [x] 4. Implement Tamil slug generator utility
  - [x] 4.1 Create `backend/src/lib/slug.ts` with Tamil-to-Latin transliteration slug generator
    - Implement `generateTamilSlug(title)` that transliterates Tamil characters (U+0B80–U+0BFF) to Latin equivalents
    - Fallback to percent-encoded Unicode if transliteration produces collisions
    - Implement uniqueness check against DB with suffix counter
    - Implement `isValidSlug(slug)` validation
    - _Requirements: 1.6, 7.4_
  - [x] 4.2 Write property test for Tamil slug generator
    - **Property 1: Slug URL-safety** — For all valid Tamil titles, the generated slug contains only URL-safe characters (a-z, 0-9, hyphens, percent-encoded sequences)
    - **Validates: Requirements 7.4, 1.6**
  - [x] 4.3 Write unit tests for slug generator
    - Test Tamil title transliteration
    - Test collision handling with suffix counter
    - Test empty/whitespace input handling
    - _Requirements: 1.6, 7.4, 7.7_

- [x] 5. Implement Redis caching layer
  - [x] 5.1 Create `backend/src/lib/cache.ts` with Redis cache helpers using ioredis
    - Implement `getCached<T>(key)`, `setCached<T>(key, value, ttl)`, `invalidateByPattern(pattern)`, `invalidateByTags(tags)`
    - Default TTL: 300 seconds for articles, 600 for categories/tags, 60 for breaking news
    - Connect to self-hosted Redis via `REDIS_URL` env var
    - _Requirements: 6.3, 6.4_

- [x] 6. Implement Article CRUD API endpoints
  - [x] 6.1 Create `backend/src/routes/articles.ts` with article endpoints
    - `GET /api/articles` — paginated list, filterable by category, tag, author, date range, status; returns `{ data, total, page, pageSize, totalPages }`
    - `GET /api/articles/:slug` — single article with author, category, tags relations
    - `POST /api/articles` — create article (Author+ role), generate Tamil slug, set status=draft
    - `PUT /api/articles/:id` — update article (Author own articles, Editor+ any), regenerate slug if title changed
    - `DELETE /api/articles/:id` — delete article (Editor+ role), invalidate cache
    - On publish: set `publishedAt` timestamp, invalidate home page + category cache
    - Use Zod for request body validation, return structured error responses on invalid input
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 8.1, 8.2, 8.3, 8.5, 8.6_
  - [x] 6.2 Write property test for Article serialization round-trip
    - **Property 2: Article serialization round-trip** — For all valid Article objects, serializing to JSON then deserializing produces an equivalent Article object
    - **Validates: Requirements 8.7, 1.7**
  - [x] 6.3 Write unit tests for article endpoints
    - Test CRUD operations, pagination response format, RBAC enforcement
    - Test cache invalidation on publish/update/delete
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 8.1, 8.2, 8.3_

- [x] 7. Implement rate limiting middleware
  - [x] 7.1 Create `backend/src/middleware/rateLimiter.ts` using express-rate-limit
    - Public endpoints: 100 requests/minute per IP
    - Authenticated endpoints: 30 requests/minute per user
    - Return HTTP 429 with structured error response on limit exceeded
    - _Requirements: 8.4_

- [x] 8. Build basic frontend — Home Page and Article Detail Page
  - [x] 8.1 Create `frontend/src/services/api.ts` — API client for communicating with Express backend
    - Configure base URL from environment variable `NEXT_PUBLIC_API_URL`
    - Implement typed fetch wrappers for articles, categories, tags, authors endpoints
    - Handle paginated response format
    - _Requirements: 8.1, 8.3_
  - [x] 8.2 Create Home Page (`frontend/src/app/page.tsx`) with SSR
    - Fetch latest articles, trending articles, featured articles from backend API
    - Display in distinct sections with ArticleCard components
    - Display breaking news ticker at top if any articles have `isBreaking=true`
    - Mobile-responsive layout with Tailwind CSS (320px to 2560px)
    - _Requirements: 4.1, 4.3, 14.1, 14.2_
  - [x] 8.3 Create Article Detail Page (`frontend/src/app/news/[slug]/page.tsx`) with ISR (60s revalidation)
    - Render full article: title, author name, published date, category, tags, featured image, body content
    - Mobile-responsive layout
    - _Requirements: 4.2, 6.5_
  - [x] 8.4 Create shared layout components: Header (with navigation, breaking news ticker), Footer
    - Header with site logo, category navigation links, search bar placeholder
    - Breaking news ticker component that fetches breaking articles
    - Footer with site info, links
    - _Requirements: 4.1, 4.3, 14.1_

- [x] 9. Checkpoint — Phase 1 validation
  - Ensure all tests pass, verify backend starts and serves API, frontend renders home and article pages, database migrations applied successfully. Ask the user if questions arise.

### Phase 2: Categories, Tags, Search, Author Pages

- [x] 10. Implement Category and Tag API endpoints
  - [x] 10.1 Create `backend/src/routes/categories.ts` with category CRUD endpoints
    - `GET /api/categories` — list all categories with hierarchy (parent/children)
    - `POST /api/categories` — create category (Editor+ role), generate slug
    - `PUT /api/categories/:id` — update category (Editor+ role)
    - `DELETE /api/categories/:id` — delete category (Admin only), reject if articles associated (Restrict)
    - Cache category list in Redis (TTL 600s), invalidate on changes
    - _Requirements: 2.1, 2.3, 15.5_
  - [x] 10.2 Create `backend/src/routes/tags.ts` with tag CRUD endpoints
    - `GET /api/tags` — list all tags
    - `POST /api/tags` — create tag (Editor+ role), generate slug
    - Cache tag list in Redis (TTL 600s)
    - _Requirements: 2.2_
  - [x] 10.3 Write unit tests for category and tag endpoints
    - Test CRUD operations, hierarchical categories, delete restriction
    - _Requirements: 2.1, 2.2, 15.5_

- [x] 11. Implement search functionality
  - [x] 11.1 Create MariaDB full-text index on articles table for Tamil Unicode-aware search
    - Add FULLTEXT index on (title, excerpt, content) columns with utf8mb4 collation
    - _Requirements: 12.1, 12.4, 7.6_
  - [x] 11.2 Create `backend/src/routes/search.ts` with search endpoint
    - `GET /api/search?q=&page=&pageSize=` — full-text search across article titles, content, tags, category names
    - Return results sorted by relevance, paginated (default 10 per page)
    - Return HTTP 400 for empty/whitespace-only queries
    - Cache search results in Redis (TTL 120s)
    - _Requirements: 12.1, 12.2, 12.3, 7.6_
  - [x] 11.3 Write unit tests for search endpoint
    - Test Tamil keyword search, empty query validation, pagination
    - _Requirements: 12.1, 12.2, 12.3_

- [x] 12. Implement Author API and profile endpoints
  - [x] 12.1 Create `backend/src/routes/authors.ts` with author endpoints
    - `GET /api/authors` — list all authors (users with Author/Editor roles)
    - `GET /api/authors/:slug` — author profile with bio, profile image, social links
    - Cache author data in Redis (TTL 600s)
    - _Requirements: 8.1_

- [x] 13. Build Category, Tag, Author, Search, and Archive frontend pages
  - [x] 13.1 Create Category Page (`frontend/src/app/category/[slug]/page.tsx`) with ISR
    - Display paginated articles for the category, sorted by publishedAt descending
    - _Requirements: 2.4_
  - [x] 13.2 Create Tag Page (`frontend/src/app/tag/[slug]/page.tsx`) with ISR
    - Display paginated articles for the tag, sorted by publishedAt descending
    - _Requirements: 2.5_
  - [x] 13.3 Create Author Page (`frontend/src/app/author/[slug]/page.tsx`) with ISR
    - Display author profile (name, bio, image, social links) and paginated published articles
    - _Requirements: 4.6_
  - [x] 13.4 Create Search Results Page (`frontend/src/app/search/page.tsx`) with SSR
    - Search bar, paginated results from `/api/search`
    - _Requirements: 4.4_
  - [x] 13.5 Create Archive Page (`frontend/src/app/archive/[year]/[month]/page.tsx`) with ISR
    - Paginated articles for the specified year/month
    - _Requirements: 4.5_

- [x] 14. Checkpoint — Phase 2 validation
  - Ensure all tests pass, category/tag/search/author/archive pages render correctly, search works with Tamil keywords. Ask the user if questions arise.

### Phase 3: SEO Optimization + Performance Tuning

- [x] 15. Implement SEO meta tags and structured data
  - [x] 15.1 Add dynamic `generateMetadata()` to Article Detail Page
    - Set title, description from article title/excerpt
    - Add Open Graph tags: og:title, og:description, og:image, og:url, og:type
    - Add Twitter Card tags: twitter:card, twitter:title, twitter:description, twitter:image
    - Add canonical URL meta tag
    - _Requirements: 5.1, 5.2, 5.4_
  - [x] 15.2 Create JSON-LD component for Article Detail Page
    - Embed `schema.org/NewsArticle` structured data: headline, datePublished, author, publisher, image
    - _Requirements: 5.3_
  - [x] 15.3 Add `generateMetadata()` with canonical URLs to all public pages (home, category, tag, author, search, archive)
    - _Requirements: 5.4_

- [x] 16. Implement sitemap, robots.txt, and RSS/JSON feeds
  - [x] 16.1 Create sitemap.xml generation endpoint on backend (`GET /api/sitemap`)
    - List all published article URLs, category URLs, tag URLs, author URLs
    - Create `frontend/src/app/sitemap.ts` that fetches from backend and returns sitemap
    - _Requirements: 5.5_
  - [x] 16.2 Create `frontend/src/app/robots.ts` for robots.txt
    - Allow crawling of public pages, disallow /api/* and /admin/* routes
    - _Requirements: 5.6_
  - [x] 16.3 Create RSS 2.0 feed and JSON feed endpoints
    - `backend/src/routes/feed.ts`: `GET /api/feed/rss` and `GET /api/feed/json`
    - Frontend routes to proxy or link to backend feed endpoints
    - _Requirements: 5.7_
  - [x] 16.4 Write property test for RSS feed round-trip
    - **Property 3: RSS feed round-trip** — For all valid article lists, generating RSS feed then parsing the output produces article metadata equivalent to the original input
    - **Validates: Requirements 5.8**

- [x] 17. Performance optimization
  - [x] 17.1 Configure Next.js Image component for optimized image delivery
    - Use `next/image` with automatic WebP/AVIF format conversion, responsive sizing, lazy loading
    - Configure `remotePatterns` for backend media URLs
    - _Requirements: 6.6_
  - [x] 17.2 Create static pages with SSG: About Us, Contact, Privacy Policy, Terms & Conditions
    - `frontend/src/app/about/page.tsx`, `contact/page.tsx`, `privacy/page.tsx`, `terms/page.tsx`
    - _Requirements: 4.7, 6.7_
  - [x] 17.3 Verify and tune caching — ensure Redis cache invalidation works on article publish/update/delete
    - Invalidate article page, home page, and category page cache within 60 seconds of changes
    - _Requirements: 6.3, 6.4_

- [x] 18. Checkpoint — Phase 3 validation
  - Ensure all tests pass, SEO meta tags render correctly, sitemap/robots.txt/feeds are valid, image optimization works. Ask the user if questions arise.

### Phase 4: Admin Dashboard + Editor Tools

- [x] 19. Implement User management API
  - [x] 19.1 Create `backend/src/routes/users.ts` with user management endpoints
    - `POST /api/users` — create user (Admin only), hash password with bcrypt (cost factor 10+)
    - `GET /api/users` — list users (Admin only), paginated
    - `PUT /api/users/:id` — update user (Admin only)
    - `DELETE /api/users/:id` — delete user (Admin only)
    - _Requirements: 3.3, 3.4_
  - [x] 19.2 Write unit tests for user management
    - Test CRUD, password hashing, RBAC enforcement
    - _Requirements: 3.3, 3.4_

- [x] 20. Implement Comments API
  - [x] 20.1 Create `backend/src/routes/comments.ts` with comment endpoints
    - `POST /api/comments` — submit comment (public), store with status=pending, run keyword filter, flag if prohibited content detected
    - `GET /api/comments/:articleId` — get approved comments for article, paginated (20 per page), chronological order
    - `PUT /api/comments/:id/approve` — approve comment (Editor+ role)
    - `PUT /api/comments/:id/reject` — reject comment (Editor+ role)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  - [x] 20.2 Write unit tests for comments API
    - Test comment submission, keyword filtering, approval flow, pagination
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 21. Implement Media upload API
  - [x] 21.1 Create `backend/src/routes/media.ts` with media upload endpoint
    - `POST /api/media/upload` — accept multipart file upload (Author+ role)
    - Validate file type (JPEG, PNG, WebP, AVIF) and max size (10MB), return HTTP 400 on invalid
    - Generate resized variants using sharp: thumbnail (150px), medium (600px), large (1200px)
    - Store files on local filesystem (configurable path), create Media record in DB with all size URLs
    - _Requirements: 9.1, 9.2, 9.3, 9.5_
  - [x] 21.2 Write unit tests for media upload
    - Test file validation, size limit enforcement, variant generation
    - _Requirements: 9.1, 9.2, 9.5_

- [x] 22. Implement Content Ingestion API
  - [x] 22.1 Create `backend/src/routes/ingest.ts` with content ingestion endpoint
    - `POST /api/ingest` — accept structured article data (Admin only)
    - Validate required fields, reject incomplete with HTTP 400
    - Check for duplicates by sourceUrl and title, reject duplicates
    - Log all ingestion operations (success/failure) with timestamps to IngestionLog table
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
  - [x] 22.2 Write unit tests for content ingestion
    - Test validation, duplicate detection, audit logging
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [x] 23. Implement Site Settings API
  - [x] 23.1 Create `backend/src/routes/settings.ts` with site settings endpoints
    - `GET /api/settings` — get all settings (Admin only)
    - `PUT /api/settings` — update settings (Admin only): site title, description, social links, analytics ID
    - Cache settings in Redis (TTL 3600s), invalidate on update
    - _Requirements: 13.3_

- [x] 24. Build Admin Dashboard frontend
  - [x] 24.1 Create CMS layout and authentication guard (`frontend/src/app/admin/layout.tsx`)
    - Protect all /admin routes — redirect to login if unauthenticated
    - Show/hide UI elements based on user role (Admin, Editor, Author)
    - Sidebar navigation: Dashboard, Articles, Categories, Tags, Users, Media, Comments, Settings
    - _Requirements: 13.4_
  - [x] 24.2 Create Admin Dashboard page (`frontend/src/app/admin/page.tsx`)
    - Display article counts by status (draft, published, archived)
    - Show recent activity feed
    - Quick action links (new article, manage categories)
    - _Requirements: 13.1_
  - [x] 24.3 Create Article Management pages (`frontend/src/app/admin/articles/`)
    - List view: paginated, filterable by status/category/author, sortable
    - Create/Edit form with rich text editor (Tiptap) supporting Tamil Unicode, image embedding, formatting (bold, italic, headings, lists, blockquotes, links)
    - Status management: draft → published → archived
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 13.2_
  - [x] 24.4 Create Category and Tag management pages (`frontend/src/app/admin/categories/`, `frontend/src/app/admin/tags/`)
    - CRUD interfaces with list views
    - _Requirements: 2.1, 2.2, 13.2_
  - [x] 24.5 Create User management page (`frontend/src/app/admin/users/`) — Admin only
    - List, create, edit users with role assignment
    - _Requirements: 3.3, 13.2_
  - [x] 24.6 Create Media Library page (`frontend/src/app/admin/media/`)
    - Grid view of uploaded media, upload new media
    - _Requirements: 9.1, 13.2_
  - [x] 24.7 Create Comment Moderation page (`frontend/src/app/admin/comments/`)
    - List pending/flagged comments, approve/reject actions
    - _Requirements: 10.3, 10.4, 13.2_
  - [x] 24.8 Create Site Settings page (`frontend/src/app/admin/settings/`) — Admin only
    - Form for site title, description, social links, analytics ID
    - _Requirements: 13.3_

- [x] 25. Wire comments display into Article Detail Page
  - [x] 25.1 Add comments section to Article Detail Page
    - Display approved comments with pagination (20 per page), chronological order
    - Comment submission form (display name, email, comment text)
    - _Requirements: 10.1, 10.5_
  - [x] 25.2 Add responsive image srcset/sizes to article images
    - Use media variant URLs for srcset, appropriate sizes attribute
    - _Requirements: 9.4_

- [x] 26. Final checkpoint — Full platform validation
  - Ensure all tests pass, all API endpoints functional, all frontend pages render correctly, admin dashboard operational, Tamil content displays properly throughout. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at each phase boundary
- The backend is a standalone Express.js server (NOT Next.js API routes)
- Database is MariaDB with Prisma ORM (mysql provider, utf8mb4 charset)
- Caching uses self-hosted Redis via ioredis (NOT Vercel KV)
- Media storage uses local filesystem (NOT Vercel Blob)
- No Edge Middleware or Vercel-specific services
