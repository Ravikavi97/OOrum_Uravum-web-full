-- AlterTable
ALTER TABLE `advertisements`
    ADD COLUMN `variant` VARCHAR(50) NOT NULL DEFAULT 'default',
    ADD COLUMN `badge` VARCHAR(50) NULL,
    ADD COLUMN `meta_text` VARCHAR(255) NULL,
    ADD COLUMN `icon` VARCHAR(50) NULL,
    ADD COLUMN `link_label` VARCHAR(100) NULL;