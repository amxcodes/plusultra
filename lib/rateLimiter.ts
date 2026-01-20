/**
 * Client-side Rate Limiter
 * Prevents abuse by throttling requests per action type
 */

interface RateLimitEntry {
    lastCall: number;
    count: number;
}

class RateLimiter {
    private limits: Map<string, RateLimitEntry> = new Map();

    /**
     * Check if action is allowed, throw if rate limited
     * @param action Action identifier (e.g., 'createRequest', 'submitReply')
     * @param cooldownMs Minimum time between calls in ms
     * @param maxBurst Maximum calls within cooldown window
     */
    check(action: string, cooldownMs: number = 2000, maxBurst: number = 3): void {
        const now = Date.now();
        const entry = this.limits.get(action);

        if (!entry) {
            // First call for this action
            this.limits.set(action, { lastCall: now, count: 1 });
            return;
        }

        const elapsed = now - entry.lastCall;

        if (elapsed < cooldownMs) {
            // Within cooldown window
            if (entry.count >= maxBurst) {
                const waitTime = Math.ceil((cooldownMs - elapsed) / 1000);
                throw new Error(`Please wait ${waitTime}s before trying again.`);
            }
            // Allow burst
            entry.count++;
            entry.lastCall = now;
        } else {
            // Cooldown expired, reset
            entry.lastCall = now;
            entry.count = 1;
        }
    }

    /**
     * Clear rate limit for an action (e.g., on success)
     */
    clear(action: string): void {
        this.limits.delete(action);
    }

    /**
     * Clear all rate limits (e.g., on logout)
     */
    clearAll(): void {
        this.limits.clear();
    }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

// Rate limit configurations per action
export const RATE_LIMITS = {
    CREATE_REQUEST: { cooldownMs: 5000, maxBurst: 2 },  // 2 requests per 5s
    SUBMIT_REPLY: { cooldownMs: 3000, maxBurst: 3 },    // 3 replies per 3s
    VOTE_REPLY: { cooldownMs: 1000, maxBurst: 5 },       // 5 votes per 1s
} as const;
