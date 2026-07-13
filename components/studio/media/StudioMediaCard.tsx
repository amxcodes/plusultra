import React from 'react';
import { BookmarkPlus, Play } from 'lucide-react';
import { Movie } from '../../../types';
import { cn } from '../../../lib/utils';
import { StudioBadge } from '../system/StudioBadge';
import { StudioButton } from '../system/StudioButton';

interface StudioMediaCardProps {
  movie: Movie;
  onSelect: (movie: Movie) => void;
  onPlay?: (movie: Movie) => void;
  variant?: 'poster' | 'landscape';
}

const getImage = (movie: Movie, variant: 'poster' | 'landscape') => (
  variant === 'landscape'
    ? movie.backdropUrl || movie.imageUrl || movie.posterUrl
    : movie.posterUrl || movie.imageUrl || movie.backdropUrl
);

export const StudioMediaCard: React.FC<StudioMediaCardProps> = ({ movie, onSelect, onPlay, variant = 'poster' }) => {
  const image = getImage(movie, variant);
  const progress = typeof movie.progress === 'number' ? Math.min(Math.max(movie.progress, 0), 1) : null;

  return (
    <article
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-[var(--studio-radius-md)] bg-white/[0.055] shadow-[0_14px_38px_rgba(0,0,0,0.34)] transition-[transform,filter] duration-300 hover:z-10 hover:scale-[1.035] hover:brightness-110',
        variant === 'landscape' ? 'aspect-video' : 'aspect-[2/3]'
      )}
      onClick={() => onSelect(movie)}
    >
      {image ? (
        <img src={image} alt={movie.title} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-white/[0.04] text-xs text-white/35">
          {movie.title}
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {progress !== null && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/12">
          <div className="h-full bg-[var(--studio-accent)]" style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      <button
        type="button"
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white/75 opacity-0 backdrop-blur-md transition-all hover:bg-white hover:text-black group-hover:opacity-100"
        onClick={(event) => {
          event.stopPropagation();
        }}
        aria-label="Add to list"
      >
        <BookmarkPlus size={14} />
      </button>

      <div className="absolute bottom-0 left-0 right-0 translate-y-3 p-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
        <div className="mb-2 line-clamp-2 text-sm font-semibold leading-tight text-white">{movie.title}</div>
        <div className="mb-3 flex items-center gap-1.5">
          {movie.year && <StudioBadge>{movie.year}</StudioBadge>}
          {movie.match > 0 && <StudioBadge tone="accent">{Math.round(movie.match)}%</StudioBadge>}
        </div>
        {onPlay && (
          <StudioButton
            type="button"
            size="sm"
            variant="primary"
            className="h-8"
            onClick={(event) => {
              event.stopPropagation();
              onPlay(movie);
            }}
          >
            <Play size={13} fill="currentColor" />
            Play
          </StudioButton>
        )}
      </div>
    </article>
  );
};
