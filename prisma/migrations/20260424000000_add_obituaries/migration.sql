-- CreateTable
CREATE TABLE `obituaries` (
    `id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(500) NOT NULL,
    `content` TEXT NOT NULL,
    `source_url` VARCHAR(2048) NULL,
    `image_data` LONGBLOB NULL,
    `published_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `obituaries_source_url_key`(`source_url`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
