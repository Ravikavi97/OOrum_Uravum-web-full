ALTER TABLE `categories`
  ADD COLUMN IF NOT EXISTS `path` VARCHAR(255) NULL;

ALTER TABLE `obituaries`
  ADD COLUMN IF NOT EXISTS `slug` VARCHAR(500) NULL AFTER `name`,
  ADD COLUMN IF NOT EXISTS `image_mime_type` VARCHAR(100) NULL AFTER `image_data`,
  ADD COLUMN IF NOT EXISTS `image_url` VARCHAR(2048) NULL AFTER `image_mime_type`,
  ADD COLUMN IF NOT EXISTS `status` VARCHAR(20) NULL DEFAULT 'PENDING' AFTER `image_url`,
  ADD COLUMN IF NOT EXISTS `submitter_name` VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS `submitter_email` VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS `updated_at` DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS `first_name` VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS `middle_name` VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS `surname` VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS `other_names` VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS `date_of_birth` DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS `date_of_death` DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS `place_of_birth` VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS `last_residential_address` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `father_name` VARCHAR(150) NULL,
  ADD COLUMN IF NOT EXISTS `mother_name` VARCHAR(150) NULL,
  ADD COLUMN IF NOT EXISTS `marital_status` VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS `spouse_name` VARCHAR(150) NULL,
  ADD COLUMN IF NOT EXISTS `brothers_names` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `sisters_names` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `father_in_law_name` VARCHAR(150) NULL,
  ADD COLUMN IF NOT EXISTS `mother_in_law_name` VARCHAR(150) NULL,
  ADD COLUMN IF NOT EXISTS `sons_names` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `daughters_names` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `sons_in_law_names` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `daughters_in_law_names` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `grandchildren_names` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `occupations` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `hobbies_interests` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `community_activities` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `other_details` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `life_story` TEXT NULL;

UPDATE `obituaries`
SET `slug` = CONCAT('obituary-', `id`)
WHERE `slug` IS NULL OR `slug` = '';

UPDATE `obituaries`
SET `status` = 'PENDING'
WHERE `status` IS NULL OR `status` = '';

UPDATE `obituaries`
SET `updated_at` = COALESCE(`published_at`, `created_at`, CURRENT_TIMESTAMP(3))
WHERE `updated_at` IS NULL;

UPDATE `obituaries`
SET `image_mime_type` = 'image/jpeg'
WHERE `image_data` IS NOT NULL AND `image_mime_type` IS NULL;

ALTER TABLE `obituaries`
  MODIFY COLUMN `slug` VARCHAR(500) NOT NULL,
  MODIFY COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  MODIFY COLUMN `updated_at` DATETIME(3) NOT NULL;

ALTER TABLE `categories`
  ADD UNIQUE INDEX IF NOT EXISTS `categories_path_key` (`path`);

ALTER TABLE `obituaries`
  ADD UNIQUE INDEX IF NOT EXISTS `obituaries_slug_key` (`slug`),
  ADD INDEX IF NOT EXISTS `obituaries_status_idx` (`status`),
  ADD INDEX IF NOT EXISTS `obituaries_date_of_death_idx` (`date_of_death`),
  ADD INDEX IF NOT EXISTS `obituaries_first_name_surname_idx` (`first_name`, `surname`);
