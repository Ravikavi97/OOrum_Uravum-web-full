-- Insert placeholder images as SVG bytes into the media table
-- and update articles to reference them via /api/media/{id}/image

-- Image 1: Temple (warm orange)
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

-- Update articles to reference the images
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
