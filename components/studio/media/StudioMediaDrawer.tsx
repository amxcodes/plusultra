import React from 'react';
import { BookmarkPlus, Play, Star } from 'lucide-react';
import { Movie } from '../../../types';
import { StudioBadge } from '../system/StudioBadge';
import { StudioButton } from '../system/StudioButton';
import { StudioDrawerContent, StudioDrawerRoot, StudioDrawerTitle, StudioDrawerX } from '../system/StudioDrawer';

interface StudioMediaDrawerProps {
  movie: Movie | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlay: (movie: Movie) => void;
  onAddToPlaylist?: (movie: Movie) => void;
}

export const StudioMediaDrawer: React.FC<StudioMediaDrawerProps> = ({ movie, open, onOpenChange, onPlay, onAddToPlaylist }) => {
  return (
    <StudioDrawerRoot open={open} onOpenChange={onOpenChange}>
      <StudioDrawerContent>
        {movie && (
          <div className="studio-scrollbar max-h-[92dvh] overflow-y-auto">
            <StudioDrawerX />

            <div className="relative aspect-[16/8.2] min-h-[280px] overflow-hidden bg-black md:min-h-[430px]">
              {(movie.backdropUrl || movie.imageUrl) && (
                <img
                  src={movie.backdropUrl || movie.imageUrl}
                  alt={movie.title}
                  className="absolute inset-0 h-full w-full object-cover object-top opacity-85"
                />
              )}
              <div className="absolute inset-0 bg-[linear-gradient(to_top,#000_0%,rgba(0,0,0,0.82)_28%,rgba(0,0,0,0.20)_100%)]" />
              <div className="absolute bottom-0 left-0 right-0 p-5 md:p-8">
                <StudioDrawerTitle className="max-w-3xl text-4xl font-black tracking-tight text-white md:text-6xl">
                  {movie.title}
                </StudioDrawerTitle>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {movie.match > 0 && (
                    <StudioBadge tone="accent">
                      <Star size={12} fill="currentColor" />
                      {movie.match > 10 ? `${Math.round(movie.match)}%` : `${movie.match.toFixed(1)}/10`}
                    </StudioBadge>
                  )}
                  {movie.year && <StudioBadge>{movie.year}</StudioBadge>}
                  {movie.mediaType && <StudioBadge>{movie.mediaType === 'tv' ? 'Series' : 'Movie'}</StudioBadge>}
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <StudioButton variant="primary" size="lg" onClick={() => onPlay(movie)}>
                    <Play size={18} fill="currentColor" />
                    Play
                  </StudioButton>
                  {onAddToPlaylist && (
                    <StudioButton variant="glass" size="lg" onClick={() => onAddToPlaylist(movie)}>
                      <BookmarkPlus size={18} />
                      Add
                    </StudioButton>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-6 p-5 md:grid-cols-[1fr_280px] md:p-8">
              <div>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-white/38">Overview</h3>
                <p className="max-w-3xl text-base leading-7 text-white/72">
                  {movie.description || 'No overview is available for this title yet.'}
                </p>
              </div>

              <aside className="rounded-[var(--studio-radius-lg)] border border-white/10 bg-white/[0.045] p-4">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-white/38">Details</h3>
                <div className="space-y-3 text-sm text-white/65">
                  {movie.genre && movie.genre.length > 0 && (
                    <div>
                      <div className="text-white/35">Genres</div>
                      <div className="mt-1 text-white">{movie.genre.join(', ')}</div>
                    </div>
                  )}
                  {movie.director && (
                    <div>
                      <div className="text-white/35">Director</div>
                      <div className="mt-1 text-white">{movie.director}</div>
                    </div>
                  )}
                  {movie.cast && movie.cast.length > 0 && (
                    <div>
                      <div className="text-white/35">Cast</div>
                      <div className="mt-1 text-white">{movie.cast.slice(0, 4).join(', ')}</div>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </div>
        )}
      </StudioDrawerContent>
    </StudioDrawerRoot>
  );
};
