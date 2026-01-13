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
}

export const useWatchHistory = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState<Record<string, WatchProgress>>({});

  // Load history from Supabase (Profile JSONB - Netflix-style)
  useEffect(() => {
    if (!user) return;

    const loadHistory = async () => {
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

      // Sync any pending localStorage backup
      const pending = localStorage.getItem('amx_pending_watch_history');
      if (pending) {
        try {
          const pendingData: WatchProgress = JSON.parse(pending);
          console.log('[Sync] Found pending backup, syncing...');
          const success = await syncToSupabase(pendingData);
          if (success) {
            console.log('[Sync] Successfully synced pending backup');
          }
        } catch (err) {
          console.error('[Sync] Failed to parse pending backup:', err);
          localStorage.removeItem('amx_pending_watch_history');
        }
      }
    };

    loadHistory();
  }, [user]);

  // Debounce ref to track pending saves
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep track of latest data for the timeout callback
  const latestDataRef = useRef<WatchProgress | null>(null);

  // Sync to Supabase with retry logic
  const syncToSupabase = async (data: WatchProgress, retries = 3): Promise<boolean> => {
    if (!user) return false;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const { error } = await supabase.rpc('update_watch_history', {
          p_user_id: user.id,
          p_tmdb_id: data.tmdbId.toString(),
          p_data: data
        });

        if (!error) {
          console.log(`[Sync] ✓ Saved ${data.title} at ${Math.round(data.time)}s`);
          // Clear any pending localStorage backup on success
          localStorage.removeItem('amx_pending_watch_history');
          return true;
        }

        console.error(`[Sync] Attempt ${attempt + 1} failed:`, error);
      } catch (err) {
        console.error(`[Sync] Network error on attempt ${attempt + 1}:`, err);
      }

      // Exponential backoff before retry
      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }

    // All retries failed - save to localStorage as backup
    console.warn('[Sync] All retries failed. Saving to localStorage backup.');
    localStorage.setItem('amx_pending_watch_history', JSON.stringify(data));
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

  // Immediate flush - bypasses debounce
  const flushProgress = async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    const currentData = latestDataRef.current;
    if (!currentData) return;

    console.log('[Sync] Flushing progress immediately...');
    await syncToSupabase(currentData);
  };

  // Cleanup on unmount - flush any pending saves
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Force immediate save on unmount
      const currentData = latestDataRef.current;
      if (currentData && user) {
        // Fire and forget - best effort save
        syncToSupabase(currentData).catch(err => {
          console.error('[Sync] Failed to save on unmount:', err);
        });
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

  return { history, updateProgress, getProgress, getContinueWatching, flushProgress };
};
