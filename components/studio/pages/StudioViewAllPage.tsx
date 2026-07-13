import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { Movie } from '../../../types';
import { TmdbService } from '../../../services/tmdb';
import { StudioButton } from '../system/StudioButton';
import { StudioMediaCard } from '../media/StudioMediaCard';
import { StudioSkeleton } from '../system/StudioSkeleton';

interface StudioViewAllPageProps {
  title: string;
  fetchUrl?: string;
  initialMovies?: Movie[];
  forcedMediaType?: 'movie' | 'tv';
  onBack: () => void;
  onMovieSelect: (movie: Movie) => void;
  onPlay: (movie: Movie) => void;
  onAddToPlaylist: (movie: Movie) => void;
}

export const StudioViewAllPage: React.FC<StudioViewAllPageProps> = ({
  title,
  fetchUrl,
  initialMovies,
  forcedMediaType,
  onBack,
  onMovieSelect,
  onPlay,
  onAddToPlaylist,
}) => {
  const [movies, setMovies] = useState<Movie[]>(initialMovies || []);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(Boolean(fetchUrl) && !initialMovies);
  const [query, setQuery] = useState('');

  const loadPage = async (nextPage: number) => {
    if (!fetchUrl) return;
    setLoading(true);
    try {
      const separator = fetchUrl.includes('?') ? '&' : '?';
      const results = await TmdbService.getCategory(`${fetchUrl}${separator}page=${nextPage}`, forcedMediaType);
      setMovies(prev => nextPage === 1 ? results : [...prev, ...results]);
      setPage(nextPage);
      setHasMore(results.length > 0);
    } catch (error) {
      console.error('Failed to load Studio view-all page', error);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (initialMovies) {
      setMovies(initialMovies);
      setHasMore(false);
      setLoading(false);
      return;
    }

    if (fetchUrl) loadPage(1);
  }, [fetchUrl, initialMovies]);

  const filteredMovies = useMemo(() => (
    movies.filter(movie => movie.title.toLowerCase().includes(query.toLowerCase()))
  ), [movies, query]);

  return (
    <div className="pb-20">
      <div className="sticky top-20 z-40 mb-8 rounded-[var(--studio-radius-lg)] border border-white/9 bg-[#0c0c0e]/88 p-4 shadow-[0_16px_55px_rgba(0,0,0,0.42)] backdrop-blur-2xl md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <StudioButton type="button" size="icon" variant="ghost" onClick={onBack} aria-label="Back">
              <ArrowLeft size={22} />
            </StudioButton>
            <h1 className="min-w-0 truncate text-3xl font-black tracking-tight text-white md:text-5xl">{title}</h1>
          </div>
          <div className="relative w-full md:w-[420px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/36" size={18} />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={`Search in ${title}...`}
              className="h-12 w-full rounded-full border border-white/10 bg-black/28 pl-12 pr-4 text-sm text-white outline-none placeholder:text-white/32 focus:border-white/24"
            />
          </div>
        </div>
      </div>

      <div className={title === 'Continue Watching'
        ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        : 'grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'}>
        {filteredMovies.map(movie => (
          <StudioMediaCard
            key={`${movie.mediaType || 'movie'}-${movie.id}`}
            movie={movie}
            variant={title === 'Continue Watching' ? 'landscape' : 'poster'}
            onSelect={onMovieSelect}
            onPlay={onPlay}
            onAddToPlaylist={onAddToPlaylist}
          />
        ))}
      </div>

      {loading && (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, index) => <StudioSkeleton key={index} className="aspect-[2/3]" />)}
        </div>
      )}

      {!loading && filteredMovies.length === 0 && (
        <div className="py-24 text-center text-white/42">No results found</div>
      )}

      {hasMore && !loading && filteredMovies.length > 0 && (
        <div className="mt-10 flex justify-center">
          <StudioButton type="button" variant="glass" onClick={() => loadPage(page + 1)}>
            Load more
          </StudioButton>
        </div>
      )}
    </div>
  );
};
