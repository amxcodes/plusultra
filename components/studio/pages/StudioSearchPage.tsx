import React, { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Movie } from '../../../types';
import { TmdbService } from '../../../services/tmdb';
import { useDebounce } from '../../../hooks/useDebounce';
import { StudioButton } from '../system/StudioButton';
import { StudioMediaCard } from '../media/StudioMediaCard';
import { StudioSkeleton } from '../system/StudioSkeleton';
import { GlassSurface } from '../system/GlassSurface';
import { getUiPreferences, subscribeToUiPreferences, UiPreferences } from '../../../lib/uiPreferences';
import { trackAnalyticsEvent } from '../../../lib/analyticsEvents';

interface StudioSearchPageProps {
  onClose: () => void;
  onMovieSelect: (movie: Movie) => void;
}

type StudioSearchType = 'multi' | 'movie' | 'tv';

const searchTabs: { value: StudioSearchType; label: string }[] = [
  { value: 'multi', label: 'All' },
  { value: 'movie', label: 'Movies' },
  { value: 'tv', label: 'Series' },
];

const quickTags = ['iron man', 'anime', 'thriller', 'k drama', 'marvel'];

const glassTuning = (preferences: UiPreferences) => {
  const intensity = {
    subtle: { backgroundOpacity: 0.025, saturation: 1.16, blur: 8 },
    standard: { backgroundOpacity: 0.045, saturation: 1.32, blur: 10 },
    strong: { backgroundOpacity: 0.07, saturation: 1.48, blur: 12 },
  }[preferences.glassIntensity];
  const refraction = {
    calm: { distortionScale: -28, redOffset: 1, greenOffset: 3, blueOffset: 5 },
    balanced: { distortionScale: -48, redOffset: 1, greenOffset: 5, blueOffset: 8 },
    deep: { distortionScale: -72, redOffset: 2, greenOffset: 8, blueOffset: 12 },
  }[preferences.glassRefraction];
  return { ...intensity, ...refraction };
};

