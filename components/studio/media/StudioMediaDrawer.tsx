import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, BookmarkPlus, Calendar, ChevronDown, Clapperboard, Clock, Grid2X2, ListVideo, Play, Plus, Sparkles, Star, Tv, Users } from 'lucide-react';
import { Movie } from '../../../types';
import { TmdbService } from '../../../services/tmdb';
import { StudioBadge } from '../system/StudioBadge';
import { StudioButton } from '../system/StudioButton';
import { StudioDrawerContent, StudioDrawerRoot, StudioDrawerTitle } from '../system/StudioDrawer';

interface StudioMediaDrawerProps {
  movie: Movie | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlay?: (movie: Movie, season?: number, episode?: number) => void;
  onAddToPlaylist?: (movie: Movie) => void;
  onMovieSelect?: (movie: Movie) => void;
}

type StudioEpisode = {
  episode_number: number;
  id: number;
  name: string;
  overview: string;
  still_path: string | null;
  air_date: string;
  vote_average: number;
  runtime?: number;
};

const formatRuntime = (duration?: string | number) => {
  if (!duration) return null;
  if (typeof duration === 'string') return duration;
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const formatScore = (score: number) => (
  score >= 1 ? (score > 10 ? `${Math.round(score)}%` : `${score.toFixed(1)}/10`) : null
);

export const StudioMediaDrawer: React.FC<StudioMediaDrawerProps> = ({ movie, open, onOpenChange, onPlay, onAddToPlaylist, onMovieSelect }) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [focusMovie, setFocusMovie] = useState<Movie | null>(movie);
  const [details, setDetails] = useState<Movie | null>(movie);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [episodes, setEpisodes] = useState<StudioEpisode[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<Movie[]>([]);
  const [newestFirst, setNewestFirst] = useState(false);
  const [episodeView, setEpisodeView] = useState<'list' | 'grid'>('list');

  useEffect(() => {
    setFocusMovie(movie);
  }, [movie]);

  useEffect(() => {
    let cancelled = false;

    if (!focusMovie || !open) {
      setDetails(focusMovie);
      setDetailsLoading(false);
      return;
    }

    setDetails(focusMovie);
    setDetailsLoading(true);
    setSelectedSeason(null);
    setEpisodes([]);
    setRecommendations([]);

    const mediaType = focusMovie.mediaType || 'movie';
    TmdbService.getDetails(String(focusMovie.tmdbId || focusMovie.id), mediaType)
      .then(extraDetails => {
        if (cancelled) return;
        setDetails({ ...focusMovie, ...extraDetails } as Movie);
      })
      .catch(() => {
        if (!cancelled) setDetails(focusMovie);
      })
      .finally(() => {
        if (!cancelled) setDetailsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [focusMovie, open]);

  const activeMovie = details || focusMovie;
  const runtime = formatRuntime(activeMovie?.duration);
  const cast = useMemo(() => activeMovie?.cast?.filter(Boolean) || [], [activeMovie?.cast]);
  const castProfiles = useMemo(() => activeMovie?.castProfiles?.filter(person => person.name) || [], [activeMovie?.castProfiles]);
  const castCards = useMemo(() => (
    castProfiles.length > 0
      ? castProfiles
      : cast.map(name => ({ name, character: undefined, profileUrl: undefined }))
  ), [cast, castProfiles]);
  const seasons = useMemo(() => activeMovie?.seasons?.filter(season => season.season_number > 0) || [], [activeMovie?.seasons]);
  const selectedSeasonData = seasons.find(season => season.season_number === selectedSeason) || null;
  const sortedEpisodes = useMemo(() => (
    newestFirst ? [...episodes].reverse() : episodes
  ), [episodes, newestFirst]);

  useEffect(() => {
    if (!open || !activeMovie || activeMovie.mediaType !== 'tv' || seasons.length === 0) {
      setSelectedSeason(null);
      setEpisodes([]);
      return;
    }

    if (!selectedSeason || !seasons.some(season => season.season_number === selectedSeason)) {
      setSelectedSeason(seasons[0].season_number);
    }
  }, [activeMovie?.id, activeMovie?.mediaType, open, seasons, selectedSeason]);

  useEffect(() => {
    let cancelled = false;

    if (!open || !activeMovie || activeMovie.mediaType !== 'tv' || !selectedSeason) {
      setEpisodes([]);
      return;
    }

    setEpisodesLoading(true);
    TmdbService.getSeasonDetails(String(activeMovie.tmdbId || activeMovie.id), selectedSeason)
      .then(seasonDetails => {
        if (!cancelled) setEpisodes(seasonDetails?.episodes || []);
      })
      .catch(() => {
        if (!cancelled) setEpisodes([]);
      })
      .finally(() => {
        if (!cancelled) setEpisodesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeMovie?.id, activeMovie?.mediaType, activeMovie?.tmdbId, open, selectedSeason]);

  useEffect(() => {
    let cancelled = false;

    if (!open || !activeMovie) {
      setRecommendations([]);
      return;
    }

    TmdbService.getRecommendations(String(activeMovie.tmdbId || activeMovie.id), activeMovie.mediaType || 'movie')
      .then(items => {
        if (!cancelled) setRecommendations(items.slice(0, 8));
      })
      .catch(() => {
        if (!cancelled) setRecommendations([]);
      });

    return () => {
      cancelled = true;
    };
  }, [activeMovie?.id, activeMovie?.mediaType, activeMovie?.tmdbId, open]);

  const navigateInsideDrawer = (nextMovie: Movie) => {
    setFocusMovie(nextMovie);
    onMovieSelect?.(nextMovie);
    window.requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  return (
    <StudioDrawerRoot open={open} onOpenChange={onOpenChange}>
      <StudioDrawerContent>
        {activeMovie && (
          <div ref={scrollRef} className="studio-drawer-scroll max-h-[92dvh] overflow-y-auto">
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
                  {formatScore(activeMovie.match) && (
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

                <div className="mt-5 flex flex-wrap gap-2">
                  {onPlay && (
                    <StudioButton variant="glass" size="md" onClick={() => onPlay(activeMovie)} className="px-4">
                      <Play size={15} fill="currentColor" />
                      {activeMovie.mediaType === 'tv' ? 'S1 E1' : 'Play'}
                    </StudioButton>
                  )}
                  {onAddToPlaylist && (
                    <StudioButton variant="ghost" size="icon" onClick={() => onAddToPlaylist(activeMovie)} aria-label="Save to playlist">
                      <BookmarkPlus size={17} />
                    </StudioButton>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-8 p-5 md:p-8">
              <div className="space-y-8">
                <section>
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-white/38">
                    <Sparkles size={14} />
                    Overview
                  </h3>
                  <p className="max-w-3xl text-base leading-7 text-white/74 md:text-[17px]">
                    {activeMovie.description || 'No overview is available for this title yet.'}
                  </p>
                </section>

                {(detailsLoading && castCards.length === 0) && (
                  <section className="animate-[studio-rise_260ms_var(--studio-ease)]">
                    <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-white/38">
                      <Users size={14} />
                      Cast
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {Array.from({ length: 8 }).map((_, index) => (
                        <div key={index} className="w-20 shrink-0">
                          <div className="aspect-[3/4] animate-pulse rounded-[16px] border border-white/8 bg-white/[0.055]" />
                          <div className="mt-2 h-2.5 animate-pulse rounded-full bg-white/[0.08]" />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {castCards.length > 0 && (
                  <section>
                    <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-white/38">
                      <Users size={14} />
                      Cast
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {castCards.slice(0, 10).map(actor => (
                        <div key={`${actor.name}-${actor.character || ''}`} className="w-20 shrink-0">
                          <div className="aspect-[3/4] overflow-hidden rounded-[16px] border border-white/8 bg-white/[0.045]">
                            {actor.profileUrl ? (
                              <img src={actor.profileUrl} alt={actor.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-white/28">
                                <Users size={24} />
                              </div>
                            )}
                          </div>
                          <div className="mt-2 line-clamp-1 text-[11px] font-bold text-white/88">{actor.name}</div>
                          {actor.character && <div className="mt-0.5 line-clamp-1 text-xs text-white/42">{actor.character}</div>}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {activeMovie.mediaType === 'tv' && selectedSeason && (
                  <section>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <h3 className="flex items-center gap-2 text-2xl font-black tracking-tight text-white">
                        Episodes
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setNewestFirst(value => !value)}
                          className="studio-control-glass hidden h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-white/86 transition-colors hover:bg-white/[0.12] sm:inline-flex"
                          aria-label="Toggle episode sort"
                        >
                          <ArrowUpDown size={15} />
                          <span>Sort: {newestFirst ? 'Newest First' : 'Oldest First'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEpisodeView('list')}
                          className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${episodeView === 'list' ? 'border-white/32 bg-white/14 text-white' : 'border-white/10 bg-black/50 text-white/62 hover:text-white'}`}
                          aria-label="Episode list view"
                        >
                          <ListVideo size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEpisodeView('grid')}
                          className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${episodeView === 'grid' ? 'border-white/32 bg-white/14 text-white' : 'border-white/10 bg-black/50 text-white/62 hover:text-white'}`}
                          aria-label="Episode grid view"
                        >
                          <Grid2X2 size={15} />
                        </button>
                        {seasons.length > 0 && (
                          <label className="relative">
                            <span className="sr-only">Season</span>
                            <select
                              value={selectedSeason}
                              onChange={(event) => setSelectedSeason(Number(event.target.value))}
                              className="h-10 min-w-[150px] appearance-none rounded-full border border-white/12 bg-black/62 py-0 pl-4 pr-10 text-sm font-semibold text-white outline-none transition-colors hover:border-white/22"
                            >
                              {seasons.map(season => (
                                <option key={season.id || season.season_number} value={season.season_number}>
                                  {season.name || `Season ${season.season_number}`}
                                </option>
                              ))}
                            </select>
                            <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/60" />
                          </label>
                        )}
                      </div>
                    </div>
                    {selectedSeasonData && (
                      <div className="mb-3 text-sm text-white/42">
                        {selectedSeasonData.episode_count} episodes
                      </div>
                    )}
                    {episodesLoading ? (
                      <div className="overflow-hidden rounded-[24px] border border-white/9">
                        {Array.from({ length: 4 }).map((_, index) => (
                          <div key={index} className="h-32 animate-pulse border-b border-white/7 bg-white/[0.035] last:border-b-0" />
                        ))}
                      </div>
                    ) : sortedEpisodes.length > 0 && episodeView === 'list' ? (
                      <div className="overflow-hidden rounded-[24px] border border-white/9 bg-black/45">
                        {sortedEpisodes.map(episode => (
                          <button
                            key={episode.id}
                            type="button"
                            onClick={() => onPlay?.(activeMovie, selectedSeason, episode.episode_number)}
                            disabled={!onPlay}
                            className="group/episode grid w-full grid-cols-[32px_96px_minmax(0,1fr)] items-center gap-3 border-b border-white/7 px-3 py-4 text-left transition-colors last:border-b-0 hover:bg-white/[0.055] disabled:cursor-default disabled:hover:bg-transparent md:grid-cols-[44px_132px_minmax(0,1fr)_auto] md:gap-4 md:px-4"
                          >
                            <div className="text-center text-xl font-black text-white/45">
                              {episode.episode_number}
                            </div>
                            <div className="relative h-20 overflow-hidden rounded-[16px] bg-white/[0.06]">
                              {episode.still_path ? (
                                <img src={`https://image.tmdb.org/t/p/w300${episode.still_path}`} alt="" className="h-full w-full object-cover opacity-80 transition-opacity group-hover/episode:opacity-100" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-white/24">
                                  <Play size={18} />
                                </div>
                              )}
                              <div className="absolute inset-0 flex items-center justify-center bg-black/24 opacity-0 transition-opacity group-hover/episode:opacity-100">
                                {onPlay && (
                                  <span className="studio-control-glass flex h-9 w-9 items-center justify-center rounded-full text-white">
                                    <Play size={14} fill="currentColor" />
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="mt-1 line-clamp-1 font-bold text-white">{episode.name || `Episode ${episode.episode_number}`}</div>
                              <div className="mt-0.5 text-xs text-white/38">{episode.air_date || 'Air date unavailable'}</div>
                              <p className="mt-1 line-clamp-2 text-sm leading-6 text-white/50">{episode.overview || 'No episode overview available.'}</p>
                            </div>
                            <div className="hidden text-sm font-bold text-white/45 md:block">
                              {episode.runtime ? formatRuntime(episode.runtime) : ''}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : sortedEpisodes.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {sortedEpisodes.map(episode => (
                          <button
                            key={episode.id}
                            type="button"
                            onClick={() => onPlay?.(activeMovie, selectedSeason, episode.episode_number)}
                            disabled={!onPlay}
                            className="group/episode overflow-hidden rounded-[22px] border border-white/8 bg-black/45 text-left transition-colors hover:border-white/18 hover:bg-white/[0.055] disabled:cursor-default disabled:hover:border-white/8 disabled:hover:bg-black/45"
                          >
                            <div className="relative aspect-video bg-white/[0.055]">
                              {episode.still_path ? (
                                <img src={`https://image.tmdb.org/t/p/w500${episode.still_path}`} alt="" className="h-full w-full object-cover opacity-82 transition-opacity group-hover/episode:opacity-100" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-white/24">
                                  <Play size={20} />
                                </div>
                              )}
                              <div className="absolute left-3 top-3 rounded-full bg-black/62 px-2.5 py-1 text-xs font-black text-white/78">
                                {episode.episode_number}
                              </div>
                            </div>
                            <div className="p-3">
                              <div className="line-clamp-1 font-bold text-white">{episode.name || `Episode ${episode.episode_number}`}</div>
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/48">{episode.overview || 'No episode overview available.'}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-[20px] border border-white/8 bg-white/[0.045] p-5 text-sm text-white/46">
                        Episodes are not available for this season yet.
                      </div>
                    )}
                  </section>
                )}

                {recommendations.length > 0 && (
                  <section>
                    <h3 className="mb-4 text-2xl font-black tracking-tight text-white">More Like This</h3>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                      {recommendations.map(item => (
                        <div
                          key={`${item.mediaType || 'movie'}-${item.id}`}
                          className="group/reco relative text-left"
                        >
                          <button
                            type="button"
                            onClick={() => onAddToPlaylist?.(item)}
                            className="absolute right-2 top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/58 text-white transition-colors hover:bg-black/78"
                            aria-label="Add to playlist"
                          >
                            <Plus size={17} />
                          </button>
                          <button
                            type="button"
                            onClick={() => navigateInsideDrawer(item)}
                            className="block w-full text-left"
                          >
                            <div className="aspect-[2/3] overflow-hidden rounded-[22px] border border-white/8 bg-white/[0.045]">
                              <img src={item.posterUrl || item.imageUrl || item.backdropUrl} alt={item.title} className="h-full w-full object-cover transition-transform duration-300 group-hover/reco:scale-[1.03]" />
                            </div>
                            <div className="mt-2 line-clamp-1 text-sm font-bold text-white/84">{item.title}</div>
                            <div className="mt-0.5 text-xs text-white/36">
                              {[item.year, item.mediaType === 'tv' ? 'Series' : 'Movie'].filter(Boolean).join(' - ')}
                            </div>
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>
        )}
      </StudioDrawerContent>
    </StudioDrawerRoot>
  );
};
