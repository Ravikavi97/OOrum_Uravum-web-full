SET NAMES utf8mb4;
SET time_zone = '+00:00';

DROP DATABASE IF EXISTS `tamil_news`;

CREATE DATABASE IF NOT EXISTS `tamil_news`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `tamil_news`;

CREATE TABLE `users` (
  `id`            VARCHAR(30)  NOT NULL,
  `email`         VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `name`          VARCHAR(255) NOT NULL,
  `slug`          VARCHAR(255) NOT NULL,
  `role`          ENUM('ADMIN','EDITOR','AUTHOR') NOT NULL DEFAULT 'AUTHOR',
  `bio`           TEXT NULL,
  `profile_image` VARCHAR(500) NULL,
  `social_links`  JSON NULL,
  `failed_logins` INT NOT NULL DEFAULT 0,
  `locked_until`  DATETIME(3) NULL,
  `created_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_key` (`email`),
  UNIQUE KEY `users_slug_key`  (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `categories` (
  `id`          VARCHAR(30)  NOT NULL,
  `name`        VARCHAR(255) NOT NULL,
  `slug`        VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `parent_id`   VARCHAR(30) NULL,
  `created_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `categories_slug_key` (`slug`),
  KEY `categories_parent_id_idx` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `articles` (
  `id`             VARCHAR(30)   NOT NULL,
  `title`          VARCHAR(500)  NOT NULL,
  `slug`           VARCHAR(500)  NOT NULL,
  `content`        TEXT NOT NULL,
  `excerpt`        TEXT NULL,
  `status`         ENUM('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `is_breaking`    BOOLEAN NOT NULL DEFAULT FALSE,
  `featured_image` VARCHAR(500) NULL,
  `source_url`     VARCHAR(2048) NULL,
  `published_at`   DATETIME(3) NULL,
  `created_at`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `author_id`      VARCHAR(30) NOT NULL,
  `category_id`    VARCHAR(30) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `articles_slug_key` (`slug`),
  UNIQUE KEY `articles_source_url_key` (`source_url`),
  KEY `articles_status_published_at_idx` (`status`,`published_at`),
  KEY `articles_author_id_idx` (`author_id`),
  KEY `articles_category_id_idx` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tags` (
  `id`         VARCHAR(30)  NOT NULL,
  `name`       VARCHAR(255) NOT NULL,
  `slug`       VARCHAR(255) NOT NULL,
  `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `tags_slug_key` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `article_tags` (
  `article_id` VARCHAR(30) NOT NULL,
  `tag_id`     VARCHAR(30) NOT NULL,
  PRIMARY KEY (`article_id`,`tag_id`),
  KEY `article_tags_tag_id_idx` (`tag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `comments` (
  `id`           VARCHAR(30)  NOT NULL,
  `display_name` VARCHAR(255) NOT NULL,
  `email`        VARCHAR(255) NOT NULL,
  `content`      TEXT NOT NULL,
  `status`       ENUM('PENDING','APPROVED','FLAGGED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `article_id`   VARCHAR(30) NOT NULL,
  `created_at`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `comments_article_id_status_idx` (`article_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `media` (
  `id`            VARCHAR(30)   NOT NULL,
  `filename`      VARCHAR(500)  NOT NULL,
  `original_url`  VARCHAR(2048) NOT NULL,
  `thumbnail_url` VARCHAR(2048) NULL,
  `medium_url`    VARCHAR(2048) NULL,
  `large_url`     VARCHAR(2048) NULL,
  `mime_type`     VARCHAR(100)  NOT NULL,
  `size`          INT NOT NULL,
  `image_data`    LONGBLOB NULL,
  `article_id`    VARCHAR(30) NULL,
  `created_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `media_article_id_idx` (`article_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `site_settings` (
  `id`         VARCHAR(30)  NOT NULL,
  `key`        VARCHAR(255) NOT NULL,
  `value`      TEXT NOT NULL,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `site_settings_key_key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ingestion_logs` (
  `id`         VARCHAR(30)   NOT NULL,
  `source_url` VARCHAR(2048) NOT NULL,
  `status`     VARCHAR(50)   NOT NULL,
  `message`    TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `obituaries` (
  `id`           VARCHAR(30)  NOT NULL,
  `name`         VARCHAR(500) NOT NULL,
  `content`      TEXT NOT NULL,
  `source_url`   VARCHAR(2048) NULL,
  `image_data`   LONGBLOB NULL,
  `published_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `obituaries_source_url_key` (`source_url`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `visitor_sessions` (
  `id`         VARCHAR(30)  NOT NULL,
  `session_id` VARCHAR(64)  NOT NULL,
  `ip`         VARCHAR(45)  NULL,
  `user_agent` VARCHAR(500) NULL,
  `last_seen`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `visitor_sessions_session_id_key` (`session_id`),
  KEY `visitor_sessions_last_seen_idx` (`last_seen`),
  KEY `visitor_sessions_created_at_idx` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `visitor_counts` (
  `id`    VARCHAR(30) NOT NULL,
  `date`  DATE NOT NULL,
  `count` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `visitor_counts_date_key` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `visitor_total` (
  `id`    VARCHAR(30) NOT NULL,
  `total` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `advertisements` (
  `id`          VARCHAR(30)   NOT NULL,
  `title`       VARCHAR(500)  NOT NULL,
  `description` TEXT NULL,
  `image_url`   VARCHAR(2048) NULL,
  `link_url`    VARCHAR(2048) NULL,
  `position`    VARCHAR(50)   NOT NULL DEFAULT 'sidebar',
  `active`      BOOLEAN NOT NULL DEFAULT TRUE,
  `order`       INT NOT NULL DEFAULT 0,
  `created_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `advertisements_active_position_idx` (`active`,`position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

ALTER TABLE `articles`
  ADD FULLTEXT INDEX `articles_fulltext_idx` (`title`, `excerpt`, `content`);

INSERT INTO site_settings (id, `key`, value, updated_at) VALUES
('set-1', 'siteTitle', 'OORUM URAVUM', NOW()),
('set-2', 'siteTagline', 'ஒன்று பட்டால் உண்டு வாழ்வு', NOW()),
('set-3', 'siteDescription', 'தமிழ் செய்திகள் — செய்திகள், அறிந்து கொள்வோம், உடல் நலம், தொழில்நுட்பம்', NOW())
ON DUPLICATE KEY UPDATE value=VALUES(value);

INSERT INTO users (id, email, password_hash, name, slug, role, bio, created_at, updated_at) VALUES
('usr-admin', 'admin@oorumuravum.today', '$2b$10$LQ7VxvBh8GQx5Kz5YJvOXeZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZ', 'Admin', 'admin', 'ADMIN', 'Platform administrator', NOW(), NOW()),
('usr-ananthan', 'ananthan@oorumuravum.today', '$2b$10$LQ7VxvBh8GQx5Kz5YJvOXeZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZ', 'Ananthan', 'ananthan', 'AUTHOR', 'Tamil news writer and temple historian', NOW(), NOW()),
('usr-vasel', 'vasel@oorumuravum.today', '$2b$10$LQ7VxvBh8GQx5Kz5YJvOXeZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZ', 'Mr. VASEL', 'mr-vasel', 'AUTHOR', 'Health and technology writer', NOW(), NOW())
ON DUPLICATE KEY UPDATE name=VALUES(name);

INSERT INTO categories (id, name, slug, description, parent_id, created_at, updated_at) VALUES
('cat-seithigal', 'செய்திகள்', 'seithigal', 'Latest Tamil news and current affairs', NULL, NOW(), NOW()),
('cat-arindhu', 'அறிந்து கொள்வோம்', 'arindhu-kolvom', 'Knowledge and educational articles', NULL, NOW(), NOW()),
('cat-udal', 'உடல் நலம்', 'udal-nalam', 'Health and wellness articles', NULL, NOW(), NOW()),
('cat-thozhil', 'தொழில்நுட்பம்', 'thozhilnutpam', 'Technology news and tips', NULL, NOW(), NOW()),
('cat-padaippu', 'படைப்பாக்கம்', 'padaippakkam', 'Creative works and arts', NULL, NOW(), NOW()),
('cat-vaazhthu', 'வாழ்த்துக்கள்', 'vaazhthukkal', 'Greetings and celebrations', NULL, NOW(), NOW())
ON DUPLICATE KEY UPDATE name=VALUES(name);

INSERT INTO articles (id, title, slug, content, excerpt, status, is_breaking, published_at, created_at, updated_at, author_id, category_id) VALUES
('art-1', 'திருவாரூர் தியாகராஜர் திருக்கோவில்', 'thiruvarur-thiyagarajar-thirukovil',
'<p>அமைவிடம்: திருவாரூர் மாவட்டத்தில் உள்ள திருவாரூரில் அமைந்துள்ளது.</p><p>தலவரலாறு: 5000 ஆண்டுகள் பழமையான தலம். இது தமிழ்நாட்டின் மிகப் பழமையான கோவில்களில் ஒன்றாகும். இந்த கோவிலின் சிறப்பு என்னவென்றால், இங்கு தியாகராஜர் என்ற பெயரில் சிவபெருமான் வழிபடப்படுகிறார்.</p><p>கோவிலின் கட்டிடக்கலை சோழர் காலத்தைச் சேர்ந்தது. பல அரசர்கள் இந்த கோவிலை விரிவுபடுத்தி கட்டியுள்ளனர்.</p>',
'திருவாரூர் மாவட்டத்தில் உள்ள 5000 ஆண்டுகள் பழமையான தியாகராஜர் திருக்கோவில் பற்றிய தகவல்கள்.',
'PUBLISHED', 1, '2026-04-23 08:00:00', NOW(), NOW(), 'usr-ananthan', 'cat-arindhu'),

('art-2', 'மன்னாரில் வேலைவாய்ப்பு மற்றும் தொழிற்பயிற்சி கண்காட்சி', 'mannaril-velaivaaippu-kankaatchi',
'<p>தொழில் தேடும் இளைஞர், யுவதிகளின் நலனைக் கருத்தில் கொண்டு மன்னார் நகர பிரதேச செயலகம், மனிதவலு மற்றும் வேலைவாய்ப்புத் திணைக்களத்துடன் இணைந்து வேலைவாய்ப்பு மற்றும் தொழிற்பயிற்சி கண்காட்சியை நடத்தியது.</p><p>இந்த கண்காட்சியில் பல்வேறு நிறுவனங்கள் பங்கேற்று, இளைஞர்களுக்கு வேலைவாய்ப்புகளை வழங்கின.</p>',
'மன்னார் நகரில் நடைபெற்ற வேலைவாய்ப்பு மற்றும் தொழிற்பயிற்சி கண்காட்சி பற்றிய செய்தி.',
'PUBLISHED', 0, '2026-04-22 10:00:00', NOW(), NOW(), 'usr-ananthan', 'cat-seithigal'),

('art-3', 'திருவண்டுதுறை வண்டுறைநாதர் திருக்கோவில்', 'thiruvanduthurai-vandurainathar-thirukovil',
'<p>அமைவிடம்: திருவாரூர் மாவட்டத்தில் திருவண்டுதுறை எனுமிடத்தில் அமைந்துள்ளது.</p><p>தலவரலாறு: பிருங்கி முனிவர் சிவபெருமானின் தீவிர பக்தர். மற்ற அனைத்து கடவுள்களைத் தவிர்த்து சிவபெருமானை மட்டுமே வழிபட்டார். இந்த கோவிலில் சிவபெருமான் வண்டுறைநாதர் என்ற பெயரில் அருள்பாலிக்கிறார்.</p>',
'திருவாரூர் மாவட்டத்தில் அமைந்துள்ள வண்டுறைநாதர் திருக்கோவில் பற்றிய வரலாற்றுத் தகவல்கள்.',
'PUBLISHED', 0, '2026-04-21 09:00:00', NOW(), NOW(), 'usr-ananthan', 'cat-arindhu'),

('art-4', 'திருமீயச்சூர் மேகநாதர் திருக்கோவில்', 'thirumeeyachur-meghanathar-thirukovil',
'<p>அமைவிடம்: திருவாரூர் மாவட்டத்தில் நன்னிலம் வட்டத்தில், மயிலாடுதுறை-திருவாரூர் சாலையில் பேரளம் என்ற ஊரிலிருந்து சுமார் 2 கி.மீ. தொலைவில் அமைந்துள்ளது.</p><p>இந்த கோவிலில் சிவபெருமான் மேகநாதர் என்ற பெயரில் அருள்பாலிக்கிறார். பல நூற்றாண்டுகள் பழமையான இந்த கோவில் சோழர் கால கட்டிடக்கலையை பிரதிபலிக்கிறது.</p>',
'திருவாரூர் மாவட்டத்தில் அமைந்துள்ள மேகநாதர் திருக்கோவில் பற்றிய தகவல்கள்.',
'PUBLISHED', 0, '2026-04-19 09:00:00', NOW(), NOW(), 'usr-ananthan', 'cat-arindhu'),

('art-5', 'திருமீயாச்சூர் சகலபுவனேஸ்வரர் திருக்கோவில்', 'thirumeeyachur-sagalapuvanesvarar-thirukovil',
'<p>அமைவிடம்: திருவாரூர் மாவட்டத்தில் மயிலாடுதுறையில் இருந்து சுமார் 20 கி.மீ. தொலைவில் உள்ள பேரளம் என்ற ஊரிலிருந்து மேற்கே 2 கி.மீ. தொலைவில் அமைந்துள்ளது.</p><p>சகலபுவனேஸ்வரர் என்ற பெயரில் சிவபெருமான் இங்கு அருள்பாலிக்கிறார். இந்த கோவில் பல சிறப்புகளைக் கொண்டது.</p>',
'திருவாரூர் மாவட்டத்தில் அமைந்துள்ள சகலபுவனேஸ்வரர் திருக்கோவில் பற்றிய தகவல்கள்.',
'PUBLISHED', 0, '2026-04-17 09:00:00', NOW(), NOW(), 'usr-ananthan', 'cat-arindhu'),

('art-6', 'சித்திரை புத்தாண்டு விளையாட்டுப் போட்டிகளுக்கான பாதுகாப்பு நடைமுறை வெளியீடு', 'chithirai-puthandu-vilaiyaattu-paathukaapu',
'<p>சித்திரை புத்தாண்டு காலப்பகுதியில் ஏற்பாடு செய்யப்படும் பாரம்பரிய விளையாட்டுப் போட்டிகளின் போது ஏற்படக்கூடிய விபத்துகள் மற்றும் பாரிய மருத்துவ சிக்கல்களைத் தடுக்கும் நோக்கில் பாதுகாப்பு நடைமுறைகள் வெளியிடப்பட்டுள்ளன.</p><p>இந்த நடைமுறைகள் அனைத்து விளையாட்டு ஏற்பாட்டாளர்களும் பின்பற்ற வேண்டும் என அறிவிக்கப்பட்டுள்ளது.</p>',
'சித்திரை புத்தாண்டு விளையாட்டுப் போட்டிகளுக்கான பாதுகாப்பு நடைமுறைகள் வெளியிடப்பட்டுள்ளன.',
'PUBLISHED', 0, '2026-04-13 10:00:00', NOW(), NOW(), 'usr-ananthan', 'cat-seithigal'),

('art-7', 'முல்லைத்தீவில் வெற்றிகரமாக மஞ்சள் செய்கை வயல் விழா', 'mullaitheevil-manjal-seigai-vayal-vizha',
'<p>வடமாகாண விவசாயத் திணைக்களத்தின் குறித்தொதுக்கப்பட்ட நிதியத்தின் கீழ் 2025ஆம் ஆண்டிற்கான மஞ்சள் செய்கை திட்டம் முல்லைத்தீவு மாவட்டம் விசுவமடு விவசாயப் போதனாசிரியர் பிரிவில் வெற்றிகரமாக நடைபெற்றது.</p><p>இந்த திட்டத்தின் மூலம் விவசாயிகளுக்கு மஞ்சள் செய்கை பற்றிய பயிற்சி வழங்கப்பட்டது.</p>',
'முல்லைத்தீவில் நடைபெற்ற மஞ்சள் செய்கை வயல் விழா பற்றிய செய்தி.',
'PUBLISHED', 0, '2026-04-12 10:00:00', NOW(), NOW(), 'usr-ananthan', 'cat-seithigal'),

('art-8', 'ஆவரங்கால் சர்வோதய புதிய நிர்வாகத் தெரிவு', 'avarangal-sarvodaya-pudhiya-nirvagam',
'<p>ஆவரங்கால் சர்வோதய சன சமூக நிலையத்தின் புதிய நிர்வாகத் தெரிவு 08.04.2026 அன்று 7.30 மணியளவில் நிலைய வளாகத்தில் நடைபெற்றது.</p><p>இந்த தேர்வில் புதிய நிர்வாகக் குழு தேர்ந்தெடுக்கப்பட்டது. சமூக மேம்பாட்டிற்கான பல்வேறு திட்டங்கள் விவாதிக்கப்பட்டன.</p>',
'ஆவரங்கால் சர்வோதய நிலையத்தின் புதிய நிர்வாகத் தெரிவு நடைபெற்றது.',
'PUBLISHED', 0, '2026-04-11 10:00:00', NOW(), NOW(), 'usr-ananthan', 'cat-seithigal'),

('art-9', 'மூட்டுவலி (கீல்வாதம்) பற்றிய முழுமையான தகவல்கள்', 'moottuvalai-keelvaatham-thagavalkal',
'<p>மூட்டுவலி அல்லது கீல்வாதம் என்பது மூட்டுகளில் ஏற்படும் வீக்கம் மற்றும் வலியை குறிக்கும் ஒரு நிலை ஆகும்.</p><p>இந்த நோயின் அறிகுறிகள், காரணங்கள், மற்றும் சிகிச்சை முறைகள் பற்றி விரிவாக அறிந்து கொள்வோம்.</p><p>உடற்பயிற்சி, சரியான உணவுப் பழக்கம், மற்றும் மருத்துவ ஆலோசனை மூலம் இந்த நோயை கட்டுப்படுத்தலாம்.</p>',
'மூட்டுவலி (கீல்வாதம்) பற்றிய அறிகுறிகள், காரணங்கள் மற்றும் சிகிச்சை முறைகள்.',
'PUBLISHED', 0, '2025-08-26 10:00:00', NOW(), NOW(), 'usr-vasel', 'cat-udal'),

('art-10', 'வாட்ஸ்அப்பில் தடுக்கப்பட்டுள்ளீர்களா? சரிபார்க்க வழிகள்', 'whatsapp-thadukkappatulleergala-vazhigal',
'<p>வாட்ஸ்அப் பயன்பாட்டில் நீங்கள் தடுக்கப்பட்டுள்ளீர்களா என்பதை சரிபார்க்க சில எளிய வழிகள் உள்ளன.</p><p>இந்த கட்டுரையில் வாட்ஸ்அப்பில் தடுக்கப்பட்டுள்ளீர்களா என்பதை கண்டறிய உதவும் படிகளை விளக்குகிறோம்.</p>',
'வாட்ஸ்அப்பில் தடுக்கப்பட்டுள்ளீர்களா என்பதை சரிபார்க்கும் வழிகள்.',
'PUBLISHED', 0, '2023-05-08 10:00:00', NOW(), NOW(), 'usr-vasel', 'cat-thozhil'),

('art-11', 'இனிய தமிழ் புத்தாண்டு நல்வாழ்த்துக்கள்!', 'iniya-tamil-puthandu-nalvaazhthukkal',
'<p>அனைத்து தமிழ் மக்களுக்கும் இனிய தமிழ் புத்தாண்டு நல்வாழ்த்துக்கள்!</p><p>இந்த புத்தாண்டு அனைவருக்கும் நல்வாழ்வும், நலமும், வளமும் தரட்டும்.</p>',
'அனைத்து தமிழ் மக்களுக்கும் இனிய தமிழ் புத்தாண்டு நல்வாழ்த்துக்கள்!',
'PUBLISHED', 0, '2026-04-14 06:00:00', NOW(), NOW(), 'usr-ananthan', 'cat-vaazhthu'),

('art-12', 'திருப்புகலூர் வர்த்தமானீசுவரர் திருக்கோவில்', 'thiruppugalur-varthamaaneesvarar-thirukovil',
'<p>அமைவிடம்: திருவாரூர் மாவட்டம் பேரளத்திலிருந்து மேற்கே ஏழு கிலோ மீட்டர் தொலைவிலும், மயிலாடுதுறையிலிருந்து 33 கிலோ மீட்டர் தொலைவிலும் அமைந்துள்ளது.</p><p>இந்த கோவிலில் சிவபெருமான் வர்த்தமானீசுவரர் என்ற பெயரில் அருள்பாலிக்கிறார்.</p>',
'திருவாரூர் மாவட்டத்தில் அமைந்துள்ள வர்த்தமானீசுவரர் திருக்கோவில் பற்றிய தகவல்கள்.',
'PUBLISHED', 0, '2026-04-09 09:00:00', NOW(), NOW(), 'usr-ananthan', 'cat-arindhu')
ON DUPLICATE KEY UPDATE title=VALUES(title);

INSERT INTO tags (id, name, slug, created_at) VALUES
('tag-kovil', 'கோவில்', 'kovil', NOW()),
('tag-varalaru', 'வரலாறு', 'varalaru', NOW()),
('tag-seithigal', 'செய்திகள்', 'seithigal-tag', NOW()),
('tag-udalnalam', 'உடல்நலம்', 'udalnalam', NOW()),
('tag-thozhilnutpam', 'தொழில்நுட்பம்', 'thozhilnutpam-tag', NOW())
ON DUPLICATE KEY UPDATE name=VALUES(name);

INSERT INTO article_tags (article_id, tag_id) VALUES
('art-1', 'tag-kovil'), ('art-1', 'tag-varalaru'),
('art-3', 'tag-kovil'), ('art-3', 'tag-varalaru'),
('art-4', 'tag-kovil'), ('art-4', 'tag-varalaru'),
('art-5', 'tag-kovil'), ('art-5', 'tag-varalaru'),
('art-12', 'tag-kovil'), ('art-12', 'tag-varalaru'),
('art-2', 'tag-seithigal'),
('art-6', 'tag-seithigal'),
('art-7', 'tag-seithigal'),
('art-8', 'tag-seithigal'),
('art-9', 'tag-udalnalam'),
('art-10', 'tag-thozhilnutpam')
ON DUPLICATE KEY UPDATE article_id=VALUES(article_id);

INSERT INTO media (id, filename, original_url, mime_type, size, image_data, created_at) VALUES
('img-1', 'temple-1.svg', '/api/media/img-1/image', 'image/svg+xml', 500,
CAST('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#e65100"/><stop offset="100%" style="stop-color:#ff8f00"/></linearGradient></defs><rect width="800" height="500" fill="url(#g1)"/><text x="400" y="220" text-anchor="middle" font-size="48" fill="white" font-family="sans-serif">🛕</text><text x="400" y="290" text-anchor="middle" font-size="28" fill="white" font-family="sans-serif" opacity="0.9">Temple Heritage</text></svg>' AS BINARY), NOW()),

('img-2', 'news-1.svg', '/api/media/img-2/image', 'image/svg+xml', 500,
CAST('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><defs><linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#1565c0"/><stop offset="100%" style="stop-color:#42a5f5"/></linearGradient></defs><rect width="800" height="500" fill="url(#g2)"/><text x="400" y="220" text-anchor="middle" font-size="48" fill="white" font-family="sans-serif">📰</text><text x="400" y="290" text-anchor="middle" font-size="28" fill="white" font-family="sans-serif" opacity="0.9">News Update</text></svg>' AS BINARY), NOW()),

('img-3', 'temple-2.svg', '/api/media/img-3/image', 'image/svg+xml', 500,
CAST('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><defs><linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#4a148c"/><stop offset="100%" style="stop-color:#7c43bd"/></linearGradient></defs><rect width="800" height="500" fill="url(#g3)"/><text x="400" y="220" text-anchor="middle" font-size="48" fill="white" font-family="sans-serif">🏛️</text><text x="400" y="290" text-anchor="middle" font-size="28" fill="white" font-family="sans-serif" opacity="0.9">Ancient Temple</text></svg>' AS BINARY), NOW()),

('img-4', 'temple-3.svg', '/api/media/img-4/image', 'image/svg+xml', 500,
CAST('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><defs><linearGradient id="g4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#b71c1c"/><stop offset="100%" style="stop-color:#e57373"/></linearGradient></defs><rect width="800" height="500" fill="url(#g4)"/><text x="400" y="220" text-anchor="middle" font-size="48" fill="white" font-family="sans-serif">⛩️</text><text x="400" y="290" text-anchor="middle" font-size="28" fill="white" font-family="sans-serif" opacity="0.9">Sacred Place</text></svg>' AS BINARY), NOW()),

('img-5', 'temple-4.svg', '/api/media/img-5/image', 'image/svg+xml', 500,
CAST('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><defs><linearGradient id="g5" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#00695c"/><stop offset="100%" style="stop-color:#4db6ac"/></linearGradient></defs><rect width="800" height="500" fill="url(#g5)"/><text x="400" y="220" text-anchor="middle" font-size="48" fill="white" font-family="sans-serif">🕌</text><text x="400" y="290" text-anchor="middle" font-size="28" fill="white" font-family="sans-serif" opacity="0.9">Holy Shrine</text></svg>' AS BINARY), NOW()),

('img-6', 'sports.svg', '/api/media/img-6/image', 'image/svg+xml', 500,
CAST('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><defs><linearGradient id="g6" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#f57f17"/><stop offset="100%" style="stop-color:#ffca28"/></linearGradient></defs><rect width="800" height="500" fill="url(#g6)"/><text x="400" y="220" text-anchor="middle" font-size="48" fill="white" font-family="sans-serif">🏆</text><text x="400" y="290" text-anchor="middle" font-size="28" fill="white" font-family="sans-serif" opacity="0.9">Sports &amp; Games</text></svg>' AS BINARY), NOW()),

('img-7', 'farming.svg', '/api/media/img-7/image', 'image/svg+xml', 500,
CAST('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><defs><linearGradient id="g7" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#33691e"/><stop offset="100%" style="stop-color:#7cb342"/></linearGradient></defs><rect width="800" height="500" fill="url(#g7)"/><text x="400" y="220" text-anchor="middle" font-size="48" fill="white" font-family="sans-serif">🌾</text><text x="400" y="290" text-anchor="middle" font-size="28" fill="white" font-family="sans-serif" opacity="0.9">Agriculture</text></svg>' AS BINARY), NOW()),

('img-8', 'community.svg', '/api/media/img-8/image', 'image/svg+xml', 500,
CAST('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><defs><linearGradient id="g8" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#283593"/><stop offset="100%" style="stop-color:#5c6bc0"/></linearGradient></defs><rect width="800" height="500" fill="url(#g8)"/><text x="400" y="220" text-anchor="middle" font-size="48" fill="white" font-family="sans-serif">🤝</text><text x="400" y="290" text-anchor="middle" font-size="28" fill="white" font-family="sans-serif" opacity="0.9">Community</text></svg>' AS BINARY), NOW()),

('img-9', 'health.svg', '/api/media/img-9/image', 'image/svg+xml', 500,
CAST('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><defs><linearGradient id="g9" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#c62828"/><stop offset="100%" style="stop-color:#ef5350"/></linearGradient></defs><rect width="800" height="500" fill="url(#g9)"/><text x="400" y="220" text-anchor="middle" font-size="48" fill="white" font-family="sans-serif">🏥</text><text x="400" y="290" text-anchor="middle" font-size="28" fill="white" font-family="sans-serif" opacity="0.9">Health &amp; Wellness</text></svg>' AS BINARY), NOW()),

('img-10', 'tech.svg', '/api/media/img-10/image', 'image/svg+xml', 500,
CAST('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><defs><linearGradient id="g10" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#0d47a1"/><stop offset="100%" style="stop-color:#2196f3"/></linearGradient></defs><rect width="800" height="500" fill="url(#g10)"/><text x="400" y="220" text-anchor="middle" font-size="48" fill="white" font-family="sans-serif">📱</text><text x="400" y="290" text-anchor="middle" font-size="28" fill="white" font-family="sans-serif" opacity="0.9">Technology</text></svg>' AS BINARY), NOW()),

('img-11', 'newyear.svg', '/api/media/img-11/image', 'image/svg+xml', 500,
CAST('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><defs><linearGradient id="g11" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#e65100"/><stop offset="100%" style="stop-color:#ffd54f"/></linearGradient></defs><rect width="800" height="500" fill="url(#g11)"/><text x="400" y="220" text-anchor="middle" font-size="48" fill="white" font-family="sans-serif">🎉</text><text x="400" y="290" text-anchor="middle" font-size="28" fill="white" font-family="sans-serif" opacity="0.9">Celebrations</text></svg>' AS BINARY), NOW()),

('img-12', 'temple-5.svg', '/api/media/img-12/image', 'image/svg+xml', 500,
CAST('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><defs><linearGradient id="g12" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#4e342e"/><stop offset="100%" style="stop-color:#8d6e63"/></linearGradient></defs><rect width="800" height="500" fill="url(#g12)"/><text x="400" y="220" text-anchor="middle" font-size="48" fill="white" font-family="sans-serif">🛕</text><text x="400" y="290" text-anchor="middle" font-size="28" fill="white" font-family="sans-serif" opacity="0.9">Heritage Site</text></svg>' AS BINARY), NOW())
ON DUPLICATE KEY UPDATE filename=VALUES(filename);

UPDATE articles SET featured_image = '/api/media/img-1/image' WHERE id = 'art-1';
UPDATE articles SET featured_image = '/api/media/img-2/image' WHERE id = 'art-2';
UPDATE articles SET featured_image = '/api/media/img-3/image' WHERE id = 'art-3';
UPDATE articles SET featured_image = '/api/media/img-4/image' WHERE id = 'art-4';
UPDATE articles SET featured_image = '/api/media/img-5/image' WHERE id = 'art-5';
UPDATE articles SET featured_image = '/api/media/img-6/image' WHERE id = 'art-6';
UPDATE articles SET featured_image = '/api/media/img-7/image' WHERE id = 'art-7';
UPDATE articles SET featured_image = '/api/media/img-8/image' WHERE id = 'art-8';
UPDATE articles SET featured_image = '/api/media/img-9/image' WHERE id = 'art-9';
UPDATE articles SET featured_image = '/api/media/img-10/image' WHERE id = 'art-10';
UPDATE articles SET featured_image = '/api/media/img-11/image' WHERE id = 'art-11';
UPDATE articles SET featured_image = '/api/media/img-12/image' WHERE id = 'art-12';

INSERT INTO obituaries (id, name, content, source_url, published_at, created_at) VALUES
('obit-001', 'வல்லிபுரம் சூரியபிரகாசம்',
'யாழ். புலோலி தெற்கு பருத்தித்துறையைப் பிறப்பிடமாகவும் வசிப்பிடமாகவும் கொண்ட திரு. வல்லிபுரம் சூரியபிரகாசம் அவர்கள் 15-03-2026 அன்று காலமானார். இவர் ஆலடியார் பரம்பரையைச் சேர்ந்தவர்.\n\nஅமரர் திரு வல்லிபுரம் மற்றும் அமரர் திருமதி தெய்வானை அவர்களின் மகனும்,\n\nஅமரர் துரைசிங்கம், அமரர் சீனிகுட்டி, அமரர் தங்கம், அமரர் சின்னபிள்ளை, அமரர் செல்வராஜா, அமரர் திருநாவுகரசு, அமரர் கிட்டினர், சந்திரபிரகாசம் ஆகியோரின் சகோதரனும்\n\nசூரியராஜினி நடராஜா மற்றும் சூரியவதனி பாக்கியானந்தன் தகப்பனாரும்\n\nதர்ஷிகா, தர்ஷிகன், தர்ஷனன், சூரியா, ஷொவ்மியா மற்றும் ஆருன் ஆகியோரின் பாட்டனாரும் ஆவார்.\n\nஇறுதிக் கிரிகைகள் பற்றிய விபரம் பின்னர் அறியத்தரம்படும்.',
'https://www.oorumuravum.today/2026/03/16/9541',
'2026-03-16 00:00:00', NOW())
ON DUPLICATE KEY UPDATE name=name;

INSERT INTO visitor_total (id, total) VALUES ('visitor-total', 0)
ON DUPLICATE KEY UPDATE total=total;

INSERT INTO advertisements (id, title, description, image_url, link_url, position, active, `order`, created_at, updated_at) VALUES
('ad-1', 'Sidebar Ad', 'Sample sidebar advertisement', NULL, 'https://example.com', 'sidebar', 1, 1, NOW(), NOW()),
('ad-2', 'Banner Ad', 'Sample banner advertisement', NULL, 'https://example.com', 'banner', 1, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE title=VALUES(title), active=VALUES(active), `order`=VALUES(`order`);
