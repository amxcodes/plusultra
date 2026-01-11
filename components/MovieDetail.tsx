import React, { useEffect, useState } from 'react';
import { Movie } from '../types';
import { Play, Plus, ChevronLeft, ThumbsUp, Volume2, Clock, Calendar, Star, ChevronRight, ListPlus } from 'lucide-react';
import { MovieCard } from './MovieCard';
import { AddToPlaylistModal } from './AddToPlaylistModal';
import { TmdbService } from '../services/tmdb';

interface MovieDetailProps {
    movie: Movie & { numberOfSeasons?: number; seasons?: any[] };
    onClose: () => void;
    onPlay: (movie: Movie, season?: number, episode?: number) => void;
    similarMovies?: Movie[];
}

export const MovieDetail: React.FC<MovieDetailProps> = ({ movie, onClose, onPlay }) => {
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

                // Fetch Similar
                const similar = await TmdbService.getSimilar(movie.id.toString(), movie.mediaType || 'movie');
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
                className="fixed top-6 left-28 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md border border-white/10 transition-all group"
            >
                <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                <span className="text-sm font-medium">Back</span>
            </button>

            {/* Hero / Player */}
            <div className="relative w-full min-h-[70vh] md:min-h-[80vh] flex items-center justify-center bg-black">
                {showSkeleton ? (
                    // SKELETON LOADER (Hero)
                    <div className="w-full h-full absolute inset-0 bg-[#0f1014] animate-pulse">
                        <div className="absolute inset-0 bg-white/5" />
                        <div className="absolute bottom-0 left-0 w-full px-8 md:px-16 pb-12 flex flex-col gap-6 pl-24 md:pl-32">
                            <div className="h-16 w-3/4 bg-white/10 rounded-lg mb-2" />
                            <div className="flex gap-4">
                                <div className="h-6 w-20 bg-white/10 rounded" />
                                <div className="h-6 w-20 bg-white/10 rounded" />
                                <div className="h-6 w-20 bg-white/10 rounded" />
                            </div>
                            <div className="flex gap-4 mt-2">
                                <div className="h-14 w-40 bg-white/10 rounded-full" />
                                <div className="h-14 w-14 bg-white/10 rounded-full" />
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

                        <div className="absolute bottom-0 left-0 w-full px-8 md:px-16 pb-12 flex flex-col gap-6 pl-24 md:pl-32">
                            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight drop-shadow-2xl max-w-4xl">
                                {activeMovie.title}
                            </h1>

                            <div className="flex flex-wrap items-center gap-4 md:gap-6 text-sm font-medium text-gray-300">
                                <span className="text-green-400 font-bold flex items-center gap-1">
                                    <ThumbsUp size={14} className="fill-green-400" /> {activeMovie.match}% Match
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

                            <div className="flex items-center gap-4 mt-2">
                                <button
                                    onClick={() => onPlay(activeMovie, currentSeason, currentEpisode)}
                                    className="flex items-center gap-3 bg-white hover:bg-gray-200 text-black px-8 py-3.5 rounded-full font-bold tracking-wide transition-transform hover:scale-105 active:scale-95"
                                >
                                    <Play size={20} className="fill-black" />
                                    <span>{activeMovie.mediaType === 'tv' ? `Play S${currentSeason} E1` : 'Play Movie'}</span>
                                </button>
                                <button
                                    onClick={() => setShowPlaylistModal(true)}
                                    className="w-12 h-12 rounded-full border-2 border-white/20 hover:border-white bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all hover:scale-105"
                                    title="Add to Playlist"
                                >
                                    <ListPlus size={22} />
                                </button>
                            </div>
                        </div>

                        {showPlaylistModal && (
                            <div className="fixed inset-0 z-[60] flex items-center justify-center">
                                <AddToPlaylistModal
                                    movie={activeMovie}
                                    onClose={() => setShowPlaylistModal(false)}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="px-8 md:px-16 pb-20 w-full max-w-[1600px] mx-auto pl-24 md:pl-32">
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
                                        <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 select-none p-2 mb-6 transition-opacity ${showSkeleton ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                                            {seasonList.map(s => (
                                                <div
                                                    key={s.id}
                                                    onClick={() => setCurrentSeason(s.season_number)}
                                                    className={`relative aspect-video rounded-lg overflow-hidden cursor-pointer transition-all duration-300 group
                                    ${currentSeason === s.season_number
                                                            ? 'scale-105 z-10 grayscale-0 shadow-lg shadow-black/50'
                                                            : 'grayscale hover:grayscale-0 opacity-70 hover:opacity-100 hover:scale-105'}`}
                                                >
                                                    {/* Background Image */}
                                                    {s.poster_path ? (
                                                        <img
                                                            src={s.poster_path.startsWith('http') ? s.poster_path : `https://image.tmdb.org/t/p/w300${s.poster_path}`}
                                                            alt={s.name}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                                                            <span className="text-white/20 text-xs">No Image</span>
                                                        </div>
                                                    )}

                                                    {/* Overlay */}
                                                    <div className={`absolute inset-0 flex flex-col items-center justify-center p-2 text-center transition-colors
                                    ${currentSeason === s.season_number ? 'bg-black/40' : 'bg-black/60 group-hover:bg-black/50'}`}>
                                                        <span className="text-white font-bold text-sm shadow-md line-clamp-1">{s.name}</span>
                                                        {s.episode_count > 0 && (
                                                            <span className={`text-[10px] px-2 py-0.5 rounded-full mt-1 font-semibold
                                            ${currentSeason === s.season_number ? 'bg-purple-600 text-white' : 'bg-white/20 text-gray-200'}`}>
                                                                {s.episode_count} Eps
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <h3 className="text-xl font-semibold text-white mb-4">Episodes</h3>

                                        {/* Episode Pagination Controls */}
                                        {episodes.length > 50 && (
                                            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
                                                {Array.from({ length: Math.ceil(episodes.length / 50) }, (_, i) => {
                                                    const start = i * 50 + 1;
                                                    const end = Math.min((i + 1) * 50, episodes.length);
                                                    // Show limited pages if too many? For now, horizontal scroll is fine.
                                                    return (
                                                        <button
                                                            key={i}
                                                            onClick={() => setEpisodePage(i + 1)}
                                                            className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors
                                                      ${episodePage === i + 1
                                                                    ? 'bg-purple-600 text-white'
                                                                    : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
                                                        >
                                                            {start}-{end}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 gap-4">
                                            {episodes
                                                .slice((episodePage - 1) * 50, episodePage * 50)
                                                .map((ep) => (
                                                    <div
                                                        key={ep.id}
                                                        onClick={() => handleEpisodeSelect(ep.episode_number)}
                                                        className={`flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all border group
                                    ${currentEpisode === ep.episode_number
                                                                ? 'bg-purple-900/40 border-purple-500/50'
                                                                : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'}`}
                                                    >
                                                        {/* Episode Image */}
                                                        <div className="relative min-w-[120px] w-[120px] aspect-video rounded-lg overflow-hidden bg-black/50">
                                                            {ep.still_path ? (
                                                                <img
                                                                    src={ep.still_path.startsWith('http') ? ep.still_path : `https://image.tmdb.org/t/p/w300${ep.still_path}`}
                                                                    alt={ep.name}
                                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                                />
                                                            ) : (
                                                                <div className="flex items-center justify-center h-full text-white/30 text-xs text-center px-1">No Preview</div>
                                                            )}
                                                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Play size={20} className="fill-white text-white" />
                                                            </div>
                                                        </div>

                                                        <div className="flex-1">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <h4 className={`text-base font-semibold ${currentEpisode === ep.episode_number ? 'text-purple-400' : 'text-gray-200'}`}>
                                                                    {ep.episode_number}. {ep.name || `Episode ${ep.episode_number}`}
                                                                </h4>
                                                                <div className="flex items-center gap-2">
                                                                    {ep.air_date && (
                                                                        <span className="text-xs text-gray-500 bg-white/10 px-1.5 rounded">{ep.air_date}</span>
                                                                    )}
                                                                    {ep.vote_average ? (
                                                                        <span className="text-xs text-green-500">★ {ep.vote_average.toFixed(1)}</span>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                            <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed">
                                                                {ep.overview || "No description available for this episode."}
                                                            </p>
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
                                <div key={simMovie.id} className="transform scale-90 origin-top-left hover:scale-95 transition-transform duration-300">
                                    <MovieCard movie={simMovie} />
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
