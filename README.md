# OORUM URAVUM — Tamil News Platform

A full-stack Tamil news CMS and public-facing website built with Next.js, Express.js, MariaDB, and Docker.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Compose                           │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ MariaDB  │  │ Backend  │  │   Frontend   │  │ Publisher  │  │
│  │ :3306    │◄─│ :4000    │◄─│   :3000      │  │ Dashboard  │  │
│  │          │  │ Express  │  │   Next.js    │  │ :3001      │  │
│  └──────────┘  └──────────┘  └──────────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

| Service | Port | Description |
|---------|------|-------------|
| MariaDB | 3306 | MySQL-compatible database |
| Backend | 4000 | Express.js REST API |
| Frontend | 3000 | Public-facing Next.js news site |
| Publisher Dashboard | 3001 | Admin CMS for content management |

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS v4, TypeScript
- **Publisher Dashboard (CMS)**: Next.js 16, React 19, Tailwind CSS v4, TypeScript
- **Backend**: Express.js, Prisma ORM, JWT authentication, Sharp (image processing), Multer (file uploads)
- **Database**: MariaDB 11 (MySQL-compatible)
- **Infrastructure**: Docker, Docker Compose

## Features

### Public Frontend (port 3000)
- Homepage with configurable sections (hero slideshow, topic cards, latest news, obituaries, ads)
- Article detail pages with rich HTML content, featured images, comments
- Category pages with article listings
- Tag and author pages
- Search functionality
- Archive sidebar by month/year
- Breaking news ticker
- Responsive design (mobile + desktop)
- SEO: sitemap.xml, robots.txt, Open Graph, JSON-LD
- Tamil language support (ta-IN locale)
- Scroll-to-top button
- Visitor tracking (live, today, total) in footer
- Dynamic advertisements (sidebar + banner with popup details)
- On-demand cache revalidation from CMS changes
- Theme colors configurable from CMS
- Dynamic logos (header + footer) from CMS settings

### Publisher Dashboard / CMS (port 3001)
- JWT authentication with automatic token refresh
- Article management (CRUD) with rich text editor (bold, italic, headings, lists, links, images, blockquotes)
- Featured image upload for articles
- Category management with parent/child hierarchy
- Tag management with inline editing
- User management (CRUD, role-based: Admin, Editor, Author)
- Media library with drag-and-drop upload, image variants (thumbnail, medium, large), delete with confirmation popup
- Comment moderation (approve/reject/filter)
- Obituary management with image upload
- Advertisement management (sidebar + banner positions, active toggle)
- Home layout configuration (section visibility, ordering, hero category selection)
- Site settings (title, tagline, description, logos, theme colors, social links, analytics)
- Sticky sidebar navigation
- Role-based access control (RBAC)

