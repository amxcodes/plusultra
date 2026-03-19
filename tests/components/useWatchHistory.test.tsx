import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWatchHistory } from '../../components/useWatchHistory';
import { supabase } from '../../lib/supabase';

// Mock dependencies
const mockUser = { id: 'u1', email: 'test@test.com' };

vi.mock('../../lib/supabase', () => ({
    supabase: {
        rpc: vi.fn(),
        auth: {
            getUser: vi.fn(),
            onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
        },
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { watch_history: {} }, error: null })
        }))
    }
}));

// Mock AuthContext
vi.mock('../../lib/AuthContext', () => ({
    useAuth: () => ({
        user: mockUser,
        loading: false
    })
}));

// Mock idempotency to avoid random keys in tests
vi.mock('../../lib/idempotency', () => ({
    generateIdempotencyKey: () => 'mock-key'
}));

describe('useWatchHistory', () => {
    const flushInitialLoad = async () => {
        await act(async () => {
            await Promise.resolve();
        });
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        // Clear localStorage
        localStorage.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should initialize with empty history', async () => {
        const { result } = renderHook(() => useWatchHistory());
        await flushInitialLoad();
        expect(result.current.history).toEqual({});
    });

    it('should optimistic update history immediately', async () => {
        const { result } = renderHook(() => useWatchHistory());
        await flushInitialLoad();
        const movie = {
            tmdbId: '101',
            type: 'movie' as const,
            title: 'Test Movie',
            progress: 50,
            duration: 100,
            year: 2023,
            time: 50,
            lastUpdated: Date.now(),
            provider: 'tmdb'
        };

        act(() => {
            result.current.updateProgress(movie);
        });

        expect(result.current.history['101']).toEqual(movie);
    });

    it('should debounce sync to supabase', async () => {
        const { result } = renderHook(() => useWatchHistory());
        await flushInitialLoad();
        const movie = {
            tmdbId: '102',
            type: 'movie' as const,
            title: 'Debounce Test',
            progress: 10,
            duration: 100,
            year: 2023,
            time: 10,
            lastUpdated: Date.now(),
            provider: 'tmdb'
        };

        (supabase.rpc as any).mockResolvedValue({ error: null });

        // First update
        act(() => {
            result.current.updateProgress(movie);
        });

        // Advance but not enough
        await act(async () => {
            vi.advanceTimersByTime(2000);
        });
        expect(supabase.rpc).not.toHaveBeenCalled();

        // Second update (reset timer)
        act(() => {
            result.current.updateProgress({ ...movie, progress: 20, time: 20 });
        });

        // Advance again
        await act(async () => {
            vi.advanceTimersByTime(4000);
        });
        expect(supabase.rpc).not.toHaveBeenCalled();

        // Advance to trigger
        await act(async () => {
            vi.runAllTimers(); // Force flush
        });

        expect(supabase.rpc).toHaveBeenCalledTimes(1);
        expect(supabase.rpc).toHaveBeenCalledWith('update_watch_history_v2', {
            p_user_id: 'u1',
            p_tmdb_id: '102',
            p_data: expect.objectContaining({
                progress: 20,
                wrappedTitleKey: 'movie:102',
                wrappedUnitKey: 'movie:102',
                wrappedQualified: false
            }),
            p_idempotency_key: 'mock-key' // From mocked generator
        });
    });

    it('should save to localStorage on failure', async () => {
        const { result } = renderHook(() => useWatchHistory());
        await flushInitialLoad();
        const movie = {
            tmdbId: '103',
            type: 'movie' as const,
            title: 'Fail Test',
            progress: 30,
            duration: 100,
            year: 2023,
            time: 30,
            lastUpdated: Date.now(),
            provider: 'tmdb'
        };

        // Mock failure
        (supabase.rpc as any).mockResolvedValue({ error: { message: 'Network Error' } });

        act(() => {
            result.current.updateProgress(movie);
        });

        // Wait for debounce and async execution
        await act(async () => {
            await vi.runAllTimersAsync();
        });

        // RPC called
        expect(supabase.rpc).toHaveBeenCalled();

        // Check localStorage backup
        const key = `amx_pending_watch_history_u1`;
        const backup = localStorage.getItem(key);
        expect(backup).toBeTruthy();
    });

    it('should flush pending updates effectively', async () => {
        const { result } = renderHook(() => useWatchHistory());
        await flushInitialLoad();
        const movie = {
            tmdbId: '104',
            type: 'movie' as const,
            title: 'Flush Test',
            progress: 40,
            duration: 100,
            year: 2023,
            time: 40,
            lastUpdated: Date.now(),
            provider: 'tmdb'
        };

        (supabase.rpc as any).mockResolvedValue({ error: null });

        act(() => {
            result.current.updateProgress(movie);
        });

        // Flush immediately
        await act(async () => {
            await result.current.flushNow();
        });

        expect(supabase.rpc).toHaveBeenCalledTimes(1);
    });
});
