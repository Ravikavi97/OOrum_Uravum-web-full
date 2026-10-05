-- The publisher dashboard base64-encodes the `content` and `excerpt` fields as
-- 'b64:<base64>' so Tamil/HTML payloads get past the Imunify360 WAF, but the
-- backend stored that value verbatim. Those rows therefore rendered on the site as
-- one long unreadable base64 run instead of formatted Tamil text, which also made
-- article pages enormously wider than the viewport.
--
-- Decode the affected rows in place. SUBSTRING(..., 5) skips all four characters
-- of the 'b64:' prefix — position 4 is the ':' itself, which MySQL's FROM_BASE64
-- rejects outright rather than returning NULL. The WHERE clause additionally only
-- matches well-formed base64 (charset plus a length that is a multiple of four).
UPDATE `articles`
SET `content` = CONVERT(FROM_BASE64(SUBSTRING(`content`, 5)) USING utf8mb4)
WHERE `content` REGEXP '^b64:[A-Za-z0-9+/]+={0,2}$'
  AND MOD(CHAR_LENGTH(`content`) - 4, 4) = 0;

UPDATE `articles`
SET `excerpt` = CONVERT(FROM_BASE64(SUBSTRING(`excerpt`, 5)) USING utf8mb4)
WHERE `excerpt` REGEXP '^b64:[A-Za-z0-9+/]+={0,2}$'
  AND MOD(CHAR_LENGTH(`excerpt`) - 4, 4) = 0;

-- `obituaries.content` is encoded by the dashboard in the same way. No rows are
-- affected today; this keeps the repair correct if any appear later.
UPDATE `obituaries`
SET `content` = CONVERT(FROM_BASE64(SUBSTRING(`content`, 5)) USING utf8mb4)
WHERE `content` REGEXP '^b64:[A-Za-z0-9+/]+={0,2}$'
  AND MOD(CHAR_LENGTH(`content`) - 4, 4) = 0;
