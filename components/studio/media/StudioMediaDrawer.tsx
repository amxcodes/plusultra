import React, { useEffect, useState } from 'react';
import { BookmarkPlus, Calendar, Clock, Clapperboard, Play, Sparkles, Star, Tv, Users } from 'lucide-react';
import { Movie } from '../../../types';
import { TmdbService } from '../../../services/tmdb';
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

const formatRuntime = (duration?: string | number) => {
  if (!duration) return null;
  if (typeof duration === 'string') return duration;
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const formatScore = (score: number) => (
  score > 10 ? `${Math.round(score)}%` : `${score.toFixed(1)}/10`
);

interface DetailItemProps {
  label: string;
  value?: React.ReactNode;
}

const DetailItem: React.FC<DetailItemProps> = ({ label, value }) => {
  if (!value) return null;

  return (
    <div className="rounded-[18px] border border-white/8 bg-white/[0.045] px-4 py-3">
      <div className="text-[11px] font-bold uppercase text-white/35">{label}</div>
      <div className="mt-1 text-sm leading-5 text-white/82">{value}</div>
    </div>
  );
};

export const StudioMediaDrawer: React.FC<StudioMediaDrawerProps> = ({ movie, open, onOpenChange, onPlay, onAddToPlaylist }) => {
  const [details, setDetails] = useState<Movie | null>(movie);

  useEffect(() => {
    let cancelled = false;

    if (!movie || !open) {
      setDetails(movie);
      return;
    }

    setDetails(movie);

    const mediaType = movie.mediaType || 'movie';
    TmdbService.getDetails(String(movie.tmdbId || movie.id), mediaType)
      .then(extraDetails => {
        if (cancelled) return;
        setDetails({ ...movie, ...extraDetails } as Movie);
      })
      .catch(() => {
        if (!cancelled) setDetails(movie);
      });

    return () => {
      cancelled = true;
    };
  }, [movie, open]);

  const activeMovie = details || movie;
  const runtime = formatRuntime(activeMovie?.duration);
  const cast = activeMovie?.cast?.filter(Boolean) || [];
  const genres = activeMovie?.genre?.filter(Boolean) || [];
  const seasons = activeMovie?.seasons?.filter(season => season.season_number > 0) || [];

  return (
    <StudioDrawerRoot open={open} onOpenChange={onOpenChange}>
      <StudioDrawerContent>
        {activeMovie && (
          <div className="studio-scrollbar max-h-[92dvh] overflow-y-auto">
            <StudioDrawerX />

            <div className="relative min-h-[360px] overflow-hidden bg-black md:min-h-[460px]">
              {(activeMovie.backdropUrl || activeMovie.imageUrl) && (
                <img
                  src={activeMovie.backdropUrl || activeMovie.imageUrl}
                  alt={activeMovie.title}
                  className="absolute inset-0 h-full w-full object-cover object-top opacity-82"
                />
              )}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.12),transparent_30%),linear-gradient(to_top,#000_0%,rgba(0,0,0,0.88)_30%,rgba(0,0,0,0.32)_100%)]" />
              <div className="absolute bottom-0 left-0 right-0 p-5 md:p-8">
                <StudioDrawerTitle className="max-w-4xl break-words text-4xl font-black leading-[0.95] tracking-tight text-white md:text-6xl">
                  {activeMovie.title}
                </StudioDrawerTitle>
                {activeMovie.tagline && (
                  <p className="mt-3 max-w-2xl text-base font-medium leading-6 text-white/64 md:text-lg">
                    {activeMovie.tagline}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {activeMovie.match > 0 && (
                    <StudioBadge tone="accent">
                      <Star size={12} fill="currentColor" />
                      {formatScore(activeMovie.match)}
                    </StudioBadge>
                  )}
                  {activeMovie.year && <StudioBadge><Calendar size={12} />{activeMovie.year}</StudioBadge>}
                  {runtime && <StudioBadge><Clock size={12} />{runtime}</StudioBadge>}
                  {activeMovie.mediaType && (
                    <StudioBadge>
                      {activeMovie.mediaType === 'tv' ? <Tv size={12} /> : <Clapperboard size={12} />}
                      {activeMovie.mediaType === 'tv' ? 'Series' : 'Movie'}
                    </StudioBadge>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <StudioButton variant="primary" size="lg" onClick={() => onPlay(activeMovie)}>
                    <Play size={18} fill="currentColor" />
                    Play
                  </StudioButton>
                  {onAddToPlaylist && (
                    <StudioButton variant="glass" size="lg" onClick={() => onAddToPlaylist(activeMovie)}>
                      <BookmarkPlus size={18} />
                      Add
                    </StudioButton>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_340px] md:p-8">
              <div className="space-y-6">
                <section>
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-white/38">
                    <Sparkles size={14} />
                    Overview
                  </h3>
                  <p className="max-w-3xl text-base leading-7 text-white/74 md:text-[17px]">
                    {activeMovie.description || 'No overview is available for this title yet.'}
                  </p>
                </section>

                {cast.length > 0 && (
                  <section>
                    <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-white/38">
                      <Users size={14} />
                      Cast
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {cast.slice(0, 12).map(actor => (
                        <span key={actor} className="rounded-full border border-white/9 bg-white/[0.06] px-3 py-1.5 text-sm text-white/78">
                          {actor}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                {seasons.length > 0 && (
                  <section>
                    <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-white/38">
                      <Tv size={14} />
                      Seasons
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {seasons.slice(0, 8).map(season => (
                        <div key={season.id || season.season_number} className="rounded-[18px] border border-white/8 bg-white/[0.045] p-3">
                          <div className="line-clamp-1 text-sm font-semibold text-white">{season.name || `Season ${season.season_number}`}</div>
                          <div className="mt-1 text-xs text-white/45">{season.episode_count} episodes</div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              <aside className="space-y-3">
                <div className="rounded-[var(--studio-radius-lg)] border border-white/10 bg-white/[0.045] p-4">
                  <h3 className="mb-3 text-xs font-bold uppercase text-white/38">Details</h3>
                  <div className="grid gap-3">
                    <DetailItem label={activeMovie.mediaType === 'tv' ? 'Created by' : 'Director'} value={activeMovie.director || 'Unknown'} />
                    <DetailItem label="Released" value={activeMovie.year} />
                    <DetailItem label="Runtime" value={runtime} />
                    <DetailItem label="Score" value={activeMovie.match > 0 ? formatScore(activeMovie.match) : undefined} />
                  </div>
                </div>

                {genres.length > 0 && (
                  <div className="rounded-[var(--studio-radius-lg)] border border-white/10 bg-white/[0.045] p-4">
                    <h3 className="mb-3 text-xs font-bold uppercase text-white/38">Genres</h3>
                    <div className="flex flex-wrap gap-2">
                      {genres.map(genre => (
                        <span key={genre} className="rounded-full bg-white/[0.075] px-3 py-1.5 text-xs font-semibold text-white/72">
                          {genre}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </div>
        )}
      </StudioDrawerContent>
    </StudioDrawerRoot>
  );
};