export const StudioSearchPage: React.FC<StudioSearchPageProps> = ({ onClose, onMovieSelect }) => {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<StudioSearchType>('multi');
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const [selectingId, setSelectingId] = useState<number | null>(null);
  const [preferences, setPreferences] = useState<UiPreferences>(() => getUiPreferences());
  const debouncedQuery = useDebounce(query, 350);
  const glass = glassTuning(preferences);

  useEffect(() => subscribeToUiPreferences(setPreferences), []);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('studioRecentSearches') || '[]');
      if (Array.isArray(stored)) setRecents(stored.filter((item): item is string => typeof item === 'string').slice(0, 6));
    } catch {
      setRecents([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const trimmed = debouncedQuery.trim();

    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const startedAt = Date.now();
    TmdbService.search(trimmed, { type })
      .then(items => {
        if (!cancelled) {
          const nextResults = items.slice(0, 30);
          setResults(nextResults);
          trackAnalyticsEvent({
            eventName: 'search_performed',
            eventCategory: 'search',
            payload: {
              query: trimmed.slice(0, 120),
              searchType: type,
              resultCount: nextResults.length,
              durationMs: Date.now() - startedAt,
              surface: 'studio_overlay',
            },
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResults([]);
          trackAnalyticsEvent({
            eventName: 'search_failed',
            eventCategory: 'search',
            payload: {
              query: trimmed.slice(0, 120),
              searchType: type,
              durationMs: Date.now() - startedAt,
              surface: 'studio_overlay',
            },
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, type]);

  const hasQuery = query.trim().length > 0;
  const visibleRecents = useMemo(() => recents.filter(item => item.toLowerCase().includes(query.toLowerCase())).slice(0, 5), [query, recents]);

  const commitQuery = (value: string) => {
    const next = value.trim();
    if (!next) return;
    setQuery(next);
    trackAnalyticsEvent({
      eventName: 'search_committed',
      eventCategory: 'search',
      payload: {
        query: next.slice(0, 120),
        searchType: type,
        surface: 'studio_overlay',
      },
    });
    const updated = [next, ...recents.filter(item => item.toLowerCase() !== next.toLowerCase())].slice(0, 6);
    setRecents(updated);
    localStorage.setItem('studioRecentSearches', JSON.stringify(updated));
  };

  const selectMovie = (movie: Movie) => {
    setSelectingId(movie.id);
    commitQuery(query);
    trackAnalyticsEvent({
      eventName: 'search_result_clicked',
      eventCategory: 'search',
      tmdbId: movie.id,
      mediaType: movie.mediaType === 'tv' ? 'tv' : 'movie',
      payload: {
        query: query.trim().slice(0, 120),
        title: movie.title,
        resultMediaType: movie.mediaType || 'movie',
        surface: 'studio_overlay',
      },
      flush: true,
    });
    onMovieSelect(movie);
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/72 p-3 text-white backdrop-blur-md md:p-6">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,var(--studio-accent-soft),transparent_62%)] opacity-70" />
      <div className="sticky top-0 z-20 flex justify-end">
        <StudioButton size="icon" variant="glass" onClick={onClose} aria-label="Close search">
          <X size={18} />
        </StudioButton>
      </div>

      <div className="mx-auto max-w-[1280px] pb-16 pt-10 md:pt-14">
        <section className="p-2 md:p-5">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-4xl font-black tracking-tight text-white md:text-5xl">Search</div>
            <p className="mt-3 text-sm font-semibold text-white/42 md:text-base">Movies, series, and anything worth opening next.</p>
          </div>

          <div className="mx-auto mt-8 max-w-3xl">
            <GlassSurface
              width="100%"
              height={58}
              borderRadius={999}
              backgroundOpacity={glass.backgroundOpacity}
              saturation={glass.saturation}
              blur={glass.blur}
              distortionScale={glass.distortionScale}
              redOffset={glass.redOffset}
              greenOffset={glass.greenOffset}
              blueOffset={glass.blueOffset}
              className="studio-search-glass group rounded-full transition-colors focus-within:border-white/18"
            >
            <div className="flex h-full w-full items-center gap-3 px-3">
              <Search size={20} className="text-white/42 transition-colors group-focus-within:text-white" />
              <input
                autoFocus
                value={query}
                onChange={event => setQuery(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') commitQuery(query);
                }}
                placeholder="Search movies & tv..."
                className="min-w-0 flex-1 bg-transparent text-lg font-semibold text-white outline-none placeholder:text-white/30"
              />
              {hasQuery && (
                <button type="button" className="rounded-full p-2 text-white/42 hover:bg-white/8 hover:text-white" onClick={() => setQuery('')} aria-label="Clear search">
                  <X size={18} />
                </button>
              )}
            </div>
            </GlassSurface>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {searchTabs.map(tab => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setType(tab.value)}
                  className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
                    type === tab.value ? 'border-white/80 bg-white text-black' : 'border-white/10 bg-white/[0.045] text-white/58 hover:bg-white/[0.08] hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {!hasQuery && (
            <div className="mx-auto mt-8 max-w-3xl">
              {recents.length > 0 && (
                <div className="mb-5">
                  <div className="mb-3 text-center text-[11px] font-bold uppercase text-white/34">Recent</div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {visibleRecents.map(item => (
                      <button key={item} type="button" onClick={() => setQuery(item)} className="rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 text-sm font-semibold text-white/68 hover:bg-white/[0.08] hover:text-white">
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap justify-center gap-2">
                {quickTags.map(tag => (
                  <button key={tag} type="button" onClick={() => commitQuery(tag)} className="rounded-full bg-white/[0.055] px-4 py-2 text-sm font-semibold text-white/52 hover:bg-white/[0.09] hover:text-white">
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasQuery && (
            <div className="mt-10">
              {loading ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {Array.from({ length: 12 }).map((_, index) => <StudioSkeleton key={index} className="aspect-[2/3]" />)}
                </div>
              ) : results.length > 0 ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {results.map(movie => (
                    <div
                      key={`${movie.mediaType || 'movie'}-${movie.id}`}
                      className={selectingId === movie.id ? 'pointer-events-none opacity-70 transition-opacity' : undefined}
                    >
                      <StudioMediaCard movie={movie} onSelect={selectMovie} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[28px] border border-white/8 bg-white/[0.035] p-10 text-center text-white/45">
                  Nothing found for "{query}".
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
