import React from 'react';
import { BookmarkPlus, Info, Play, Star } from 'lucide-react';
import { HeroMovie, Movie } from '../../../types';
import { StudioBadge } from '../system/StudioBadge';
import { StudioButton } from '../system/StudioButton';

interface StudioHeroProps {
  movie: HeroMovie | null;
  onPlay: (movie: Movie) => void;
  onInfo: (movie: Movie) => void;
  onAddToPlaylist?: (movie: Movie) => void;
}

export const StudioHero: React.FC<StudioHeroProps> = ({ movie, onPlay, onInfo, onAddToPlaylist }) => {
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

  return (
    <section className="relative h-[82vh] min-h-[620px] overflow-hidden bg-black md:h-[90vh]">
      {backdrop && (
        <img
          src={backdrop}
          alt={movie.title}
          className="studio-hero-mask absolute inset-0 h-full w-full object-cover object-center opacity-90"
        />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_45%,rgba(255,255,255,0.08),transparent_34%),linear-gradient(to_top,#000_4%,rgba(0,0,0,0.72)_35%,rgba(0,0,0,0.22)_100%)]" />

      <div className="relative z-10 mx-auto flex h-full max-w-[1500px] flex-col justify-center px-5 pt-16 md:px-8">
        <div className="max-w-2xl">
          <h1 className="max-w-[760px] text-5xl font-black tracking-tight text-white drop-shadow-2xl md:text-7xl">
            {movie.title}
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {movie.match > 0 && (
              <StudioBadge tone="accent">
                <Star size={12} fill="currentColor" />
                {(movie.match / 10).toFixed(1)}/10
              </StudioBadge>
            )}
            {movie.year && <StudioBadge>{movie.year}</StudioBadge>}
            {runtime && <StudioBadge>{runtime}</StudioBadge>}
            {movie.mediaType && <StudioBadge>{movie.mediaType === 'tv' ? 'Series' : 'Movie'}</StudioBadge>}
          </div>

          {movie.description && (
            <p className="mt-5 max-w-xl text-sm leading-6 text-white/70 md:text-base md:leading-7">
              {movie.description}
            </p>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <StudioButton variant="primary" size="lg" onClick={() => onPlay(movie as Movie)}>
              <Play size={18} fill="currentColor" />
              Play
            </StudioButton>
            <StudioButton variant="glass" size="lg" onClick={() => onInfo(movie as Movie)}>
              <Info size={18} />
              Details
            </StudioButton>
            {onAddToPlaylist && (
              <StudioButton variant="subtle" size="icon" onClick={() => onAddToPlaylist(movie as Movie)} aria-label="Add to playlist">
                <BookmarkPlus size={18} />
              </StudioButton>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
