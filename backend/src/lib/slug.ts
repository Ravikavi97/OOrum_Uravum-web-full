import { prisma } from './prisma';

// ─── Tamil-to-Latin Transliteration Map ──────────────────────────────────────

// Tamil vowels (உயிர் எழுத்துக்கள்)
const TAMIL_VOWELS: Record<string, string> = {
  '\u0B85': 'a',    // அ
  '\u0B86': 'aa',   // ஆ
  '\u0B87': 'i',    // இ
  '\u0B88': 'ii',   // ஈ
  '\u0B89': 'u',    // உ
  '\u0B8A': 'uu',   // ஊ
  '\u0B8E': 'e',    // எ
  '\u0B8F': 'ee',   // ஏ
  '\u0B90': 'ai',   // ஐ
  '\u0B92': 'o',    // ஒ
  '\u0B93': 'oo',   // ஓ
  '\u0B94': 'au',   // ஔ
};

// Tamil consonants (மெய் எழுத்துக்கள்) — base form with inherent 'a'
const TAMIL_CONSONANTS: Record<string, string> = {
  '\u0B95': 'ka',   // க
  '\u0B99': 'nga',  // ங
  '\u0B9A': 'sa',   // ச
  '\u0B9C': 'ja',   // ஜ
  '\u0B9E': 'nya',  // ஞ
  '\u0B9F': 'ta',   // ட
  '\u0BA3': 'na',   // ண
  '\u0BA4': 'tha',  // த
  '\u0BA8': 'na',   // ந
  '\u0BAA': 'pa',   // ப
  '\u0BAE': 'ma',   // ம
  '\u0BAF': 'ya',   // ய
  '\u0BB0': 'ra',   // ர
  '\u0BB2': 'la',   // ல
  '\u0BB5': 'va',   // வ
  '\u0BB4': 'zha',  // ழ
  '\u0BB3': 'la',   // ள
  '\u0BB1': 'ra',   // ற
  '\u0BA9': 'na',   // ன
  '\u0BB6': 'sha',  // ஶ
  '\u0BB7': 'sha',  // ஷ
  '\u0BB8': 'sa',   // ஸ
  '\u0BB9': 'ha',   // ஹ
};

// Consonant base forms (without inherent vowel) for combining with vowel signs
const TAMIL_CONSONANT_BASES: Record<string, string> = {
  '\u0B95': 'k',    // க
  '\u0B99': 'ng',   // ங
  '\u0B9A': 's',    // ச
  '\u0B9C': 'j',    // ஜ
  '\u0B9E': 'ny',   // ஞ
  '\u0B9F': 't',    // ட
  '\u0BA3': 'n',    // ண
  '\u0BA4': 'th',   // த
  '\u0BA8': 'n',    // ந
  '\u0BAA': 'p',    // ப
  '\u0BAE': 'm',    // ம
  '\u0BAF': 'y',    // ய
  '\u0BB0': 'r',    // ர
  '\u0BB2': 'l',    // ல
  '\u0BB5': 'v',    // வ
  '\u0BB4': 'zh',   // ழ
  '\u0BB3': 'l',    // ள
  '\u0BB1': 'r',    // ற
  '\u0BA9': 'n',    // ன
  '\u0BB6': 'sh',   // ஶ
  '\u0BB7': 'sh',   // ஷ
  '\u0BB8': 's',    // ஸ
  '\u0BB9': 'h',    // ஹ
};

// Tamil vowel signs (matras) that modify consonants
const TAMIL_VOWEL_SIGNS: Record<string, string> = {
  '\u0BBE': 'aa',   // ா
  '\u0BBF': 'i',    // ி
  '\u0BC0': 'ii',   // ீ
  '\u0BC1': 'u',    // ு
  '\u0BC2': 'uu',   // ூ
  '\u0BC6': 'e',    // ெ
  '\u0BC7': 'ee',   // ே
  '\u0BC8': 'ai',   // ை
  '\u0BCA': 'o',    // ொ
  '\u0BCB': 'oo',   // ோ
  '\u0BCC': 'au',   // ௌ
};

// Pulli (virama) — removes inherent vowel from consonant
const TAMIL_PULLI = '\u0BCD'; // ்

// Tamil special characters
const TAMIL_SPECIAL: Record<string, string> = {
  '\u0BD0': 'om',   // ௐ
  '\u0B83': 'h',    // ஃ (Visarga / Aytham)
};

// ─── Transliteration ─────────────────────────────────────────────────────────

/**
 * Transliterate Tamil text to Latin characters.
 * Handles vowels, consonants, consonant+vowel-sign combinations, and pulli (virama).
 */
