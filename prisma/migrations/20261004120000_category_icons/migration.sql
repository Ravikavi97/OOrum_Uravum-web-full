-- Add category icon support: uploaded icon file (icon_url) or built-in icon key (icon_key)
ALTER TABLE `categories`
    ADD COLUMN `icon_url` VARCHAR(500) NULL,
    ADD COLUMN `icon_key` VARCHAR(50) NULL;