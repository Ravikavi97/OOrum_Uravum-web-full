-- Tamil News Platform: Full-Text Search Migration
--
-- This migration adds a FULLTEXT index on the articles table to enable
-- Tamil Unicode-aware full-text search across article titles, excerpts,
-- and content. The underlying table uses CHARACTER SET utf8mb4 with
-- utf8mb4_unicode_ci collation (set in the init migration), which ensures
-- proper tokenisation and matching of Tamil Unicode text (U+0B80–U+0BFF).
--
-- MariaDB's built-in FULLTEXT engine (Mroonga or InnoDB FTS) will index
-- these columns so that MATCH … AGAINST queries return relevance-ranked
-- results for Tamil keyword searches.

ALTER TABLE `articles`
  ADD FULLTEXT INDEX `articles_fulltext_idx` (`title`, `excerpt`, `content`);
