import { describe, it, expect } from 'vitest';
import { transliterateTamil, generateSlug, generateTamilSlug, isValidSlug } from './slug';

/**
 * Unit tests for Tamil slug generator.
 *
 * **Validates: Requirements 1.6, 7.4, 7.7**
 */

describe('transliterateTamil', () => {
  it('should transliterate Tamil vowels', () => {
    // அ → a
    expect(transliterateTamil('அ')).toBe('a');
    // ஆ → aa
    expect(transliterateTamil('ஆ')).toBe('aa');
    // இ → i
    expect(transliterateTamil('இ')).toBe('i');
    // உ → u
    expect(transliterateTamil('உ')).toBe('u');
  });

  it('should transliterate standalone Tamil consonants with inherent "a"', () => {
    // க → ka
    expect(transliterateTamil('க')).toBe('ka');
    // ப → pa
    expect(transliterateTamil('ப')).toBe('pa');
    // ம → ma
    expect(transliterateTamil('ம')).toBe('ma');
    // த → tha
    expect(transliterateTamil('த')).toBe('tha');
  });

  it('should transliterate consonant + vowel sign combinations', () => {
    // கி = க + ி → ki
    expect(transliterateTamil('கி')).toBe('ki');
    // கு = க + ு → ku
    expect(transliterateTamil('கு')).toBe('ku');
    // பா = ப + ா → paa
    expect(transliterateTamil('பா')).toBe('paa');
    // மே = ம + ே → mee
    expect(transliterateTamil('மே')).toBe('mee');
  });

  it('should transliterate consonant + pulli (virama) to bare consonant', () => {
    // க் → k (pulli removes inherent vowel)
    expect(transliterateTamil('க்')).toBe('k');
    // ப் → p
    expect(transliterateTamil('ப்')).toBe('p');
    // ம் → m
    expect(transliterateTamil('ம்')).toBe('m');
  });

  it('should transliterate "தமிழ்" (Tamil)', () => {
    // த + ம + ி + ழ + ் → tha + m + i + zh = thamizh
    const result = transliterateTamil('தமிழ்');
    expect(result).toBe('thamizh');
  });

  it('should transliterate "செய்தி" (News)', () => {
    // ச + ெ + ய + ் + த + ி → s + e + y + th + i = seythii
    const result = transliterateTamil('செய்தி');
    expect(result).toBe('seythi');
  });

  it('should transliterate "நன்றி" (Thanks)', () => {
    // ந + ன + ் + ற + ி → na + n + r + i = nannri
    const result = transliterateTamil('நன்றி');
    expect(result).toBe('nanri');
  });

  it('should pass through Latin characters unchanged', () => {
    expect(transliterateTamil('hello')).toBe('hello');
    expect(transliterateTamil('test123')).toBe('test123');
  });

  it('should handle mixed Tamil and Latin text', () => {
    const result = transliterateTamil('தமிழ் news');
    expect(result).toBe('thamizh news');
  });

  it('should handle empty string', () => {
    expect(transliterateTamil('')).toBe('');
  });

  it('should transliterate special Tamil characters', () => {
    // ஃ (Aytham) → h
    expect(transliterateTamil('ஃ')).toBe('h');
  });
});

describe('generateSlug', () => {
  it('should convert Latin text to a URL-safe slug', () => {
    expect(generateSlug('Hello World')).toBe('hello-world');
  });

  it('should replace multiple spaces with a single hyphen', () => {
    expect(generateSlug('hello   world')).toBe('hello-world');
  });

  it('should remove special characters', () => {
    expect(generateSlug('hello! @world# $test')).toBe('hello-world-test');
  });

  it('should trim leading and trailing hyphens', () => {
    expect(generateSlug('  hello world  ')).toBe('hello-world');
  });

  it('should handle already-lowercase text', () => {
    expect(generateSlug('already lowercase')).toBe('already-lowercase');
  });

  it('should return empty string for non-alphanumeric input', () => {
    expect(generateSlug('!@#$%')).toBe('');
  });

  it('should handle numbers in text', () => {
    expect(generateSlug('Article 123 Title')).toBe('article-123-title');
  });
});

describe('generateTamilSlug', () => {
  it('should generate a slug from a Tamil title', () => {
    const slug = generateTamilSlug('தமிழ்');
    expect(slug).toBe('thamizh');
    expect(isValidSlug(slug)).toBe(true);
  });

  it('should generate a slug from a Tamil phrase', () => {
    const slug = generateTamilSlug('செய்தி தலைப்பு');
    // செய்தி → seythi, தலைப்பு → thalaaippu (space becomes hyphen)
    expect(slug.length).toBeGreaterThan(0);
    expect(isValidSlug(slug)).toBe(true);
    expect(slug).not.toContain(' ');
  });

  it('should generate a slug from Latin text', () => {
    expect(generateTamilSlug('Hello World')).toBe('hello-world');
  });

  it('should generate a slug from mixed Tamil and English text', () => {
    const slug = generateTamilSlug('தமிழ் News Platform');
    expect(slug.length).toBeGreaterThan(0);
    expect(isValidSlug(slug)).toBe(true);
    expect(slug).toContain('thamizh');
    expect(slug).toContain('news');
  });

  it('should return "untitled" for empty string', () => {
    expect(generateTamilSlug('')).toBe('untitled');
  });

  it('should return "untitled" for whitespace-only input', () => {
    expect(generateTamilSlug('   ')).toBe('untitled');
  });

  it('should return "untitled" for tab/newline-only input', () => {
    expect(generateTamilSlug('\t\n')).toBe('untitled');
  });

  it('should not produce consecutive hyphens', () => {
    const slug = generateTamilSlug('தமிழ்  -  செய்தி');
    expect(slug).not.toContain('--');
  });

  it('should not start or end with a hyphen', () => {
    const slug = generateTamilSlug(' தமிழ் ');
    expect(slug.startsWith('-')).toBe(false);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('should produce only URL-safe characters', () => {
    const slug = generateTamilSlug('தமிழ் செய்தி 2024');
    expect(slug).toMatch(/^(?:[a-z0-9\-]|%[0-9A-Fa-f]{2})+$/);
  });
});

describe('isValidSlug', () => {
  it('should return true for a simple lowercase slug', () => {
    expect(isValidSlug('hello-world')).toBe(true);
  });

  it('should return true for a slug with numbers', () => {
    expect(isValidSlug('article-123')).toBe(true);
  });

  it('should return true for a single word slug', () => {
    expect(isValidSlug('thamizh')).toBe(true);
  });

  it('should return true for a slug with percent-encoded characters', () => {
    expect(isValidSlug('thamizh-%E0%AE%A4')).toBe(true);
  });

  it('should return false for empty string', () => {
    expect(isValidSlug('')).toBe(false);
  });

  it('should return false for slug starting with hyphen', () => {
    expect(isValidSlug('-hello')).toBe(false);
  });

  it('should return false for slug ending with hyphen', () => {
    expect(isValidSlug('hello-')).toBe(false);
  });

  it('should return false for slug with consecutive hyphens', () => {
    expect(isValidSlug('hello--world')).toBe(false);
  });

  it('should return false for slug with uppercase letters', () => {
    expect(isValidSlug('Hello-World')).toBe(false);
  });

  it('should return false for slug with spaces', () => {
    expect(isValidSlug('hello world')).toBe(false);
  });

  it('should return false for slug with special characters', () => {
    expect(isValidSlug('hello@world')).toBe(false);
  });

  it('should return true for "untitled" (fallback slug)', () => {
    expect(isValidSlug('untitled')).toBe(true);
  });
});
