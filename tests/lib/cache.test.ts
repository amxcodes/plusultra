import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CacheManager, CACHE_KEYS } from '../../lib/cache';

// Re-importing to check implementation details
import { cache } from '../../lib/cache';

describe('Cache Utility', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    it('should set and get values correctly', () => {
        const key = 'test-key';
        const value = { data: 123 };
        cache.set(key, value, 10); // 10 minutes

        const retrieved = cache.get(key);
        expect(retrieved).toEqual(value);
    });

    it('should return null for expired items', () => {
        const key = 'expired-key';
        const value = { data: 'old' };

        // Mock Date.now to control time
        vi.useFakeTimers();
        cache.set(key, value, 1); // 1 minute

        // Advance time by 2 minutes
        vi.advanceTimersByTime(2 * 60 * 1000);

        const retrieved = cache.get(key);
        expect(retrieved).toBeNull();

        vi.useRealTimers();
    });

    it('should handle quota exceeded by clearing old items', () => {
        const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

        // First successful set
        cache.set('key1', 'value1', 10);

        // Simulate quota exceeded
        setItemSpy.mockImplementationOnce(() => {
            throw new DOMException('QuotaExceededError', 'QuotaExceededError');
        });

        // This should trigger cleanup logic
        // We can't easily verify internal cleanup without exposing methods, 
        // but we can verify it doesn't crash.
        expect(() => cache.set('key2', 'value2', 10)).not.toThrow();
    });

    it('should clear specific keys', () => {
        cache.set('key1', 'val1', 10);
        cache.invalidate('key1');
        expect(cache.get('key1')).toBeNull();
    });

    it('should clear all app keys on clearAll', () => {
        cache.set(CACHE_KEYS.USER_PROFILE, 'profile', 10);
        cache.set('other', 'value', 10);

        cache.clearAll();

        expect(cache.get(CACHE_KEYS.USER_PROFILE)).toBeNull();
        // It might not clear 'other' if filter is strict, but usually it clears prefix.
    });
});
