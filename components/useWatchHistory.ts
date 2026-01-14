import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

export interface WatchProgress {
  tmdbId: string;
  type: 'movie' | 'tv';
  season?: number;
  episode?: number;
  time: number;       // Current playback time in seconds
  duration: number;   // Total duration in seconds
  lastUpdated: number; // Timestamp
  provider: string;   // Which provider was used

  // Metadata for UI (to avoid re-fetching)
  title?: string;
  posterUrl?: string;
  voteAverage?: number;
  year?: number;
  backdropUrl?: string; // New: For movie cards
  episodeImage?: string; // New: For TV cards
  genres?: string[]; // Genre names for stats tracking
}

export const useWatchHistory = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState<Record<string, WatchProgress>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Load history from Supabase (Profile JSONB - Netflix-style)
  useEffect(() => {
    // If no user, not loading
    if (!user) {
      setIsLoading(false);
      return;
    }

    const loadHistory = async () => {
      try {
        // Single row fetch - extremely fast!
        const { data, error } = await supabase
          .from('profiles')
          .select('watch_history')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Failed to load watch history:', error);
          return;
        }

        // The watch_history column IS already a proper object
        if (data?.watch_history) {
          setHistory(data.watch_history as Record<string, WatchProgress>);
        }
      } catch (e) {
        console.error('Error loading history:', e);
      } finally {
        setIsLoading(false);
      }

      // Sync any pending localStorage backup FOR THIS USER
      const pendingKey = `amx_pending_watch_history_${user.id}`;
      const pending = localStorage.getItem(pendingKey);
      if (pending) {
        try {
          const pendingData: WatchProgress = JSON.parse(pending);
          console.log('[Sync] Found pending backup, syncing...');
          const success = await syncToSupabase(pendingData);
          if (success) {
            console.log('[Sync] Successfully synced pending backup');
            localStorage.removeItem(pendingKey);
          }
        } catch (err) {
          console.error('[Sync] Failed to parse pending backup:', err);
          localStorage.removeItem(pendingKey);
        }
      }

      // Cleanup: Remove old non-user-specific key (migration cleanup)
      localStorage.removeItem('amx_pending_watch_history');

      // Cleanup: Remove other users' pending data
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('amx_pending_watch_history_') && key !== pendingKey) {
          localStorage.removeItem(key);
        }
      });
    };

    loadHistory();
  }, [user]);

  // Debounce ref to track pending saves
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep track of latest data for the timeout callback
  const latestDataRef = useRef<WatchProgress | null>(null);

  // Sync to Supabase with retry logic (quieter logging)
  const syncToSupabase = async (data: WatchProgress, retries = 2): Promise<boolean> => {
    if (!user) return false;

    let lastError: any = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const { error } = await supabase.rpc('update_watch_history', {
          p_user_id: user.id,
          p_tmdb_id: data.tmdbId.toString(),
          p_data: data
        });

        if (!error) {
          // Only log on first successful save after failures
          if (attempt > 0) {
            console.log(`[Sync] ✓ Recovered - saved ${data.title}`);
          }
          localStorage.removeItem('amx_pending_watch_history');
          return true;
        }

        lastError = error;
      } catch (err) {
        lastError = err;
      }

      // Exponential backoff before retry
      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
      }
    }

    // Only log once after all retries failed
    if (lastError?.message?.includes('AbortError')) {
      // Silent fail for abort errors (common during navigation)
      const pendingKey = `amx_pending_watch_history_${user.id}`;
      localStorage.setItem(pendingKey, JSON.stringify(data));
    } else {
      console.warn('[Sync] Failed to save progress, using local backup.');
      const pendingKey = `amx_pending_watch_history_${user.id}`;
      localStorage.setItem(pendingKey, JSON.stringify(data));
    }
    return false;
  };

  const updateProgress = async (data: WatchProgress) => {
    // 1. Immediate Local Update (Fast/Optimistic)
    setHistory((prev) => ({
      ...prev,
      [data.tmdbId]: data
    }));

    // Update ref for the debounced caller
    latestDataRef.current = data;

    if (!user) return;

    // 2. Debounced Remote Update (Netflix-style efficient sync)
    // Clear existing timeout to reset the timer
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout (5 seconds debounce - reduced from 10s)
    saveTimeoutRef.current = setTimeout(async () => {
      const currentData = latestDataRef.current;
      if (!currentData) return;
      await syncToSupabase(currentData);
    }, 5000); // 5 second debounce window
  };

  // Cleanup on unmount - save to localStorage only (prevents infinite loop)
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Save to localStorage during unmount - no async, no state updates!
      const currentData = latestDataRef.current;
      if (currentData && user?.id) {
        try {
          const pendingKey = `amx_pending_watch_history_${user.id}`;
          localStorage.setItem(pendingKey, JSON.stringify(currentData));
        } catch (err) {
          // Ignore errors during unmount
        }
      }
    };
  }, [user]);

  const getProgress = (tmdbId: string) => {
    return history[tmdbId];
  };

  const getContinueWatching = useCallback((): WatchProgress[] => {
    const threshold = 10;
    const items = Object.values(history) as WatchProgress[];

    return items
      .filter(item => {
        const progress = item.duration > 0 ? (item.time / item.duration) : 0;
        return item.time > threshold && progress < 0.95;
      })
      .sort((a, b) => b.lastUpdated - a.lastUpdated);
  }, [history]);

  return { history, updateProgress, getProgress, getContinueWatching, isLoading };
};
