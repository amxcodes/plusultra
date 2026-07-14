import React, { useEffect, useState } from 'react';
import { BookmarkPlus, Info, Play, Star } from 'lucide-react';
import { HeroMovie, Movie } from '../../../types';
import { StudioBadge } from '../system/StudioBadge';
import { StudioButton } from '../system/StudioButton';
import { getUiPreferences, subscribeToUiPreferences, UiPreferences } from '../../../lib/uiPreferences';

interface StudioHeroProps {
  movie: HeroMovie | null;
  onPlay?: (movie: Movie) => void;
  onInfo: (movie: Movie) => void;
  onAddToPlaylist?: (movie: Movie) => void;
}

export const StudioHero: React.FC<StudioHeroProps> = ({ movie, onPlay, onInfo, onAddToPlaylist }) => {
  const [preferences, setPreferences] = useState<UiPreferences>(() => getUiPreferences());

  useEffect(() => subscribeToUiPreferences(setPreferences), []);

  if (!movie) {
    return (
      <section className="relative h-[82vh] min-h-[620px] overflow-hidden bg-black">
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/20" />
        <div className="relative z-10 flex h-full max-w-[1500px] flex-col justify-center px-6 md:mx-auto md:px-8">
          <div className="mb-5 h-20 w-72 animate-pulse rounded-2xl bg-white/[0.06]" />
          <div className="mb-5 h-5 w-96 max-w-full animate-pulse rounded-full bg-white/[0.05]" />
          <div className="h-11 w-48 animate-pulse rounded-full bg-white/[0.06]" />
        </div>
      </section>
    );
  }

  const backdrop = movie.backdropUrl || movie.imageUrl;
  const runtime = typeof movie.duration === 'number' ? `${Math.floor(movie.duration / 60)}h ${movie.duration % 60}m` : movie.duration;
  const score = movie.match >= 1 ? (movie.match > 10 ? `${Math.round(movie.match)}%` : `${movie.match.toFixed(1)}/10`) : null;
  const trailerPreviewEnabled = preferences.heroPreviewMotion && !preferences.reduceMotion && movie.trailerKey && movie.trailerSite === 'YouTube';
  const trailerPreviewUrl = trailerPreviewEnabled
    ? `https://www.youtube-nocookie.com/embed/${movie.trailerKey}?autoplay=1&mute=1&controls=0&playsinline=1&loop=1&playlist=${movie.trailerKey}&modestbranding=1&rel=0&disablekb=1&fs=0`
    : null;

  return (
    <section className="relative h-[82vh] min-h-[620px] overflow-hidden bg-black md:h-[90vh]">
      {trailerPreviewUrl ? (
        <iframe
          src={trailerPreviewUrl}
          title={`${movie.title} trailer preview`}
          className="studio-hero-trailer absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 border-0 opacity-70"
          allow="autoplay; encrypted-media; picture-in-picture"
          tabIndex={-1}
          aria-hidden="true"
        />
      ) : backdrop && (
        <img
          src={backdrop}
          alt={movie.title}
          className="studio-hero-mask absolute inset-0 h-full w-full object-cover object-center opacity-90"
        />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_45%,rgba(255,255,255,0.08),transparent_34%),linear-gradient(to_top,#000_4%,rgba(0,0,0,0.72)_35%,rgba(0,0,0,0.22)_100%)]" />

      <div className="relative z-10 mx-auto flex h-full max-w-[1500px] flex-col justify-end px-5 pb-24 pt-28 md:px-8 md:pb-28 md:pt-32">
        <div className="max-w-2xl">
          <h1 className="line-clamp-2 min-h-[5.7rem] max-w-[780px] break-words text-5xl font-black leading-[0.95] tracking-normal text-white drop-shadow-2xl md:min-h-[8.15rem] md:text-6xl lg:text-7xl">
            {movie.title}
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {score && (
              <StudioBadge tone="accent">
                <Star size={12} fill="currentColor" />
                {score}
              </StudioBadge>
            )}
            {movie.year && <StudioBadge>{movie.year}</StudioBadge>}
            {runtime && <StudioBadge>{runtime}</StudioBadge>}
            {movie.mediaType && <StudioBadge>{movie.mediaType === 'tv' ? 'Series' : 'Movie'}</StudioBadge>}
          </div>

          {movie.description && (
            <p className="mt-5 line-clamp-3 min-h-[4.5rem] max-w-xl text-sm leading-6 text-white/76 md:line-clamp-4 md:min-h-[7rem] md:text-base md:leading-7">
              {movie.description}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {onPlay && (
              <StudioButton variant="glass" size="md" onClick={() => onPlay(movie as Movie)} className="h-11 px-5">
                <Play size={17} fill="currentColor" />
                Play
              </StudioButton>
            )}
            <div className="studio-control-glass studio-hero-action-group" role="group" aria-label="Title actions">
              <button type="button" onClick={() => onInfo(movie as Movie)} aria-label="View details" title="View details">
                <Info size={18} />
              </button>
              {onAddToPlaylist && (
                <>
                  <span className="studio-hero-action-group__divider" />
                  <button type="button" onClick={() => onAddToPlaylist(movie as Movie)} aria-label="Add to playlist" title="Add to playlist">
                    <BookmarkPlus size={18} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
