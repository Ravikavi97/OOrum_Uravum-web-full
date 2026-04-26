-- Seed data for Tamil News Platform
-- Based on content from oorumuravum.today

-- Site Settings
INSERT INTO site_settings (id, `key`, value, updated_at) VALUES
('set-1', 'siteTitle', 'OORUM URAVUM', NOW()),
('set-2', 'siteTagline', 'ஒன்று பட்டால் உண்டு வாழ்வு', NOW()),
('set-3', 'siteDescription', 'தமிழ் செய்திகள் — செய்திகள், அறிந்து கொள்வோம், உடல் நலம், தொழில்நுட்பம்', NOW())
ON DUPLICATE KEY UPDATE value=VALUES(value);

-- Admin User (password: admin123)
INSERT INTO users (id, email, password_hash, name, slug, role, bio, created_at, updated_at) VALUES
('usr-admin', 'admin@oorumuravum.today', '$2b$10$LQ7VxvBh8GQx5Kz5YJvOXeZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZ', 'Admin', 'admin', 'ADMIN', 'Platform administrator', NOW(), NOW()),
('usr-ananthan', 'ananthan@oorumuravum.today', '$2b$10$LQ7VxvBh8GQx5Kz5YJvOXeZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZ', 'Ananthan', 'ananthan', 'AUTHOR', 'Tamil news writer and temple historian', NOW(), NOW()),
('usr-vasel', 'vasel@oorumuravum.today', '$2b$10$LQ7VxvBh8GQx5Kz5YJvOXeZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZ', 'Mr. VASEL', 'mr-vasel', 'AUTHOR', 'Health and technology writer', NOW(), NOW())
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Categories
INSERT INTO categories (id, name, slug, description, parent_id, created_at, updated_at) VALUES
('cat-seithigal', 'செய்திகள்', 'seithigal', 'Latest Tamil news and current affairs', NULL, NOW(), NOW()),
('cat-arindhu', 'அறிந்து கொள்வோம்', 'arindhu-kolvom', 'Knowledge and educational articles', NULL, NOW(), NOW()),
('cat-udal', 'உடல் நலம்', 'udal-nalam', 'Health and wellness articles', NULL, NOW(), NOW()),
('cat-thozhil', 'தொழில்நுட்பம்', 'thozhilnutpam', 'Technology news and tips', NULL, NOW(), NOW()),
('cat-padaippu', 'படைப்பாக்கம்', 'padaippakkam', 'Creative works and arts', NULL, NOW(), NOW()),
('cat-vaazhthu', 'வாழ்த்துக்கள்', 'vaazhthukkal', 'Greetings and celebrations', NULL, NOW(), NOW())
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Articles (based on oorumuravum.today content, paraphrased)
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

-- Tags
INSERT INTO tags (id, name, slug, created_at) VALUES
('tag-kovil', 'கோவில்', 'kovil', NOW()),
('tag-varalaru', 'வரலாறு', 'varalaru', NOW()),
('tag-seithigal', 'செய்திகள்', 'seithigal-tag', NOW()),
('tag-udalnalam', 'உடல்நலம்', 'udalnalam', NOW()),
('tag-thozhilnutpam', 'தொழில்நுட்பம்', 'thozhilnutpam-tag', NOW())
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Article-Tag associations
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
