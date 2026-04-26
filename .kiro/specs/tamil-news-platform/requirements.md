# Requirements Document

## Introduction

This document defines the requirements for a modern, high-performance, mobile-responsive Tamil news platform inspired by https://www.oorumuravum.today/. The platform serves Tamil-speaking audiences with a full-featured news website covering politics, sports, local news, world news, and more. It includes a public-facing frontend (Next.js + React + TypeScript), a RESTful backend (Node.js + Express), a MariaDB database, Redis caching, JWT-based authentication, role-based access control, and comprehensive SEO/performance optimizations. Tamil Unicode (UTF-8) support and Tamil localization are first-class concerns throughout the system.

## Glossary

- **Platform**: The complete Tamil news website system, including frontend, backend, database, and caching layers.
- **Frontend**: The Next.js (React + TypeScript + Tailwind CSS) client-side application that renders pages for end users.
- **Backend**: The Node.js + Express.js REST API server that handles data operations, authentication, and business logic.
- **Database**: The MariaDB relational database storing all persistent data (articles, users, categories, tags, comments, media).
- **Cache**: The Redis caching layer used to accelerate frequently accessed data and reduce database load.
- **Article**: A news content item with title, slug, body content, excerpt, featured image, status, and publication date.
- **Category**: A hierarchical classification for articles (e.g., Politics, Sports, Local, World).
- **Tag**: A flat label applied to articles for cross-cutting topic grouping (many-to-many relationship with articles).
- **Author**: A user with the Author role who creates and publishes articles; has a bio, profile image, and social links.
- **Editor**: A user with the Editor role who can review, edit, and publish articles created by Authors.
- **Admin**: A user with the Admin role who has full system access including user management and site configuration.
- **Visitor**: An unauthenticated end user browsing the public-facing news website.
- **CMS**: The admin dashboard and content management interface used by Admin, Editor, and Author roles.
- **Slug**: A URL-friendly identifier derived from an article title, category name, tag name, or author name.
- **ORM**: The Object-Relational Mapping layer (Prisma or Sequelize) used to interact with MariaDB.
- **SSR**: Server-Side Rendering, where Next.js renders pages on the server for each request.
- **SSG**: Static Site Generation, where Next.js pre-renders pages at build time.
- **ISR**: Incremental Static Regeneration, where Next.js revalidates and regenerates static pages on a schedule.
- **JSON-LD**: A structured data format used to embed schema.org metadata in HTML for search engine consumption.
- **JWT**: JSON Web Token, used for stateless authentication of API requests.
- **RBAC**: Role-Based Access Control, restricting system actions based on user roles (Admin, Editor, Author).
- **Tamil_Slug_Generator**: The component responsible for generating URL-safe slugs from Tamil Unicode titles.
- **Article_Parser**: The component that parses rich text article content into structured HTML for rendering.
- **Article_Serializer**: The component that serializes article data into JSON for API responses and feeds.
- **Feed_Generator**: The component that generates RSS and JSON feed outputs from article data.

## Requirements

### Requirement 1: Article Management

**User Story:** As an Author, I want to create, edit, and manage news articles through a rich text editor, so that I can publish Tamil news content efficiently.

#### Acceptance Criteria

1. WHEN an Author submits a new article via the CMS, THE Backend SHALL create the Article record in the Database with status "draft" and return the created Article with its generated slug.
2. WHEN an Author updates an existing Article, THE Backend SHALL persist the changes to the Database and return the updated Article.
3. WHEN an Admin or Editor changes an Article status to "published", THE Backend SHALL set the published_at timestamp and make the Article available on the Frontend.
4. WHEN an Admin or Editor deletes an Article, THE Backend SHALL remove the Article from the Database and invalidate the corresponding Cache entries.
5. THE CMS SHALL provide a rich text editor that supports Tamil Unicode text input, image embedding, and basic formatting (bold, italic, headings, lists, blockquotes, links).
6. WHEN an Article is created or updated, THE Tamil_Slug_Generator SHALL generate a URL-safe slug from the Tamil title using transliteration or encoded Unicode.
7. FOR ALL valid Article objects, parsing the rich text content via the Article_Parser then serializing via the Article_Serializer then parsing again SHALL produce an equivalent Article object (round-trip property).

### Requirement 2: Category and Tag Organization

**User Story:** As an Editor, I want to organize articles into categories and tags, so that Visitors can browse news by topic.

#### Acceptance Criteria

