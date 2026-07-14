import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Movie } from '../../../types';
import { TmdbService } from '../../../services/tmdb';
import { StudioCarousel, StudioCarouselItem } from '../system/StudioCarousel';
import { StudioDropdownContent, StudioDropdownItem, StudioDropdownRoot, StudioDropdownTrigger } from '../system/StudioControls';
import { StudioProvider, StudioProviderMark, studioProviders } from '../system/StudioProviderBrand';
import { StudioSkeleton } from '../system/StudioSkeleton';
import { StudioMediaCard } from './StudioMediaCard';

interface StudioProviderRowProps {
  mediaType: 'movie' | 'tv';
  onMovieSelect: (movie: Movie) => void;
  onPlay: (movie: Movie) => void;
  onAddToPlaylist: (movie: Movie) => void;
}

export const StudioProviderRow: React.FC<StudioProviderRowProps> = ({ mediaType, onMovieSelect, onPlay, onAddToPlaylist }) => {
  const [provider, setProvider] = useState<StudioProvider>(studioProviders[0]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const contentLabel = mediaType === 'movie' ? 'Movies' : 'Series';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void TmdbService.getByProvider(provider.id, mediaType)
      .then((results) => {
        if (!cancelled) setMovies(results);
      })
      .catch(() => {
        if (!cancelled) setMovies([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [mediaType, provider]);

  return (
    <section className="py-3 md:py-5">
      <div className="mx-auto mb-1 flex max-w-[1500px] items-center justify-between px-4 md:px-8">
        <div className="flex min-w-0 items-center gap-2 text-xl font-semibold tracking-normal text-white md:text-2xl">
          <span>{contentLabel} on</span>
          <StudioDropdownRoot modal={false}>
            <StudioDropdownTrigger asChild>
              <button type="button" className="studio-provider-row-trigger" aria-label={`Change ${contentLabel.toLowerCase()} provider`}>
                {provider.label}<ChevronDown size={16} />
              </button>
            </StudioDropdownTrigger>
            <StudioDropdownContent align="start" className="studio-provider-row-menu w-[192px]">
              {studioProviders.map((item) => (
                <StudioDropdownItem key={item.id} onClick={() => setProvider(item)} className={`studio-provider-row-menu__item ${item.id === provider.id ? 'bg-white/[0.1] text-white' : ''}`}>
                  <StudioProviderMark provider={item} className="studio-provider-row-menu__mark" />
                  <span className="flex-1 font-semibold">{item.label}</span>
                  {item.id === provider.id && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </StudioDropdownItem>
              ))}
            </StudioDropdownContent>
          </StudioDropdownRoot>
        </div>
        <span className="hidden text-sm font-semibold text-white/38 sm:inline">{provider.label}</span>
      </div>

      <div className="mx-auto max-w-[1500px]">
        <StudioCarousel>
          {loading
            ? Array.from({ length: 10 }).map((_, index) => (
                <StudioCarouselItem key={index}>
                  <StudioSkeleton className="aspect-[2/3]" />
                </StudioCarouselItem>
              ))
            : movies.map((movie) => (
                <StudioCarouselItem key={`${movie.mediaType || mediaType}-${movie.id}`}>
                  <StudioMediaCard movie={movie} onSelect={onMovieSelect} onPlay={onPlay} onAddToPlaylist={onAddToPlaylist} />
                </StudioCarouselItem>
              ))}
        </StudioCarousel>
      </div>
    </section>
  );
};