### Backend API (port 4000)
- RESTful API with Express.js
- Prisma ORM with MariaDB
- JWT authentication (access token: 15min, refresh token: 7 days)
- Account lockout after 3 failed login attempts (15 min)
- Image upload with Sharp processing (thumbnail, medium, large variants)
- CORS support for multiple origins
- Helmet security headers (with cross-origin override for media)
- Rate limiting
- On-demand frontend revalidation after CMS mutations
- Visitor tracking (sessions, daily counts, totals)
- Advertisement CRUD API

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- [Node.js 22+](https://nodejs.org/) installed locally (for building)
- npm (comes with Node.js)

## Quick Start

### 1. Clone and install dependencies

```bash
# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..

# Install publisher-dashboard dependencies
cd publisher-dashboard
npm install
cd ..
```

### 2. Configure environment

Copy the example env files:

```bash
cp frontend/.env.example frontend/.env
cp publisher-dashboard/.env.example publisher-dashboard/.env
```

For local development, the defaults (`http://localhost:4000/api`) work fine.

For network access from other devices, update the `.env` files with your machine's IP:

```env
# frontend/.env and publisher-dashboard/.env
NEXT_PUBLIC_API_URL=http://YOUR_IP:4000/api
```

And update `docker-compose.yml` CORS_ORIGIN to include your IP:

```yaml
CORS_ORIGIN: http://localhost:3000,http://localhost:3001,http://YOUR_IP:3000,http://YOUR_IP:3001
```

### 3. Build the projects

```bash
# Build backend TypeScript
cd backend
npx tsc
cd ..

# Build frontend
cd frontend
npx next build
cd ..

# Build publisher dashboard
cd publisher-dashboard
npx next build
cd ..
```

### 4. Start with Docker Compose

```bash
docker compose up -d --build
```

This starts all 4 services:
- MariaDB (waits for health check)
- Backend (runs Prisma migrations on startup)
- Frontend (serves pre-built Next.js standalone)
- Publisher Dashboard (serves pre-built Next.js standalone)

### 5. Seed the admin user

```bash
# Create seed script
cat > /tmp/seed-admin.js << 'EOF'
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
async function main() {
  const prisma = new PrismaClient();
  const hash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@oorumuravum.today' },
    update: { passwordHash: hash, failedLogins: 0, lockedUntil: null },
    create: { email: 'admin@oorumuravum.today', passwordHash: hash, name: 'Admin', slug: 'admin', role: 'ADMIN', bio: 'Platform administrator' },
  });
  console.log('Admin user ready');
  await prisma.$disconnect();
}
main().catch(console.error);
EOF

# Copy and run inside backend container
docker compose cp /tmp/seed-admin.js backend:/app/seed-admin.js
docker compose exec backend node seed-admin.js
```

### 6. Access the applications

| Application | URL | Credentials |
|-------------|-----|-------------|
| Public Site | http://localhost:3000 | — |
| CMS Dashboard | http://localhost:3001 | admin@oorumuravum.today / admin123 |
| Backend API | http://localhost:4000/api | — |

## Project Structure

```
├── backend/                    # Express.js API server
│   ├── src/
│   │   ├── index.ts           # App entry point, middleware, routes
│   │   ├── lib/
│   │   │   ├── auth.ts        # JWT helpers, middleware
│   │   │   ├── cache.ts       # In-memory cache with tags
│   │   │   ├── imageEncryption.ts # AES-256-CBC image encrypt/decrypt
│   │   │   ├── prisma.ts      # Prisma client singleton
│   │   │   ├── revalidate.ts  # Frontend cache revalidation
│   │   │   ├── serializer.ts  # Response serialization
│   │   │   └── slug.ts        # Unique slug generation
│   │   ├── middleware/
│   │   │   └── rateLimiter.ts # Rate limiting
│   │   └── routes/
│   │       ├── advertisements.ts
│   │       ├── articles.ts
│   │       ├── auth.ts        # Login, refresh, password reset
│   │       ├── authors.ts
│   │       ├── categories.ts
│   │       ├── comments.ts
│   │       ├── media.ts       # Upload, list, delete, serve
│   │       ├── obituaries.ts
│   │       ├── settings.ts    # Site settings CRUD
│   │       ├── tags.ts
│   │       ├── users.ts
│   │       └── visitors.ts    # Visitor tracking
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                   # Public-facing Next.js site
│   ├── src/
│   │   ├── app/               # Next.js App Router pages
│   │   │   ├── page.tsx       # Homepage
│   │   │   ├── layout.tsx     # Root layout
│   │   │   ├── news/[slug]/   # Article detail
│   │   │   ├── category/[slug]/ # Category listing
│   │   │   ├── tag/[slug]/    # Tag listing
│   │   │   ├── author/[slug]/ # Author page
│   │   │   ├── search/        # Search page
│   │   │   ├── obituary/[id]/ # Obituary detail
│   │   │   └── api/revalidate/ # On-demand revalidation endpoint
│   │   ├── components/
│   │   │   ├── article/       # ArticleCard, ArticleSlider, CommentsSection
│   │   │   ├── layout/        # Header, Footer
│   │   │   ├── seo/           # JsonLd
│   │   │   └── ui/            # HeroSection, Pagination, AdSidebar, VisitorStats, etc.
│   │   └── services/
│   │       └── api.ts         # API client with ISR caching + tags
│   ├── .env                   # NEXT_PUBLIC_API_URL
│   ├── Dockerfile
│   └── package.json
│
├── publisher-dashboard/        # Admin CMS (Next.js)
│   ├── src/
│   │   ├── app/               # CMS pages
│   │   │   ├── page.tsx       # Dashboard
│   │   │   ├── layout.tsx     # Root layout (server component)
│   │   │   ├── admin-shell.tsx # Client shell (auth, sidebar, nav)
│   │   │   ├── articles/      # Article CRUD + rich text editor
│   │   │   ├── categories/    # Category CRUD
│   │   │   ├── tags/          # Tag CRUD
│   │   │   ├── users/         # User CRUD
│   │   │   ├── media/         # Media library (upload, delete)
│   │   │   ├── comments/      # Comment moderation
│   │   │   ├── obituaries/    # Obituary CRUD
│   │   │   ├── advertisements/ # Ad management
│   │   │   ├── home-layout/   # Homepage section config
│   │   │   └── settings/      # Site settings, logos, colors
│   │   ├── components/
│   │   │   └── RichTextEditor.tsx # WYSIWYG content editor
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx # JWT auth with refresh
│   │   └── lib/
│   │       └── api.ts         # Admin fetch helper with auto token refresh
│   ├── .env                   # NEXT_PUBLIC_API_URL
│   ├── Dockerfile
│   └── package.json
│
├── prisma/
│   ├── schema.prisma          # Database schema (all models)
│   └── seed.sql               # Initial seed data
│
├── docker-compose.yml         # All services orchestration
└── README.md
```

## Database Schema

Key models in `prisma/schema.prisma`:

| Model | Description |
|-------|-------------|
| User | Admin/Editor/Author accounts with bcrypt passwords |
| Article | News articles with status (Draft/Published/Archived), categories, tags |
| Category | Hierarchical categories (parent/child) |
| Tag | Article tags |
| Comment | Article comments with moderation (Pending/Approved/Flagged/Rejected) |
| Media | Uploaded images with variants (original, thumbnail, medium, large) |
| Obituary | Obituary entries with image data |
| SiteSetting | Key-value site configuration |
| IngestionLog | Content ingestion tracking |
| VisitorSession | Active visitor sessions (for live count) |
| VisitorCount | Daily visitor counts |
| VisitorTotal | Running total visitors |
| Advertisement | Ad entries with image, description, position, active status |

## API Endpoints

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/login | No | Login with email/password |
| POST | /api/auth/refresh | No | Refresh access token |

### Articles
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/articles | No | List articles (paginated, filterable) |
| GET | /api/articles/:slug | No | Get article by slug |
| POST | /api/articles | Yes | Create article |
| PUT | /api/articles/:id | Yes | Update article |
| DELETE | /api/articles/:id | Yes (Admin/Editor) | Delete article |

### Categories
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/categories | No | List all categories with children |
| POST | /api/categories | Yes (Admin/Editor) | Create category |
| PUT | /api/categories/:id | Yes (Admin/Editor) | Update category |
| DELETE | /api/categories/:id | Yes (Admin) | Delete category |

### Tags
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/tags | No | List all tags |
| POST | /api/tags | Yes (Admin/Editor) | Create tag |
| PUT | /api/tags/:id | Yes (Admin/Editor) | Update tag |
| DELETE | /api/tags/:id | Yes (Admin/Editor) | Delete tag |

### Users
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/users | Yes (Admin) | List users (paginated) |
| POST | /api/users | Yes (Admin) | Create user |
| PUT | /api/users/:id | Yes (Admin) | Update user |
| DELETE | /api/users/:id | Yes (Admin) | Delete user |

### Media
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/media | Yes | List all media |
| POST | /api/media/upload | Yes | Upload image (multipart, field: "file") — encrypts to DB |
| GET | /api/media/:id/image | No | Serve decrypted image from DB |
| DELETE | /api/media/:id | Yes (Admin/Editor) | Delete media and files |

### Comments
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/comments/admin/all | Yes (Admin/Editor) | List all comments |
| PUT | /api/comments/:id/approve | Yes (Admin/Editor) | Approve comment |
| PUT | /api/comments/:id/reject | Yes (Admin/Editor) | Reject comment |

### Settings
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/settings/public | No | Get public settings |
| GET | /api/settings | Yes (Admin) | Get all settings |
| PUT | /api/settings | Yes (Admin) | Update setting (key/value) |

### Obituaries
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/obituaries | No | List obituaries (paginated) |
| GET | /api/obituaries/:id/image | No | Serve obituary image |
| POST | /api/obituaries | Yes | Create obituary (multipart) |
| PUT | /api/obituaries/:id | Yes | Update obituary |
| DELETE | /api/obituaries/:id | Yes | Delete obituary |

### Advertisements
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/ads | No | List active ads (or all with auth) |
| POST | /api/ads | Yes (Admin) | Create advertisement |
| PUT | /api/ads/:id | Yes (Admin) | Update advertisement |
| DELETE | /api/ads/:id | Yes (Admin) | Delete advertisement |

### Visitors
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/visitors/ping | No | Register/heartbeat visitor session |
| GET | /api/visitors/stats | No | Get live, today, total counts |

### Other
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/search | No | Search articles |
| GET | /api/authors | No | List authors |
| GET | /api/authors/:slug | No | Get author by slug |
| POST | /api/revalidate (frontend) | Secret | On-demand cache revalidation |

## Environment Variables

### Backend (docker-compose.yml)
| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 4000 |
| DATABASE_URL | MariaDB connection string | — |
| CORS_ORIGIN | Comma-separated allowed origins | http://localhost:3000 |
| JWT_SECRET | Access token signing secret | — |
| JWT_REFRESH_SECRET | Refresh token signing secret | — |
| IMAGE_ENCRYPTION_KEY | **32-char AES-256 key for image encryption** | — |
| MEDIA_UPLOAD_PATH | Upload directory path | ./uploads |
| FRONTEND_REVALIDATE_URL | Frontend revalidation endpoint | — |
| REVALIDATE_SECRET | Shared secret for revalidation | — |

### Frontend (.env)
| Variable | Description | Default |
|----------|-------------|---------|
| NEXT_PUBLIC_API_URL | Public API URL (baked at build time) | http://localhost:4000/api |
| NEXT_PUBLIC_SITE_URL | Public site URL for SEO | http://localhost:3000 |
| INTERNAL_API_URL | Docker-internal API URL (SSR) | http://backend:4000/api |
| REVALIDATE_SECRET | Shared secret for revalidation | — |

### Publisher Dashboard (.env)
| Variable | Description | Default |
|----------|-------------|---------|
| NEXT_PUBLIC_API_URL | Public API URL (baked at build time) | http://localhost:4000/api |

## Common Operations

### Rebuild after code changes

```bash
# Backend changes
cd backend && npx tsc && cd ..
docker compose up -d --build backend

# Frontend changes
cd frontend && npx next build && cd ..
docker compose restart frontend

# CMS changes
cd publisher-dashboard && npx next build && cd ..
docker compose restart publisher-dashboard
```

### View logs

```bash
docker compose logs backend --tail 50
docker compose logs frontend --tail 50
docker compose logs publisher-dashboard --tail 50
```

### Access database

```bash
docker compose exec mariadb mariadb -u tamil_user -ptamil_pass tamil_news
```

### Reset admin password

```bash
docker compose exec backend node -e "
const bcrypt=require('bcrypt');
const{PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const h=await bcrypt.hash('admin123',10);
  await p.user.update({where:{email:'admin@oorumuravum.today'},data:{passwordHash:h,failedLogins:0,lockedUntil:null}});
  console.log('Password reset');
  await p.\$disconnect();
})()"
```

### Stop all services

```bash
docker compose down
```

### Stop and remove all data

```bash
docker compose down -v
```

## Image Encryption

All uploaded images are encrypted at rest using **AES-256-CBC** before being stored in the database.

### How it works

- **Upload**: image bytes are encrypted with a random IV before writing to the `imageData` DB column
- **Serve**: the `/api/media/:id/image` and `/api/obituaries/:id/image` endpoints decrypt the bytes transparently before sending to the browser
- **Format**: `[4-byte IV-length header][16-byte random IV][AES-256-CBC encrypted data]`
- **Backward compatible**: `safeDecryptImage()` detects legacy unencrypted blobs and returns them raw

### Configuration

Set `IMAGE_ENCRYPTION_KEY` to exactly 32 characters in your environment:

```bash
# Generate a strong key (run once, store safely — never change it)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

**Docker** (`docker-compose.yml`):
```yaml
IMAGE_ENCRYPTION_KEY: your-32-char-key-goes-here!!!!!
```

**CPanel** — add to Node.js App environment variables:
```
IMAGE_ENCRYPTION_KEY = your-32-char-key-goes-here!!!!!
```

> **Critical:** The encryption key must never change after images are stored. If it changes, all existing encrypted images become unreadable. Store it in a password manager.

### Verify encryption is working

After uploading an image, check the raw DB value — it should be binary, not a readable JPEG/PNG:

```sql
-- Run inside the MariaDB container or CPanel DB
SELECT id, LENGTH(imageData), HEX(SUBSTR(imageData, 1, 8)) as header_hex
FROM Media
LIMIT 5;
```

Encrypted images show a non-JPEG header. The first 4 bytes will be `00000010` (IV length = 16 in hex), followed by the random IV. Compare: a raw JPEG starts with `FFD8FFE0`.

You can also test from the browser — the image URL (`/api/media/:id/image`) should display correctly even though the DB blob is unreadable binary.

---

## CI/CD Pipeline

The project uses GitHub Actions to automatically build and deploy only changed services on every push to `main`.

### How change detection works

| Files changed | Services rebuilt |
|---------------|-----------------|
| `backend/**` or `prisma/**` | Backend only |
| `frontend/**` | Frontend only |
| `publisher-dashboard/**` | Dashboard only |
| `docker-compose.yml` or `.github/**` | All services |

### Deployment targets

The pipeline supports two deployment targets, both controlled by GitHub Secrets:

| Target | When active |
|--------|-------------|
| **CPanel** (always on) | SSH into CPanel, upload build artifacts, touch `tmp/restart.txt` |
| **Docker server** | Only when repo variable `ENABLE_DOCKER_DEPLOY = true` |

### Required GitHub Secrets

Go to **GitHub → Settings → Secrets and variables → Actions → Secrets** and add:

#### For CPanel deployment
| Secret | Example | Description |
|--------|---------|-------------|
| `CPANEL_HOST` | `cloud620.example.com` | CPanel server hostname |
| `CPANEL_USER` | `oorumur1` | SSH username |
| `CPANEL_SSH_KEY` | *(private key PEM)* | SSH private key for the user |
| `CPANEL_SSH_PORT` | `22` | SSH port (optional, defaults to 22) |
| `CPANEL_BACKEND_PATH` | `/home/oorumur1/public_html/api` | Absolute path to backend app |
| `CPANEL_FRONTEND_PATH` | `/home/oorumur1/public_html/frontend` | Absolute path to frontend app |
| `CPANEL_CMS_PATH` | `/home/oorumur1/public_html/cms` | Absolute path to CMS app |
| `CPANEL_NODE_BIN` | `/home/oorumur1/nodevenv/public_html/api/22/bin/node` | Node.js binary path |
| `IMAGE_ENCRYPTION_KEY` | *(32-char key)* | Image encryption key |
| `NEXT_PUBLIC_API_URL` | `https://api.oorumuravum.com/api` | Public API URL (baked into frontend builds) |
| `NEXT_PUBLIC_SITE_URL` | `https://oorumuravum.com` | Public site URL |

#### For Docker server deployment (optional)
| Secret | Description |
|--------|-------------|
| `DOCKER_HOST` | Docker server hostname |
| `DOCKER_USER` | SSH username on Docker server |
| `DOCKER_SSH_KEY` | SSH private key |
| `DOCKER_SSH_PORT` | SSH port (optional) |
| `DOCKER_DEPLOY_PATH` | Path to project on the server |

Set repo variable `ENABLE_DOCKER_DEPLOY = true` under **Settings → Variables** to activate Docker deployment.

### Setting up the SSH key for CPanel

```bash
# 1. Generate a deploy key (no passphrase)
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/cpanel_deploy_key -N ""

# 2. Copy the public key to CPanel
#    CPanel → SSH Access → Manage SSH Keys → Import Key → paste .pub content
#    Then: Authorize the key

# 3. Add the private key content to GitHub Secret CPANEL_SSH_KEY
cat ~/.ssh/cpanel_deploy_key
```

### Workflow file

See [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) for the full pipeline.

---

## Deployment to Production

### Docker Compose (self-hosted server)

1. Get a server with Docker installed (AWS EC2, DigitalOcean, etc.)
2. Point your domain DNS to the server IP
3. Update environment files:

```bash
# frontend/.env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
NEXT_PUBLIC_SITE_URL=https://yourdomain.com

# publisher-dashboard/.env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api

# docker-compose.yml backend environment
CORS_ORIGIN: https://yourdomain.com,https://cms.yourdomain.com
SITE_URL: https://yourdomain.com
JWT_SECRET: <generate-a-strong-random-secret>
JWT_REFRESH_SECRET: <generate-another-strong-random-secret>
REVALIDATE_SECRET: <generate-another-secret>
IMAGE_ENCRYPTION_KEY: <exactly-32-chars-never-change>
```

4. Build and deploy:

```bash
cd frontend && npx next build && cd ..
cd publisher-dashboard && npx next build && cd ..
cd backend && npx tsc && cd ..
docker compose up -d --build
```

5. Set up a reverse proxy (nginx/Caddy) with SSL for your domain.

### CPanel (shared hosting)

See `backend/.env.cpanel` for a ready-to-fill production environment template.

Key steps:
1. Upload `backend/dist/`, `prisma/`, `backend/app.js`, `backend/package.json` to `/public_html/api/`
2. In CPanel → Setup Node.js App → set `IMAGE_ENCRYPTION_KEY` and other secrets
3. Run `npm install --omit=dev` then `node node_modules/.bin/prisma migrate deploy`
4. Build frontend/dashboard locally with production `NEXT_PUBLIC_API_URL` and upload the `.next/standalone` output

## User Roles

| Role | Permissions |
|------|-------------|
| ADMIN | Full access: all CRUD, user management, settings, home layout, ads |
| EDITOR | Articles, categories, tags, comments, media, obituaries |
| AUTHOR | Own articles, media uploads, obituaries |

## License

Private project — all rights reserved.
