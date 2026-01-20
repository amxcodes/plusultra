/**
 * Idempotency Key Generator
 * Ensures mutations can be safely retried without creating duplicates
 */

/**
 * Generate a unique idempotency key for a mutation
 * Format: {action}_{userId}_{resourceId}_{timestamp}_{random}
 */
export const generateIdempotencyKey = (
    action: string,
    userId: string,
    resourceId?: string
): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const parts = [action, userId.substring(0, 8)];

    if (resourceId) {
        parts.push(resourceId.substring(0, 8));
    }

    parts.push(timestamp.toString(36), random);

    return parts.join('_');
};

/**
 * Storage for pending operations (used for retry tracking)
 * Key: idempotencyKey, Value: {status, result, timestamp}
 */
interface PendingOperation {
    status: 'pending' | 'success' | 'failed';
    result?: any;
    error?: string;
    timestamp: number;
}

class IdempotencyStore {
    private pending: Map<string, PendingOperation> = new Map();
    private readonly TTL_MS = 60000; // 1 minute TTL for pending operations

    /**
     * Check if an operation is already in progress or completed
     * Returns the cached result if available
     */
    check(key: string): PendingOperation | null {
        const entry = this.pending.get(key);
        if (!entry) return null;

        // Check if expired
        if (Date.now() - entry.timestamp > this.TTL_MS) {
            this.pending.delete(key);
            return null;
        }

        return entry;
    }

    /**
     * Mark an operation as pending
     */
    markPending(key: string): void {
        this.pending.set(key, {
            status: 'pending',
            timestamp: Date.now()
        });
    }

    /**
     * Mark an operation as successful with result
     */
    markSuccess(key: string, result: any): void {
        this.pending.set(key, {
            status: 'success',
            result,
            timestamp: Date.now()
        });
    }

    /**
     * Mark an operation as failed with error
     */
    markFailed(key: string, error: string): void {
        this.pending.set(key, {
            status: 'failed',
            error,
            timestamp: Date.now()
        });
    }

    /**
     * Clear an operation from the store
     */
    clear(key: string): void {
        this.pending.delete(key);
    }

    /**
     * Clear all pending operations (e.g., on logout)
     */
    clearAll(): void {
        this.pending.clear();
    }
}

export const idempotencyStore = new IdempotencyStore();

/**
 * Wrapper for idempotent operations
 * Automatically handles retry detection and result caching
 */
export const withIdempotency = async <T>(
    key: string,
    operation: () => Promise<T>
): Promise<T> => {
    // Check if operation is already in progress or completed
    const existing = idempotencyStore.check(key);

    if (existing) {
        if (existing.status === 'pending') {
            throw new Error('Operation already in progress. Please wait.');
        }
        if (existing.status === 'success') {
            return existing.result as T;
        }
        // If failed, allow retry
    }

    // Mark as pending
    idempotencyStore.markPending(key);

    try {
        const result = await operation();
        idempotencyStore.markSuccess(key, result);
        return result;
    } catch (error: any) {
        idempotencyStore.markFailed(key, error.message);
        throw error;
    }
};