export function transliterateTamil(text: string): string {
  let result = '';
  const chars = [...text]; // spread to handle multi-byte correctly

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const nextChar = chars[i + 1];

    // Special characters (Aytham, Om)
    if (TAMIL_SPECIAL[char]) {
      result += TAMIL_SPECIAL[char];
      continue;
    }

    // Vowels (standalone)
    if (TAMIL_VOWELS[char]) {
      result += TAMIL_VOWELS[char];
      continue;
    }

    // Consonants — check what follows
    if (TAMIL_CONSONANT_BASES[char]) {
      if (nextChar === TAMIL_PULLI) {
        // Consonant + pulli = bare consonant (no inherent vowel)
        result += TAMIL_CONSONANT_BASES[char];
        i++; // skip the pulli
      } else if (nextChar && TAMIL_VOWEL_SIGNS[nextChar]) {
        // Consonant + vowel sign = consonant base + vowel sound
        result += TAMIL_CONSONANT_BASES[char] + TAMIL_VOWEL_SIGNS[nextChar];
        i++; // skip the vowel sign
      } else if (TAMIL_CONSONANTS[char]) {
        // Standalone consonant with inherent 'a'
        result += TAMIL_CONSONANTS[char];
      }
      continue;
    }

    // Non-Tamil characters pass through as-is
    result += char;
  }

  return result;
}

// ─── Slug Generation ─────────────────────────────────────────────────────────

/**
 * Convert any text to a URL-safe slug.
 * Lowercases, replaces non-alphanumeric chars with hyphens, collapses multiple hyphens,
 * and trims leading/trailing hyphens.
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate a URL-safe slug from a Tamil (or mixed) title.
 * First transliterates Tamil characters to Latin, then generates a slug.
 * Falls back to percent-encoded Unicode if transliteration produces an empty result.
 */
export function generateTamilSlug(title: string): string {
  const transliterated = transliterateTamil(title);
  const slug = generateSlug(transliterated);

  if (slug.length > 0) {
    return slug;
  }

  // Fallback: percent-encode the original title for URL safety
  const encoded = encodeURIComponent(title.trim())
    .replace(/%20/g, '-')
    .replace(/[!'()*_.~]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return encoded || 'untitled';
}

// ─── Unique Slug with DB Check ───────────────────────────────────────────────

type SlugModel = 'article' | 'category' | 'tag' | 'user' | 'videoPost' | 'obituary';

/**
 * Check if a slug already exists in the given model's table.
 */
async function slugExists(slug: string, model: SlugModel): Promise<boolean> {
  let record: unknown;
  switch (model) {
    case 'article':
      record = await prisma.article.findUnique({ where: { slug } });
      break;
    case 'category':
      record = await prisma.category.findUnique({ where: { slug } });
      break;
    case 'tag':
      record = await prisma.tag.findUnique({ where: { slug } });
      break;
    case 'user':
      record = await prisma.user.findUnique({ where: { slug } });
      break;
    case 'videoPost':
      record = await prisma.videoPost.findUnique({ where: { slug } });
      break;
    case 'obituary':
      record = await prisma.obituary.findUnique({ where: { slug } });
      break;
    default:
      throw new Error(`Unknown model: ${model}`);
  }
  return record !== null;
}

/**
 * Generate a unique slug by checking the database for existing slugs.
 * Appends -1, -2, etc. if the base slug already exists.
 */
export async function generateUniqueSlug(
  title: string,
  model: SlugModel,
): Promise<string> {
  const baseSlug = generateTamilSlug(title);

  if (!(await slugExists(baseSlug, model))) {
    return baseSlug;
  }

  // Find next available suffix
  let counter = 1;
  while (true) {
    const candidateSlug = `${baseSlug}-${counter}`;
    if (!(await slugExists(candidateSlug, model))) {
      return candidateSlug;
    }
    counter++;
  }
}

// ─── Slug Validation ─────────────────────────────────────────────────────────

/**
 * Validate that a slug contains only URL-safe characters:
 * lowercase letters, digits, hyphens, and percent-encoded sequences.
 */
export function isValidSlug(slug: string): boolean {
  if (!slug || slug.length === 0) {
    return false;
  }

  // Must not start or end with a hyphen
  if (slug.startsWith('-') || slug.endsWith('-')) {
    return false;
  }

  // Every character must be a-z, 0-9, hyphen, or part of a percent-encoded sequence (%XX)
  return /^(?:[a-z0-9\-]|%[0-9A-Fa-f]{2})+$/.test(slug)
    && !slug.startsWith('-')
    && !slug.endsWith('-')
    && !slug.includes('--');
}
