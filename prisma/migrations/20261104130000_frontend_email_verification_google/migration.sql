CREATE TABLE IF NOT EXISTS `frontend_users` (
  `id` VARCHAR(30) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(20) NULL,
  `address` TEXT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `avatar_url` VARCHAR(500) NULL,
  `google_id` VARCHAR(255) NULL,
  `email_verified` BOOLEAN NOT NULL DEFAULT TRUE,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `failed_logins` INTEGER NOT NULL DEFAULT 0,
  `locked_until` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `frontend_users_email_key` (`email`),
  UNIQUE INDEX `frontend_users_google_id_key` (`google_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `frontend_users`
  ADD COLUMN IF NOT EXISTS `google_id` VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS `email_verified` BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE `frontend_users`
  ADD UNIQUE INDEX IF NOT EXISTS `frontend_users_google_id_key` (`google_id`);

CREATE TABLE IF NOT EXISTS `frontend_email_verifications` (
  `id` VARCHAR(30) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `code_hash` CHAR(64) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `last_sent_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `frontend_email_verifications_email_key` (`email`),
  INDEX `frontend_email_verifications_expires_at_idx` (`expires_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
