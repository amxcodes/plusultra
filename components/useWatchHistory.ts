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
    };

    loadHistory();
  }, [user]);

  // Debounce ref to track pending saves
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep track of latest data for the timeout callback
  const latestDataRef = useRef<WatchProgress | null>(null);

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

    // Set new timeout (e.g. 5-10 seconds debounce)
    // This effectively "collects" timestamps and only sends the latest one periodically
    saveTimeoutRef.current = setTimeout(async () => {
      const currentData = latestDataRef.current;
      if (!currentData) return;

      const { error } = await supabase.rpc('update_watch_history', {
        p_user_id: user.id,
        p_tmdb_id: currentData.tmdbId.toString(),
        p_data: currentData
      });

      if (error) console.error('Error syncing history:', error);
      else console.log(`[Sync] Saved ${currentData.title} at ${Math.round(currentData.time)}s`);

    }, 10000); // 10 second debounce window
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        // Optional: Force save on unmount if needed, but risky with async in unmount
      }
    };
  }, []);

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

  return { history, updateProgress, getProgress, getContinueWatching };
};
