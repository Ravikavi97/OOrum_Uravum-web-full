import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('cache', () => {
  let cache: typeof import('./cache');

  beforeEach(async () => {
    vi.resetModules();
    cache = await import('./cache');
    // Start clean
    await cache.disconnectCache();
  });

  afterEach(async () => {
    await cache.disconnectCache();
  });

  describe('TTL constants', () => {
    it('exports correct TTL values', () => {
      expect(cache.ARTICLE_TTL).toBe(300);
      expect(cache.CATEGORY_TTL).toBe(600);
      expect(cache.TAG_TTL).toBe(600);
      expect(cache.BREAKING_TTL).toBe(60);
      expect(cache.SEARCH_TTL).toBe(120);
      expect(cache.SETTINGS_TTL).toBe(3600);
    });
  });

  describe('getCached', () => {
    it('returns parsed JSON on cache hit', async () => {
      const data = { title: 'Test Article', id: 1 };
      await cache.setCached('articles:detail:test', data);
      const result = await cache.getCached<typeof data>('articles:detail:test');
      expect(result).toEqual(data);
    });

    it('returns null on cache miss', async () => {
      const result = await cache.getCached('articles:detail:missing');
      expect(result).toBeNull();
    });

    it('returns null for expired entries', async () => {
      // Set with a very short TTL then advance time
      vi.useFakeTimers();
      await cache.setCached('expire-key', 'value', 1); // 1 second TTL
      vi.advanceTimersByTime(2000); // advance 2 seconds
      const result = await cache.getCached('expire-key');
      expect(result).toBeNull();
      vi.useRealTimers();
    });
  });

  describe('setCached', () => {
    it('stores and retrieves JSON-serialized value', async () => {
      const data = { name: 'category' };
      await cache.setCached('categories:list', data, cache.CATEGORY_TTL);
      const result = await cache.getCached<typeof data>('categories:list');
      expect(result).toEqual(data);
    });

    it('uses ARTICLE_TTL as default TTL', async () => {
      vi.useFakeTimers();
      await cache.setCached('key', 'value');
      // Should still be available before 300s
      vi.advanceTimersByTime(299_000);
      const result = await cache.getCached('key');
      expect(result).toBe('value');
      // Should be expired after 300s
      vi.advanceTimersByTime(2_000);
      const expired = await cache.getCached('key');
      expect(expired).toBeNull();
      vi.useRealTimers();
    });
  });

  describe('addTagsToKey', () => {
    it('adds key to tag sets for later invalidation', async () => {
      await cache.setCached('articles:detail:slug1', { id: 1 });
      await cache.addTagsToKey('articles:detail:slug1', ['articles', 'home']);

      // Invalidating by tag should remove the key
      await cache.invalidateByTags(['articles']);
      const result = await cache.getCached('articles:detail:slug1');
      expect(result).toBeNull();
    });
  });

  describe('invalidateByPattern', () => {
    it('scans and deletes matching keys', async () => {
      await cache.setCached('articles:list:1', 'a');
      await cache.setCached('articles:list:2', 'b');
      await cache.setCached('articles:list:3', 'c');
      await cache.setCached('categories:list:1', 'x');

      await cache.invalidateByPattern('articles:list:*');

      expect(await cache.getCached('articles:list:1')).toBeNull();
      expect(await cache.getCached('articles:list:2')).toBeNull();
      expect(await cache.getCached('articles:list:3')).toBeNull();
      // Non-matching key should remain
      expect(await cache.getCached('categories:list:1')).toBe('x');
    });

    it('handles no matching keys gracefully', async () => {
      await cache.invalidateByPattern('nonexistent:*');
      // Should not throw
    });
  });

  describe('invalidateByTags', () => {
    it('deletes all keys associated with given tags', async () => {
      await cache.setCached('articles:list:1', 'a');
      await cache.setCached('articles:detail:slug1', 'b');
      await cache.setCached('breaking:articles', 'c');

      await cache.addTagsToKey('articles:list:1', ['articles']);
      await cache.addTagsToKey('articles:detail:slug1', ['articles']);
      await cache.addTagsToKey('breaking:articles', ['breaking']);
      await cache.addTagsToKey('articles:list:1', ['breaking']);

      await cache.invalidateByTags(['articles', 'breaking']);

      expect(await cache.getCached('articles:list:1')).toBeNull();
      expect(await cache.getCached('articles:detail:slug1')).toBeNull();
      expect(await cache.getCached('breaking:articles')).toBeNull();
    });

    it('handles empty tag sets gracefully', async () => {
      await cache.invalidateByTags(['empty-tag']);
      // Should not throw
    });
  });

  describe('disconnectCache', () => {
    it('clears all cached data', async () => {
      await cache.setCached('key1', 'val1');
      await cache.setCached('key2', 'val2');
      await cache.disconnectCache();
      expect(await cache.getCached('key1')).toBeNull();
      expect(await cache.getCached('key2')).toBeNull();
    });
  });

  describe('getClient', () => {
    it('returns null (no Redis dependency)', () => {
      expect(cache.getClient()).toBeNull();
    });
  });
});