1. THE Backend SHALL support CRUD operations for Categories, each having a name, slug, description, and optional parent Category for hierarchical nesting.
2. THE Backend SHALL support CRUD operations for Tags, each having a name and slug.
3. WHEN an Article is created or updated, THE Backend SHALL associate the Article with exactly one Category and zero or more Tags.
4. WHEN a Visitor navigates to a Category page, THE Frontend SHALL display a paginated list of Articles belonging to that Category, sorted by published_at descending.
5. WHEN a Visitor navigates to a Tag page, THE Frontend SHALL display a paginated list of Articles associated with that Tag, sorted by published_at descending.

### Requirement 3: User Authentication and Role-Based Access Control

**User Story:** As an Admin, I want to manage user accounts with role-based permissions, so that content creation and publishing workflows are secure and controlled.

#### Acceptance Criteria

1. WHEN a user submits valid credentials to the login endpoint, THE Backend SHALL return a JWT access token and a refresh token.
2. WHEN a request includes an expired or invalid JWT, THE Backend SHALL respond with HTTP 401 Unauthorized.
3. THE Backend SHALL enforce RBAC such that Admin users can manage all resources, Editor users can manage Articles and Categories, and Author users can manage only their own Articles.
4. WHEN an Admin creates a new user account, THE Backend SHALL hash the password using bcrypt with a minimum cost factor of 10 before storing the record in the Database.
5. IF a login attempt fails three consecutive times for the same email within 15 minutes, THEN THE Backend SHALL temporarily lock the account for 15 minutes and return an appropriate error message.
6. WHEN a user requests a password reset, THE Backend SHALL generate a time-limited reset token and send a reset link to the registered email address.

### Requirement 4: Public Article Display and Navigation

**User Story:** As a Visitor, I want to browse and read Tamil news articles on a fast, mobile-responsive website, so that I can stay informed.

#### Acceptance Criteria

1. WHEN a Visitor loads the Home Page, THE Frontend SHALL display the latest articles, trending articles, and featured articles in distinct sections.
2. WHEN a Visitor navigates to an Article Detail Page via /news/:slug, THE Frontend SHALL render the full article content using SSR, including the title, author name, published date, category, tags, featured image, and body content.
3. THE Frontend SHALL render all pages as fully mobile-responsive layouts using Tailwind CSS, adapting to screen widths from 320px to 2560px.
4. WHEN a Visitor navigates to the Search Results Page via /search?q=, THE Frontend SHALL display paginated search results matching the query against article titles, content, and tags.
5. WHEN a Visitor navigates to /archive/:year/:month, THE Frontend SHALL display a paginated list of Articles published in the specified year and month.
6. WHEN a Visitor navigates to /author/:slug, THE Frontend SHALL display the Author's profile (name, bio, profile image, social links) and a paginated list of their published Articles.
7. THE Frontend SHALL render static pages (About Us, Contact, Privacy Policy, Terms & Conditions) using SSG.

### Requirement 5: SEO and Structured Data

**User Story:** As a site operator, I want the platform to be fully optimized for search engines, so that Tamil news content ranks well in Google and other search engines.

#### Acceptance Criteria

1. WHEN an Article Detail Page is rendered, THE Frontend SHALL include dynamic meta tags (title, description) derived from the Article's title and excerpt.
2. WHEN an Article Detail Page is rendered, THE Frontend SHALL include Open Graph meta tags (og:title, og:description, og:image, og:url, og:type) and Twitter Card meta tags (twitter:card, twitter:title, twitter:description, twitter:image).
3. WHEN an Article Detail Page is rendered, THE Frontend SHALL embed a JSON-LD script block conforming to the schema.org NewsArticle type, including headline, datePublished, author, publisher, and image properties.
4. THE Frontend SHALL include a canonical URL meta tag on every page to prevent duplicate content indexing.
5. THE Feed_Generator SHALL produce a valid sitemap.xml file listing all published Article URLs, Category URLs, Tag URLs, and Author URLs, regenerated on each build or on a scheduled basis.
6. THE Platform SHALL serve a robots.txt file that allows search engine crawling of public pages and disallows crawling of admin and API routes.
7. THE Feed_Generator SHALL produce a valid RSS 2.0 feed and a valid JSON feed containing the latest published Articles.
8. FOR ALL valid Article lists, generating the RSS feed via the Feed_Generator then parsing the RSS output then extracting article data SHALL produce article metadata equivalent to the original input (round-trip property).

### Requirement 6: Performance and Caching

**User Story:** As a site operator, I want the platform to load quickly and handle high traffic, so that Visitors have a smooth reading experience.

#### Acceptance Criteria

