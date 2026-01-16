/**
 * Simple Cache Utility with TTL (Time To Live)
 * Reduces Supabase egress by caching frequently accessed data
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number; // Time to live in milliseconds
}

class CacheManager {
    /**
     * Set cache with TTL
     * @param key Cache key
     * @param data Data to cache
     * @param ttlMinutes TTL in minutes (default: 5)
     * @param useSession Use sessionStorage instead of localStorage (cleared on tab close)
     */
    set<T>(key: string, data: T, ttlMinutes: number = 5, useSession: boolean = false): void {
        const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now(),
            ttl: ttlMinutes * 60 * 1000
        };

        const storage = useSession ? sessionStorage : localStorage;

        try {
            storage.setItem(key, JSON.stringify(entry));
        } catch (e) {
            console.warn(`Cache storage full for key: ${key}`);
            // Clear old entries and retry
            this.clearExpired();
            storage.setItem(key, JSON.stringify(entry));
        }
    }

    /**
     * Get cached data if not expired
     * @param key Cache key
     * @param useSession Use sessionStorage
     * @returns Cached data or null if expired/missing
     */
    get<T>(key: string, useSession: boolean = false): T | null {
        const storage = useSession ? sessionStorage : localStorage;
        const item = storage.getItem(key);

        if (!item) return null;

        try {
            const entry: CacheEntry<T> = JSON.parse(item);
            const now = Date.now();

            // Check if expired
            if (now - entry.timestamp > entry.ttl) {
                storage.removeItem(key);
                return null;
            }

            return entry.data;
        } catch (e) {
            console.warn(`Invalid cache entry for key: ${key}`);
            storage.removeItem(key);
            return null;
        }
    }

    /**
     * Invalidate specific cache key
     */
    invalidate(key: string, useSession: boolean = false): void {
        const storage = useSession ? sessionStorage : localStorage;
        storage.removeItem(key);
    }

    /**
     * Clear all expired cache entries
     */
    clearExpired(): void {
        const now = Date.now();

        [localStorage, sessionStorage].forEach(storage => {
            Object.keys(storage).forEach(key => {
                const item = storage.getItem(key);
                if (!item) return;

                try {
                    const entry: CacheEntry<any> = JSON.parse(item);
                    if (now - entry.timestamp > entry.ttl) {
                        storage.removeItem(key);
                    }
                } catch (e) {
                    // Not a cache entry, skip
                }
            });
        });
    }

    /**
     * Clear all cache (use on logout)
     */
    clearAll(): void {
        localStorage.clear();
        sessionStorage.clear();
    }
}

export const cache = new CacheManager();

// Cache keys (centralized for consistency)
export const CACHE_KEYS = {
    USER_PROFILE: 'user_profile',
    APP_SETTINGS: 'app_settings',
    FEATURED_MOVIES: 'featured_movies',
    FEATURED_PLAYLISTS: 'featured_playlists',
    COMMUNITY_STATS: 'community_stats'
} as const;
