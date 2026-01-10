import { useState, useEffect, useCallback } from 'react';

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

const STORAGE_KEY = 'watch-history';

export const useWatchHistory = () => {
  const [history, setHistory] = useState<Record<string, WatchProgress>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load watch history", e);
    }
  }, []);

  const updateProgress = (data: WatchProgress) => {
    setHistory((prev) => {
      // Merge with existing to preserve metadata if not passed in update
      const existing = prev[data.tmdbId] || {};
      const newHistory = {
        ...prev,
        [data.tmdbId]: { ...existing, ...data }
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
      return newHistory;
    });
  };

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