1. THE Frontend SHALL achieve a Lighthouse Performance score of 90 or above on mobile and desktop audits.
2. THE Frontend SHALL achieve a First Contentful Paint time of less than 1.5 seconds on a simulated 4G connection.
3. WHEN an Article is published or updated, THE Cache SHALL be invalidated for the affected Article page, the Home Page, and the relevant Category page within 60 seconds.
4. THE Backend SHALL use Redis to cache API responses for public endpoints (articles list, article detail, categories, tags) with a configurable TTL (default 300 seconds).
5. THE Frontend SHALL use Next.js ISR for Article Detail Pages with a revalidation interval of 60 seconds.
6. THE Frontend SHALL optimize images using Next.js Image component with automatic format conversion (WebP/AVIF), responsive sizing, and lazy loading.
7. THE Frontend SHALL use SSG for static pages (About Us, Contact, Privacy Policy, Terms & Conditions) and SSR for dynamic pages (Home, Search Results).

### Requirement 7: Tamil Localization and Unicode Support

**User Story:** As a Tamil-speaking Visitor, I want the entire website to render Tamil content correctly and beautifully, so that I can read news in my native language without display issues.

#### Acceptance Criteria

1. THE Platform SHALL store all text content in UTF-8 encoding in the Database, ensuring full Tamil Unicode support (Unicode block U+0B80–U+0BFF).
2. THE Frontend SHALL use Tamil-friendly web fonts (e.g., Noto Sans Tamil, Mukta Malar) loaded via font-display: swap to prevent invisible text during font loading.
3. THE Frontend SHALL set the HTML lang attribute to "ta" (Tamil) on all public-facing pages.
4. WHEN the Tamil_Slug_Generator receives a Tamil title, THE Tamil_Slug_Generator SHALL produce a URL-safe slug by transliterating Tamil characters to Latin equivalents or using percent-encoded Unicode, ensuring the slug is unique within the Database.
5. THE Frontend SHALL set the text direction to LTR (left-to-right) for Tamil content, as Tamil script is an LTR language.
6. WHEN a Visitor performs a search with Tamil keywords, THE Backend SHALL match the query against Tamil text content using Unicode-aware collation in the Database.
7. FOR ALL valid Tamil titles, generating a slug via the Tamil_Slug_Generator then reconstructing the display title from the slug SHALL produce a title equivalent to the original input (round-trip property for slug generation).

### Requirement 8: API Design and Data Access

**User Story:** As a frontend developer, I want a well-structured REST API with pagination, filtering, and proper error handling, so that I can build the frontend efficiently.

#### Acceptance Criteria

1. THE Backend SHALL expose public GET endpoints: /api/articles (paginated, filterable by category, tag, author, date range), /api/articles/:slug, /api/categories, /api/tags, /api/authors, and /api/authors/:slug.
2. THE Backend SHALL expose authenticated endpoints: POST /api/articles, PUT /api/articles/:id, DELETE /api/articles/:id, with RBAC enforcement.
3. WHEN a paginated endpoint is called, THE Backend SHALL return a response containing the data array, total count, current page, page size, and total pages.
4. THE Backend SHALL apply rate limiting of 100 requests per minute per IP address on public endpoints and 30 requests per minute per authenticated user on admin endpoints.
5. IF a request contains invalid parameters or malformed JSON, THEN THE Backend SHALL return HTTP 400 with a structured error response containing an error code and human-readable message.
6. THE Article_Serializer SHALL serialize Article objects into JSON conforming to a documented schema, including all relationships (author, category, tags).
7. FOR ALL valid Article objects, serializing via the Article_Serializer then deserializing the JSON output SHALL produce an Article object equivalent to the original (round-trip property).

### Requirement 9: Media Management

**User Story:** As an Author, I want to upload and manage images for my articles, so that news stories include visual content.

#### Acceptance Criteria

1. WHEN an Author uploads an image via the CMS, THE Backend SHALL validate the file type (JPEG, PNG, WebP, AVIF), enforce a maximum file size of 10MB, and store the image with a unique filename.
2. THE Backend SHALL generate multiple image sizes (thumbnail: 150px, medium: 600px, large: 1200px) from each uploaded image for responsive delivery.
3. WHEN an image is associated with an Article, THE Backend SHALL store the media record in the Database with references to all generated sizes and the original.
4. THE Frontend SHALL serve images with appropriate srcset and sizes attributes for responsive loading.
5. IF an uploaded file exceeds the maximum size or is an unsupported type, THEN THE Backend SHALL reject the upload with HTTP 400 and a descriptive error message.

### Requirement 10: Comments System

