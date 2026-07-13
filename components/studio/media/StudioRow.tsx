import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Movie } from '../../../types';
import { TmdbService } from '../../../services/tmdb';
import { StudioCarousel, StudioCarouselItem } from '../system/StudioCarousel';
import { StudioMediaCard } from './StudioMediaCard';
import { StudioSkeleton } from '../system/StudioSkeleton';

interface StudioRowProps {
  title: string;
  fetchUrl?: string;
  movies?: Movie[];
  forcedMediaType?: 'movie' | 'tv';
  variant?: 'poster' | 'landscape';
  onMovieSelect: (movie: Movie) => void;
  onPlay?: (movie: Movie) => void;
  onViewAll?: () => void;
}

export const StudioRow: React.FC<StudioRowProps> = ({
  title,
  fetchUrl,
  movies,
  forcedMediaType,
  variant = 'poster',
  onMovieSelect,
  onPlay,
  onViewAll,
}) => {
  const [items, setItems] = useState<Movie[]>(movies || []);
  const [loading, setLoading] = useState(!movies && Boolean(fetchUrl));

  useEffect(() => {
    let cancelled = false;

    if (movies) {
      setItems(movies);
      setLoading(false);
      return;
    }

    if (!fetchUrl) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    TmdbService.getCategory(fetchUrl, forcedMediaType)
      .then(results => {
        if (!cancelled) setItems(results);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchUrl, forcedMediaType, movies]);

  if (!loading && items.length === 0) return null;

  return (
    <section className="py-3 md:py-5">
      <div className="mx-auto mb-1 flex max-w-[1500px] items-center justify-between px-4 md:px-8">
        <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">{title}</h2>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="inline-flex items-center gap-1 text-sm font-medium text-white/55 transition-colors hover:text-white"
          >
            View all <ChevronRight size={15} />
          </button>
        )}
      </div>

      <div className="mx-auto max-w-[1500px]">
        <StudioCarousel>
          {loading
            ? Array.from({ length: 12 }).map((_, index) => (
                <StudioCarouselItem key={index} className={variant === 'landscape' ? 'basis-[78%] sm:basis-[48%] md:basis-[34%] lg:basis-[26%]' : undefined}>
                  <StudioSkeleton className={variant === 'landscape' ? 'aspect-video' : 'aspect-[2/3]'} />
                </StudioCarouselItem>
              ))
            : items.map(movie => (
                <StudioCarouselItem key={`${movie.mediaType || 'movie'}-${movie.id}`} className={variant === 'landscape' ? 'basis-[78%] sm:basis-[48%] md:basis-[34%] lg:basis-[26%]' : undefined}>
                  <StudioMediaCard movie={movie} variant={variant} onSelect={onMovieSelect} onPlay={onPlay} />
                </StudioCarouselItem>
              ))}
        </StudioCarousel>
      </div>
    </section>
  );
};
