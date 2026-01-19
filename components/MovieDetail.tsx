import React, { useEffect, useState } from 'react';
import { Movie } from '../types';
import { Play, Plus, ChevronLeft, ThumbsUp, Volume2, Clock, Calendar, Star, ChevronRight, ListPlus, Shuffle, Lock } from 'lucide-react';
import { MovieCard } from './MovieCard';
import { AddToPlaylistModal } from './AddToPlaylistModal';
import { MobileAddToPlaylistModal } from './MobileAddToPlaylistModal';
import { TmdbService } from '../services/tmdb';
import { useAuth } from '../lib/AuthContext';

interface MovieDetailProps {
    movie: Movie & { numberOfSeasons?: number; seasons?: any[] };
    onClose: () => void;
    onPlay: (movie: Movie, season?: number, episode?: number) => void;
    similarMovies?: Movie[];
    onMovieSelect?: (movie: Movie) => void;
}

export const MovieDetail: React.FC<MovieDetailProps> = ({ movie, onClose, onPlay, onMovieSelect }) => {
    const { profile } = useAuth(); // NEW
    const canStream = profile?.can_stream || profile?.role === 'admin'; // Authorization check

    const [isVisible, setIsVisible] = useState(false);
    const [showPlaylistModal, setShowPlaylistModal] = useState(false);

    // Detailed Movie State (Merges prop with fetched details)
    const [activeMovie, setActiveMovie] = useState<Movie & { numberOfSeasons?: number; seasons?: any[] }>(movie);

    // Recommendations State
    const [recommendations, setRecommendations] = useState<Movie[]>([]);

    // TV Show State
    const [currentSeason, setCurrentSeason] = useState(1);
    const [currentEpisode, setCurrentEpisode] = useState(1);
    const [episodePage, setEpisodePage] = useState(1); // 50 eps per page
    const [episodes, setEpisodes] = useState<{ episode_number: number; id: number; name?: string; overview?: string; still_path?: string; air_date?: string; vote_average?: number; runtime?: number }[]>([]);
    const [isLoading, setIsLoading] = useState(false); // UI Loader State

    // Derived loading state to prevent stale content flash:
    // If we're loading OR the current data doesn't match the requested movie, show skeleton.
    const showSkeleton = isLoading || (activeMovie.id.toString() !== movie.id.toString());

    // We use full season objects now for better names and handling Season 0
    const [seasonList, setSeasonList] = useState<{ id: number; name: string; season_number: number; episode_count: number; poster_path?: string }[]>([]);

    useEffect(() => {
        setIsVisible(true);
        document.body.style.overflow = 'hidden';

        let isMounted = true;

        // Reset state
        setActiveMovie(movie);
        setCurrentSeason(1);
        setCurrentEpisode(1);
        setEpisodePage(1);
        setRecommendations([]);

        // Default mock seasons if none yet
        if (movie.numberOfSeasons) {
            setSeasonList(Array.from({ length: movie.numberOfSeasons }, (_, i) => ({
                id: i,
                name: `Season ${i + 1}`,
                season_number: i + 1,
                episode_count: 0
            })));
        } else {
            setSeasonList([{ id: 1, name: "Season 1", season_number: 1, episode_count: 0 }]);
        }

        // Fetch detailed info & recommendations
        const fetchFullDetails = async () => {
            if (!isMounted) return;
            setIsLoading(true); // START LOADING

            try {
                // STANDARD TMDB FETCH LOGIC
                const details = await TmdbService.getDetails(movie.id.toString(), movie.mediaType || 'movie');
                if (!isMounted) return;

                setActiveMovie(prev => ({ ...prev, ...details }));

                // Fetch Recommendations
                const similar = await TmdbService.getRecommendations(movie.id.toString(), movie.mediaType || 'movie');
                if (isMounted) setRecommendations(similar);

                // Update Season List with Real Data (includes Specials/Season 0 and Names)
                if (details.seasons && details.seasons.length > 0) {
                    setSeasonList(details.seasons);

                    // Smart Select: If currentSeason(1) exists, keep it. If not, pick the first sorted season (usually 1).
                    if (details.seasons[0].season_number !== 1 && details.seasons.length > 0) {
                        setCurrentSeason(details.seasons[0].season_number);
                    }
                } else if (details.numberOfSeasons) {
                    // Fallback if seasons array is missing
                    setSeasonList(Array.from({ length: details.numberOfSeasons }, (_, i) => ({
                        id: i,
                        name: `Season ${i + 1}`,
                        season_number: i + 1,
                        episode_count: 0
                    })));
                }
            } catch (error) {
                console.error("Error fetching details:", error);
            } finally {
                if (isMounted) setIsLoading(false); // STOP LOADING
            }
        };
        fetchFullDetails();

        return () => {
            isMounted = false;
            document.body.style.overflow = 'unset';
        };
    }, [movie]);

    // Fetch episodes when season changes
    useEffect(() => {
        let isMounted = true;

        if (activeMovie.mediaType === 'tv') {
            // STANDARD TMDB LOGIC
            const fetchEp = async () => {
                // Optional: Add loading state here too if TMDB is slow
                try {
                    const data = await TmdbService.getSeasonDetails(activeMovie.id.toString(), currentSeason);
                    if (isMounted && data?.episodes) {
                        setEpisodes(data.episodes);
                    }
                } catch (error) {
                    console.error("Error fetching TMDB season:", error);
                }
            };
            fetchEp();
        }

        return () => {
            isMounted = false;
        };
    }, [activeMovie.id, currentSeason, activeMovie.mediaType]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300);
    };

    const handleEpisodeSelect = (epNum: number) => {
        setCurrentEpisode(epNum);
        onPlay(activeMovie, currentSeason, epNum);
    }

    const handlePlayRandom = () => {
        if (!seasonList || seasonList.length === 0) return;

        // Filter valid seasons (exclude specials if needed, but usually season 0 is specials)
        // We prefer seasons with episodes
        const validSeasons = seasonList.filter(s => s.season_number > 0 && s.episode_count > 0);
        if (validSeasons.length === 0) return;

        const randomSeason = validSeasons[Math.floor(Math.random() * validSeasons.length)];
        const randomEpisode = Math.floor(Math.random() * randomSeason.episode_count) + 1;

        onPlay(activeMovie, randomSeason.season_number, randomEpisode);
    };

    // Handle switching to a recommended movie
    // Note: We need a way to switch the main view. 
    // Ideally, the parent should handle this, or `MovieDetail` could be recursive but that's complex.
    // The current `App.tsx` logic allows `onClose` then `handleMovieSelect`.
    // Or simpler: Make `similarMovies` clickable to just change the `activeMovie` state? 
    // Better: We might want the main app to change the selected movie. 
    // But since `MovieDetail` is an overlay, let's keep it simple:
    // If we click a similar movie, we can call a prop if available, or simpler:
    // Just rely on `activeMovie` state? No, `useEffect` depends on `movie` prop.
    // The cleanest way is to notify parent. But `MovieDetail` definition is fixed in `App.tsx`.
    // Let's assume for now clicking will likely close this or replace content?
    // Actually, checking `App.tsx`: `handleMovieSelect` runs `setSelectedMovie`.

    // Wait, `MovieDetail` only takes `movie` prop.
    // If `App` renders `MovieDetail`, changing local `activeMovie` won't change the prop.
    // But wait, if I click a similar movie card, I want to VIEW that movie.
    // Since `MovieDetail` doesn't accept an "onSelectMovie" prop to change parent state...
    // I should add `onSelectMovie` to `MovieDetailProps`?
    // Or... `App.tsx` passes `onMovieSelect` to rows.
    // I should verify if `App.tsx` can pass `handleMovieSelect` to `MovieDetail`.

    // Let's check `App.tsx` again. It renders `<MovieDetail movie={selectedMovie} onClose={...} />`.
    // It does NOT pass `onSelectMovie`.
    // So clicking a similar movie inside here will trigger... nothing unless I implement it.
    // I will add `onMovieSelect` to props. But I can't edit `App.tsx` in this same step if I want to be safe.
    // However, I can update `MovieDetail` to ACCEPT it, and `App.tsx` to pass it.

    // Actually, for this step, I'll just render the cards. If they are `MovieCard` components, they might expect an `onClick`.
    // The `MovieCard` usually takes `movie` and `onClick`.
    // I'll check `MovieCard` usage.

    return (
        <div className={`fixed inset-0 z-50 bg-[#0f1014] overflow-y-auto transition-opacity duration-300 ease-in-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
            <button
                onClick={handleClose}
                className="fixed top-4 left-4 md:top-6 md:left-28 z-50 flex items-center gap-2 group opacity-70 hover:opacity-100 transition-opacity bg-black/20 backdrop-blur-md p-2 rounded-full md:bg-transparent md:p-0"
            >
                <ChevronLeft size={24} className="text-white" />
                <span className="text-sm font-medium text-white tracking-wide hidden md:inline">Back</span>
            </button>

            {/* Hero / Player */}
            <div className="relative w-full min-h-[70vh] md:min-h-[80vh] flex items-center justify-center bg-black">
                {showSkeleton ? (
                    // SKELETON LOADER (Hero)
                    // SKELETON LOADER (Hero)
                    <div className="w-full h-full absolute inset-0 bg-[#0f1014] animate-pulse">
                        <div className="absolute inset-0 bg-white/5" />
                        <div className="absolute bottom-0 left-0 w-full px-6 md:px-16 pb-8 md:pb-12 flex flex-col gap-6 md:pl-32">
                            <div className="h-12 md:h-16 w-3/4 bg-white/10 rounded-lg mb-2" />
                            <div className="flex gap-4">
                                <div className="h-6 w-16 md:w-20 bg-white/10 rounded" />
                                <div className="h-6 w-16 md:w-20 bg-white/10 rounded" />
                                <div className="h-6 w-16 md:w-20 bg-white/10 rounded" />
                            </div>
                            <div className="flex gap-4 mt-2">
                                <div className="h-12 md:h-14 w-32 md:w-40 bg-white/10 rounded-full" />
                                <div className="h-12 md:h-14 w-12 md:w-14 bg-white/10 rounded-full" />
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="absolute inset-0">
                            <img
                                src={activeMovie.backdropUrl || activeMovie.imageUrl}
                                alt={activeMovie.title}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0f1014] via-[#0f1014]/60 to-transparent" />
                            <div className="absolute inset-0 bg-gradient-to-r from-[#0f1014] via-[#0f1014]/40 to-transparent" />
                        </div>

                        <div className="absolute bottom-0 left-0 w-full px-6 md:px-16 pb-8 md:pb-12 flex flex-col gap-4 md:gap-6 md:pl-32">
                            <h1 className="text-3xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight drop-shadow-2xl max-w-4xl leading-[0.9]">
                                {activeMovie.title}
                            </h1>

                            <div className="flex flex-wrap items-center gap-4 md:gap-6 text-sm font-medium text-gray-300">
                                <span className="text-green-400 font-bold flex items-center gap-1">
                                    <ThumbsUp size={14} className="fill-green-400" /> {activeMovie.match}% Rating
                                </span>
                                <span className="flex items-center gap-1">
                                    <Calendar size={14} /> {activeMovie.year}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Clock size={14} /> {activeMovie.duration || "2h 15m"}
                                </span>
                                {activeMovie.mediaType === 'tv' && (
                                    <span className="bg-white/20 px-2 py-0.5 rounded text-xs">TV Series</span>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center gap-3 md:gap-4 mt-2">
                                {canStream && (
                                    <button
                                        onClick={() => onPlay(activeMovie, currentSeason, currentEpisode)}
                                        className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-white hover:bg-zinc-200 text-black px-6 md:px-8 py-3 md:py-3.5 rounded-full font-bold tracking-wide transition-colors whitespace-nowrap"
                                    >
                                        <Play size={20} className="fill-black" />
                                        <span>{activeMovie.mediaType === 'tv' ? `Play S${currentSeason} E1` : 'Play Movie'}</span>
                                    </button>
                                )}

                                {activeMovie.mediaType === 'tv' && canStream && (
                                    <button
                                        onClick={handlePlayRandom}
                                        className="h-12 px-6 rounded-full border border-white/10 hover:border-white/30 hover:bg-white/5 text-white/80 hover:text-white font-medium text-sm flex items-center gap-2 transition-all group"
                                        title="Watch Random Episode"
                                    >
                                        <Shuffle size={16} className="group-hover:rotate-180 transition-transform duration-500" />
                                        <span className="hidden md:inline">Random</span>
                                    </button>
                                )}

                                <button
                                    onClick={() => setShowPlaylistModal(true)}
                                    className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                                    title="Add to Playlist"
                                >
                                    <ListPlus size={22} className="text-white" />
                                </button>
                            </div>
                        </div>

                        {showPlaylistModal && (
                            <>
                                <div className="hidden md:flex fixed inset-0 z-[60] items-center justify-center">
                                    <AddToPlaylistModal
                                        movie={activeMovie}
                                        onClose={() => setShowPlaylistModal(false)}
                                    />
                                </div>
                                <div className="md:hidden">
                                    <MobileAddToPlaylistModal
                                        movie={activeMovie}
                                        onClose={() => setShowPlaylistModal(false)}
                                    />
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>

            <div className="px-4 md:px-16 pb-20 w-full max-w-[1600px] mx-auto md:pl-32">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    {/* Main Info */}
                    <div className="lg:col-span-2 space-y-8">
                        {showSkeleton ? (
                            <div className="animate-pulse space-y-8">
                                <div>
                                    <div className="h-8 w-40 bg-white/10 rounded mb-4" />
                                    <div className="h-4 w-full bg-white/10 rounded mb-2" />
                                    <div className="h-4 w-full bg-white/10 rounded mb-2" />
                                    <div className="h-4 w-2/3 bg-white/10 rounded" />
                                </div>
                                <div>
                                    <div className="h-8 w-32 bg-white/10 rounded mb-4" />
                                    <div className="grid grid-cols-4 gap-4 mb-6">
                                        {[1, 2, 3, 4].map(i => <div key={i} className="aspect-video bg-white/10 rounded-lg" />)}
                                    </div>
                                    <div className="grid gap-4">
                                        {[1, 2, 3].map(i => <div key={i} className="h-24 w-full bg-white/10 rounded-xl" />)}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="prose prose-invert max-w-none">
                                    <h3 className="text-xl font-semibold text-white mb-3">Plot Summary</h3>
                                    <p className="text-gray-300 text-lg leading-relaxed font-light">
                                        {activeMovie.description || "No description available."}
                                    </p>
                                </div>

                                {/* Episode List for TV */}
                                {activeMovie.mediaType === 'tv' && (
                                    <div className="mt-8">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-2xl font-bold text-white">Seasons</h3>
                                        </div>

                                        {/* Season Selector - Grid Layout */}
                                        <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 select-none py-4 mb-8 transition-opacity ${showSkeleton ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                                            {seasonList.map(s => (
                                                <div
                                                    key={s.id}
                                                    onClick={() => setCurrentSeason(s.season_number)}
                                                    className={`group relative aspect-[3/4] sm:aspect-video rounded-md overflow-hidden cursor-pointer transition-all duration-500 ease-out
                                    ${currentSeason === s.season_number
                                                            ? 'opacity-100'
                                                            : 'opacity-40 hover:opacity-80'}`}
                                                >
                                                    {/* Background Image - Art Focus */}
                                                    {s.poster_path ? (
                                                        <img
                                                            src={s.poster_path.startsWith('http') ? s.poster_path : `https://image.tmdb.org/t/p/w400${s.poster_path}`}
                                                            alt={s.name}
                                                            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                                                            <span className="text-white/20 text-[10px] tracking-widest uppercase">No Art</span>
                                                        </div>
                                                    )}

                                                    {/* Overlay - Only text, no heavy dimming unless needed for readability */}
                                                    <div className={`absolute inset-0 flex flex-col justify-end p-4 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 ${currentSeason === s.season_number ? 'opacity-100' : ''} transition-opacity duration-300`}>
                                                        <span className="text-white font-medium text-sm tracking-wide">{s.name}</span>
                                                        {s.episode_count > 0 && (
                                                            <span className="text-[10px] text-zinc-400 font-light mt-0.5">
                                                                {s.episode_count} Episodes
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Active Indicator Line */}
                                                    {currentSeason === s.season_number && (
                                                        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-white animate-in fade-in zoom-in duration-300" />
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        <h3 className="text-xl font-semibold text-white mb-4">Episodes</h3>

                                        {/* Episode Pagination Controls */}
                                        {episodes.length > 50 && (
                                            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-none">
                                                {Array.from({ length: Math.ceil(episodes.length / 50) }, (_, i) => {
                                                    const start = i * 50 + 1;
                                                    const end = Math.min((i + 1) * 50, episodes.length);
                                                    return (
                                                        <button
                                                            key={i}
                                                            onClick={() => setEpisodePage(i + 1)}
                                                            className={`px-4 py-1.5 text-[10px] font-bold tracking-wider rounded-full whitespace-nowrap transition-all border
                                                          ${episodePage === i + 1
                                                                    ? 'bg-white text-black border-white'
                                                                    : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'}`}
                                                        >
                                                            EPISODES {start} - {end}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        <div className="flex flex-col gap-6">
                                            {episodes
                                                .slice((episodePage - 1) * 50, episodePage * 50)
                                                .map((ep) => (
                                                    <div
                                                        key={ep.id}
                                                        onClick={() => canStream ? handleEpisodeSelect(ep.episode_number) : null}
                                                        className={`group flex flex-col sm:flex-row items-center sm:items-start gap-6 transition-all duration-500 ${canStream ? 'cursor-pointer' : 'cursor-default opacity-80'}`}
                                                    >
                                                        {/* Episode Image - Pure Art */}
                                                        <div className="relative w-full sm:w-48 aspect-video shrink-0 overflow-hidden rounded-sm shadow-2xl bg-zinc-950">
                                                            {ep.still_path ? (
                                                                <img
                                                                    src={ep.still_path.startsWith('http') ? ep.still_path : `https://image.tmdb.org/t/p/w400${ep.still_path}`}
                                                                    alt={ep.name}
                                                                    className={`w-full h-full object-cover transition-all duration-700 ease-in-out
                                                                            ${currentEpisode === ep.episode_number ? 'opacity-100 scale-100 saturate-100' : 'opacity-60 scale-105 saturate-0 group-hover:saturate-100 group-hover:opacity-100 group-hover:scale-100'}`}
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                                                                    <span className="text-[10px] text-zinc-700 tracking-widest uppercase">No Preview</span>
                                                                </div>
                                                            )}

                                                            {/* Minimal Play Icon - Only on Hover/Active */}
                                                            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 
                                                                            ${currentEpisode === ep.episode_number ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}>
                                                                <Play size={24} className="fill-white text-white drop-shadow-lg" />
                                                            </div>

                                                            {/* Progress Line */}
                                                            {currentEpisode === ep.episode_number && (
                                                                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
                                                            )}
                                                        </div>

                                                        {/* Content - Typography Focused */}
                                                        <div className="flex-1 min-w-0 flex flex-col justify-center h-full pt-1">
                                                            <div className="flex items-baseline gap-4 mb-2">
                                                                <span className={`text-2xl font-light tracking-tighter transition-colors duration-300 font-mono ${currentEpisode === ep.episode_number ? 'text-white' : 'text-zinc-700 group-hover:text-zinc-500'}`}>
                                                                    {ep.episode_number.toString().padStart(2, '0')}
                                                                </span>
                                                                <h4 className={`text-lg font-medium tracking-tight transition-colors duration-300 ${currentEpisode === ep.episode_number ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
                                                                    {ep.name || `Episode ${ep.episode_number}`}
                                                                </h4>
                                                            </div>

                                                            <p className={`text-sm font-light leading-relaxed line-clamp-2 transition-colors duration-300 ${currentEpisode === ep.episode_number ? 'text-zinc-400' : 'text-zinc-600 group-hover:text-zinc-500'}`}>
                                                                {ep.overview || "No description available."}
                                                            </p>

                                                            <div className="flex items-center gap-4 mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                                {ep.runtime && (
                                                                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest">
                                                                        {ep.runtime}m
                                                                    </span>
                                                                )}
                                                                {ep.vote_average && (
                                                                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                                                                        Rating {ep.vote_average.toFixed(1)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-6 border-t border-white/10">
                                    <div><span className="block text-sm text-gray-500 mb-1">{activeMovie.mediaType === 'tv' ? 'Creator' : 'Director'}</span><span className="text-gray-200">{activeMovie.director || "Unknown"}</span></div>
                                    <div><span className="block text-sm text-gray-500 mb-1">Cast</span><span className="text-gray-200">{activeMovie.cast?.join(", ") || "Unknown"}</span></div>
                                    <div><span className="block text-sm text-gray-500 mb-1">Genres</span><span className="text-gray-200">{activeMovie.genre?.join(", ") || "Unknown"}</span></div>
                                </div>

                                {/* Screenshots Gallery - Fills space for Movies */}
                                {activeMovie.screenshots && activeMovie.screenshots.length > 0 && (
                                    <div className="mt-8 pt-6 border-t border-white/10">
                                        <h3 className="text-lg font-semibold text-white mb-4">Gallery</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            {activeMovie.screenshots.map((src, i) => (
                                                <div key={i} className="aspect-video rounded-lg overflow-hidden bg-white/5 hover:scale-105 transition-transform duration-300 cursor-pointer">
                                                    <img src={`https://image.tmdb.org/t/p/w500${src}`} alt={`Screenshot ${i + 1}`} className="w-full h-full object-cover" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="lg:col-span-1">
                        <h3 className="text-xl font-semibold text-white mb-6">More Like This</h3>
                        <div className="grid grid-cols-2 gap-4">
                            {recommendations.slice(0, activeMovie.mediaType === 'tv' ? 12 : 4).map(simMovie => (
                                <div key={simMovie.id} className="opacity-60 hover:opacity-100 transition-opacity duration-300">
                                    <MovieCard movie={simMovie} onClick={() => onMovieSelect?.(simMovie)} />
                                </div>
                            ))}
                            {recommendations.length === 0 && (
                                <p className="text-gray-500 text-sm">No similar titles found.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