**User Story:** As a Visitor, I want to comment on news articles, so that I can engage with the content and other readers.

#### Acceptance Criteria

1. WHEN a Visitor submits a comment on an Article, THE Backend SHALL store the comment with the commenter's display name, email (not publicly displayed), comment text, and timestamp.
2. WHILE a comment is in "pending" status, THE Frontend SHALL not display the comment to other Visitors.
3. WHEN an Editor or Admin approves a comment, THE Backend SHALL update the comment status to "approved" and make the comment visible on the Article Detail Page.
4. IF a comment contains prohibited content (detected via basic keyword filtering), THEN THE Backend SHALL flag the comment for manual review and set its status to "flagged".
5. THE Frontend SHALL display approved comments on the Article Detail Page in chronological order with pagination (20 comments per page).

### Requirement 11: Content Ingestion Pipeline

**User Story:** As an Admin, I want to ingest news content from external sources alongside manual CMS input, so that the platform can aggregate content efficiently.

#### Acceptance Criteria

1. THE Backend SHALL provide a content ingestion endpoint that accepts structured article data (title, content, source URL, category, tags) and creates Article records in the Database.
2. WHEN content is ingested from an external source, THE Backend SHALL validate all required fields and reject incomplete submissions with HTTP 400 and a descriptive error.
3. WHEN content is ingested, THE Backend SHALL check for duplicate articles by comparing the source URL and title against existing records, and reject duplicates with an appropriate error.
4. THE Backend SHALL log all ingestion operations (success and failure) with timestamps and source identifiers for audit purposes.

### Requirement 12: Search Functionality

**User Story:** As a Visitor, I want to search for news articles using Tamil keywords, so that I can find specific content quickly.

#### Acceptance Criteria

1. WHEN a Visitor submits a search query, THE Backend SHALL search across Article titles, content, tags, and category names using Unicode-aware full-text search.
2. THE Backend SHALL return search results sorted by relevance score, with pagination support (default 10 results per page).
3. WHEN the search query is empty or contains only whitespace, THE Backend SHALL return HTTP 400 with an error message indicating a valid query is required.
4. THE Backend SHALL support search indexing that updates within 120 seconds of an Article being published or updated.

### Requirement 13: Admin Dashboard

**User Story:** As an Admin, I want a dashboard to manage articles, users, categories, and site settings, so that I can operate the platform effectively.

#### Acceptance Criteria

1. WHEN an Admin logs into the CMS, THE Frontend SHALL display a dashboard showing article counts by status (draft, published, archived), recent activity, and quick action links.
2. THE CMS SHALL provide a paginated, filterable, and sortable list view for managing Articles, Users, Categories, Tags, Comments, and Media.
3. WHEN an Admin updates site settings (site title, description, social links, analytics ID), THE Backend SHALL persist the settings and the Frontend SHALL reflect the changes on the next page load or revalidation.
4. THE CMS SHALL be accessible only to authenticated users with Admin, Editor, or Author roles, with UI elements shown or hidden based on the user's RBAC permissions.

### Requirement 14: Breaking News and Notifications

**User Story:** As a Visitor, I want to see breaking news prominently, so that I am immediately aware of urgent developments.

#### Acceptance Criteria

1. WHEN an Article is marked as "breaking", THE Frontend SHALL display a breaking news ticker at the top of all public pages showing the Article headline and link.
2. WHILE an Article has "breaking" status, THE Frontend SHALL highlight the Article in the Home Page featured section with a visual "Breaking" badge.
3. WHEN the breaking status is removed from an Article, THE Frontend SHALL remove the ticker entry and badge within 60 seconds (via ISR revalidation or cache invalidation).

### Requirement 15: Database Schema and Data Integrity

**User Story:** As a developer, I want a well-structured database schema with proper constraints and relationships, so that data integrity is maintained.

#### Acceptance Criteria

1. THE Database SHALL enforce referential integrity via foreign key constraints for all relationships: Article-to-Author, Article-to-Category, Article-to-Tag (via junction table), Comment-to-Article, and Media-to-Article.
2. THE Database SHALL enforce unique constraints on: User email, Article slug, Category slug, Tag slug, and Author slug.
3. THE Database SHALL use UTF-8 (utf8mb4) character set and utf8mb4_unicode_ci collation for all text columns to support full Tamil Unicode.
4. THE ORM SHALL define migration files for all schema changes, enabling reproducible database setup via a single migration command.
5. WHEN a Category is deleted, THE Database SHALL prevent deletion if Articles are associated with the Category (restrict on delete).
