const STORAGE_PREFIX = 'desktop-auth-guard';
const BASE_LOCK_MS = 15_000;
const MAX_LOCK_MS = 10 * 60_000;

type GuardState = {
    failureCount: number;
    lockUntil: number;
    lastFailureAt: number;
};

const readState = (scope: string): GuardState => {
    if (typeof window === 'undefined') {
        return { failureCount: 0, lockUntil: 0, lastFailureAt: 0 };
    }

    try {
        const raw = window.localStorage.getItem(`${STORAGE_PREFIX}:${scope}`);
        if (!raw) {
            return { failureCount: 0, lockUntil: 0, lastFailureAt: 0 };
        }

        const parsed = JSON.parse(raw) as Partial<GuardState>;
        return {
            failureCount: Number(parsed.failureCount) || 0,
            lockUntil: Number(parsed.lockUntil) || 0,
            lastFailureAt: Number(parsed.lastFailureAt) || 0,
        };
    } catch {
        return { failureCount: 0, lockUntil: 0, lastFailureAt: 0 };
    }
};

const writeState = (scope: string, state: GuardState) => {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.setItem(`${STORAGE_PREFIX}:${scope}`, JSON.stringify(state));
};

export const getDesktopAuthLockRemainingMs = (scope: string) => {
    const state = readState(scope);
    return Math.max(0, state.lockUntil - Date.now());
};

export const registerDesktopAuthFailure = (scope: string) => {
    const previous = readState(scope);
    const now = Date.now();
    const failureCount = previous.lastFailureAt && now - previous.lastFailureAt > 30 * 60_000
        ? 1
        : previous.failureCount + 1;
    const multiplier = Math.max(0, failureCount - 1);
    const lockDuration = Math.min(MAX_LOCK_MS, BASE_LOCK_MS * (2 ** multiplier));

    writeState(scope, {
        failureCount,
        lockUntil: now + lockDuration,
        lastFailureAt: now,
    });

    return lockDuration;
};

export const clearDesktopAuthGuard = (scope: string) => {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.removeItem(`${STORAGE_PREFIX}:${scope}`);
};
