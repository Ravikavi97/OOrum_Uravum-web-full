-- Tamil News Platform: Initial Migration
--
-- NOTE: This migration SQL was generated manually from the Prisma schema.
-- To apply it against a running MariaDB instance, run:
--   npx prisma migrate dev --schema=prisma/schema.prisma
-- from the workspace root with a valid DATABASE_URL in your .env file.
--
-- All tables use CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
-- to ensure full Tamil Unicode support (U+0B80–U+0BFF).

-- ─── Enums (MariaDB uses inline ENUMs) ──────────────────────────────────────

-- ─── Users ──────────────────────────────────────────────────────────────────

CREATE TABLE `users` (
    `id` VARCHAR(30) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `role` ENUM('ADMIN', 'EDITOR', 'AUTHOR') NOT NULL DEFAULT 'AUTHOR',
    `bio` TEXT NULL,
    `profile_image` VARCHAR(500) NULL,
    `social_links` JSON NULL,
    `failed_logins` INTEGER NOT NULL DEFAULT 0,
    `locked_until` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Categories ─────────────────────────────────────────────────────────────

CREATE TABLE `categories` (
    `id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `parent_id` VARCHAR(30) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `categories_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Articles ───────────────────────────────────────────────────────────────

CREATE TABLE `articles` (
    `id` VARCHAR(30) NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `slug` VARCHAR(500) NOT NULL,
    `content` TEXT NOT NULL,
    `excerpt` TEXT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `is_breaking` BOOLEAN NOT NULL DEFAULT false,
    `featured_image` VARCHAR(500) NULL,
    `source_url` VARCHAR(2048) NULL,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `author_id` VARCHAR(30) NOT NULL,
    `category_id` VARCHAR(30) NOT NULL,

    UNIQUE INDEX `articles_slug_key`(`slug`),
    UNIQUE INDEX `articles_source_url_key`(`source_url`),
    INDEX `articles_status_published_at_idx`(`status`, `published_at` DESC),
    INDEX `articles_author_id_idx`(`author_id`),
    INDEX `articles_category_id_idx`(`category_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Tags ───────────────────────────────────────────────────────────────────

CREATE TABLE `tags` (
    `id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `tags_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Article Tags (junction table) ─────────────────────────────────────────

CREATE TABLE `article_tags` (
    `article_id` VARCHAR(30) NOT NULL,
    `tag_id` VARCHAR(30) NOT NULL,

    PRIMARY KEY (`article_id`, `tag_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Comments ───────────────────────────────────────────────────────────────

CREATE TABLE `comments` (
    `id` VARCHAR(30) NOT NULL,
    `display_name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `content` TEXT NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'FLAGGED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `article_id` VARCHAR(30) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `comments_article_id_status_idx`(`article_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Media ──────────────────────────────────────────────────────────────────

CREATE TABLE `media` (
    `id` VARCHAR(30) NOT NULL,
    `filename` VARCHAR(500) NOT NULL,
    `original_url` VARCHAR(2048) NOT NULL,
    `thumbnail_url` VARCHAR(2048) NULL,
    `medium_url` VARCHAR(2048) NULL,
    `large_url` VARCHAR(2048) NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `size` INTEGER NOT NULL,
    `article_id` VARCHAR(30) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Site Settings ──────────────────────────────────────────────────────────

CREATE TABLE `site_settings` (
    `id` VARCHAR(30) NOT NULL,
    `key` VARCHAR(255) NOT NULL,
    `value` TEXT NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `site_settings_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Ingestion Logs ─────────────────────────────────────────────────────────

CREATE TABLE `ingestion_logs` (
    `id` VARCHAR(30) NOT NULL,
    `source_url` VARCHAR(2048) NOT NULL,
    `status` VARCHAR(50) NOT NULL,
    `message` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Foreign Key Constraints ────────────────────────────────────────────────

ALTER TABLE `categories`
    ADD CONSTRAINT `categories_parent_id_fkey`
    FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `articles`
    ADD CONSTRAINT `articles_author_id_fkey`
    FOREIGN KEY (`author_id`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `articles`
    ADD CONSTRAINT `articles_category_id_fkey`
    FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `article_tags`
    ADD CONSTRAINT `article_tags_article_id_fkey`
    FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `article_tags`
    ADD CONSTRAINT `article_tags_tag_id_fkey`
    FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `comments`
    ADD CONSTRAINT `comments_article_id_fkey`
    FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `media`
    ADD CONSTRAINT `media_article_id_fkey`
    FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
