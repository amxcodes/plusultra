import React, { useEffect, useState } from 'react';
import { SocialService } from '../lib/social';
import { TmdbService } from '../services/tmdb';
import { Users, TrendingUp, User, Play, Heart, Star, BarChart3, Activity, X } from 'lucide-react';
import { Movie } from '../types';

interface CollaborationStatsProps {
    playlistId: string;
    items?: Movie[];
}

interface StatItem {
    user_id: string;
    username: string;
    avatar_url: string;
    items_added: number;
    role: string;
}

// TMDB Genre Map
const TMDB_GENRES: Record<number, string> = {
    28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
    99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
    27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-Fi",

    10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western", 10759: "Action & Adventure",
    10762: "Kids", 10763: "News", 10764: "Reality", 10765: "Sci-Fi & Fantasy",
    10766: "Soap", 10767: "Talk", 10768: "War & Politics"
};

// Helper: Calculate compatibility locally based on playlist items
const calculateLocalCompatibility = (items: Movie[], userA: string, userB: string) => {
    const genresA = new Set<string>();
    const genresB = new Set<string>();

    items.forEach(item => {
        if (item.addedByUserId === userA) {
            item.genreIds?.forEach(id => genresA.add(TMDB_GENRES[id] || 'Other'));
        } else if (item.addedByUserId === userB) {
            item.genreIds?.forEach(id => genresB.add(TMDB_GENRES[id] || 'Other'));
        }
    });

    if (genresA.size === 0 || genresB.size === 0) return { score: 12, shared: [], message: "Getting Started" };

    // Intersection
    const shared = [...genresA].filter(x => genresB.has(x));
    // Union
    const union = new Set([...genresA, ...genresB]);

    // Jaccard Index * 100 + Base Synergy (bonus for collaborating)
    const jaccard = shared.length / union.size;
    const score = Math.round(jaccard * 80) + 20; // 20-100 scale

    return {
        score: Math.min(100, score),
        shared: shared.slice(0, 3),
        message: score > 75 ? "Vibe Twins!" : score > 50 ? "Solid Mix" : "Eclectic Dup"
    };
};

export const CollaborationStats: React.FC<CollaborationStatsProps> = ({ playlistId, items = [] }) => {
    const [stats, setStats] = useState<StatItem[]>([]);
    const [recommendations, setRecommendations] = useState<Movie[]>([]);
    const [compatibility, setCompatibility] = useState<{ score: number; shared: string[]; message?: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [recLoading, setRecLoading] = useState(false);
    const [topGenres, setTopGenres] = useState<{ name: string; count: number }[]>([]);
    const [showRecs, setShowRecs] = useState(false);

    useEffect(() => {
        const loadStats = async () => {
            try {
                // 1. Fetch Stats
                const results = await Promise.allSettled([
                    SocialService.getPlaylistCollaborationStats(playlistId),
                ]);

                let currentStats: StatItem[] = [];

                if (results[0].status === 'fulfilled') {
                    currentStats = results[0].value;
                    setStats(currentStats);
                }

                // 2. Compatibility (Vibe Check)
                if (currentStats.length >= 2) {
                    // Two Users: Direct Compatibility
                    if (currentStats.length === 2) {
                        const userA = currentStats[0]?.user_id;
                        const userB = currentStats[1]?.user_id;

                        if (userA && userB) {
                            try {
                                // Priority 1: Local Playlist Stats (Strict "in that playlist" vibe)
                                const localMatch = calculateLocalCompatibility(items, userA, userB);

                                // If local match is valid (both have added items, score > 15), use it.
                                if (localMatch.score > 15) {
                                    setCompatibility(localMatch);
                                    // Update DB with this new local reality
                                    SocialService.updateTasteCompatibility(userA, userB, localMatch.score, localMatch.shared);
                                } else {
                                    // Priority 2: Global Fallback (Prediction)
                                    let match = await SocialService.getTasteCompatibility(userA, userB);
                                    if (!match || match.score === 0 || match.message === 'Not enough data') {
                                        setCompatibility(localMatch);
                                    } else {
                                        setCompatibility(match);
                                    }
                                }
                            } catch (e) {
                                console.warn("Compatibility logic failed", e);
                                const localMatch = calculateLocalCompatibility(items, userA, userB);
                                setCompatibility(localMatch);
                            }
                        }
                    } else {
                        // Group Synergy (>2 users)
                        // Local only for groups for now
                        const genres = items.flatMap(i => i.genreIds || []);
                        const uniqueGenres = new Set(genres).size;
                        const totalGenres = genres.length;
                        const synergy = totalGenres > 0 ? Math.min(100, Math.round((1 - (uniqueGenres / totalGenres)) * 100) + 50) : 0;
                        setCompatibility({ score: synergy, shared: [], message: synergy > 75 ? "Simpatico" : "Diverse Tastes" });
                    }
                }

                // 3. Local Genre Analysis
                const localGenreCounts: Record<string, number> = {};
                items.forEach(item => {
                    (item.genreIds || []).forEach(id => {
                        const name = TMDB_GENRES[id] || 'Other';
                        localGenreCounts[name] = (localGenreCounts[name] || 0) + 1;
                    });
                });

                const sortedGenres = Object.entries(localGenreCounts)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 3)
                    .map(([name, count]) => ({ name, count }));

                setTopGenres(sortedGenres);

            } catch (e) {
                console.error("Error loading stats", e);
            } finally {
                setLoading(false);
            }
        };
        loadStats();
    }, [playlistId, items]);

    const generateRecommendations = async () => {
        if (items.length === 0) return;
        setRecLoading(true);
        setShowRecs(true);

        try {
            // Aggregate all genre IDs
            const genreCounts: Record<number, number> = {};
            items.forEach(movie => {
                movie.genreIds?.forEach(id => {
                    genreCounts[id] = (genreCounts[id] || 0) + 1;
                });
            });

            const sortedGenreIds = Object.entries(genreCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([id]) => id);

            let discoveryUrl = '';

            if (sortedGenreIds.length >= 2) {
                const top2 = sortedGenreIds.slice(0, 2).join(',');
                discoveryUrl = `/discover/movie?api_key=${import.meta.env.VITE_TMDB_API_KEY}&with_genres=${top2}&sort_by=popularity.desc&vote_count.gte=300`;
            } else if (sortedGenreIds.length === 1) {
                discoveryUrl = `/discover/movie?api_key=${import.meta.env.VITE_TMDB_API_KEY}&with_genres=${sortedGenreIds[0]}&sort_by=popularity.desc`;
            } else {
                discoveryUrl = `/trending/movie/week?api_key=${import.meta.env.VITE_TMDB_API_KEY}`;
            }

            if (discoveryUrl) {
                const blendedMovies = await TmdbService.getCategory(discoveryUrl, 'movie');
                const seenIds = new Set(items.map(i => i.tmdbId));
                const uniqueBlends = blendedMovies.filter(m => !seenIds.has(m.tmdbId));
                setRecommendations(uniqueBlends.slice(0, 5)); // Limit to 5
            }
        } catch (e) {
            console.error("Failed to generate recs", e);
        } finally {
            setRecLoading(false);
        }
    };

    if (loading) return <div className="h-24 w-full bg-zinc-900/50 rounded-xl animate-pulse" />;

    const totalItems = stats.reduce((acc, curr) => acc + curr.items_added, 0);

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Minimal Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-zinc-800/50">

                {/* 1. Contributors */}
                <div className="px-4 first:pl-0">
                    <h3 className="text-zinc-500 text-[10px] uppercase tracking-widest font-medium mb-4">Contributors</h3>
                    <div className="space-y-3">
                        {stats.length === 0 ? (
                            <span className="text-zinc-600 text-sm">No activity.</span>
                        ) : (
                            stats.map((stat) => (
                                <div key={stat.user_id} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded-full overflow-hidden bg-zinc-800">
                                            <img
                                                src={stat.avatar_url || `https://ui-avatars.com/api/?name=${stat.username}`}
                                                className="w-full h-full object-cover grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all"
                                            />
                                        </div>
                                        <span className="text-sm text-zinc-300 font-medium group-hover:text-white transition-colors">
                                            {stat.username}
                                        </span>
                                    </div>
                                    <span className="text-zinc-500 text-xs font-mono">
                                        {Math.round((stat.items_added / (totalItems || 1)) * 100)}%
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* 2. Vibe Check */}
                <div className="px-4">
                    <h3 className="text-zinc-500 text-[10px] uppercase tracking-widest font-medium mb-4">Vibe Check</h3>
                    <div className="flex flex-col h-full justify-center">
                        {compatibility ? (
                            <div className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <span className="text-2xl font-light text-zinc-100">{compatibility.score}%</span>
                                    <span className="text-xs text-zinc-500 mb-1">{compatibility.message}</span>
                                </div>
                                <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-zinc-100 rounded-full transition-all duration-1000 ease-out"
                                        style={{ width: `${compatibility.score}%` }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <span className="text-zinc-600 text-sm italic">Need more data...</span>
                        )}
                    </div>
                </div>

                {/* 3. Genre DNA */}
                <div className="px-4">
                    <h3 className="text-zinc-500 text-[10px] uppercase tracking-widest font-medium mb-4">Genre DNA</h3>
                    <div className="flex flex-wrap gap-2">
                        {topGenres.length > 0 ? topGenres.map((g) => (
                            <div key={g.name} className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors cursor-default">
                                {g.name}
                            </div>
                        )) : (
                            <span className="text-zinc-600 text-sm">Unknown.</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Recommendations Section */}
            <div className="pt-6 border-t border-zinc-800/50">
                {!showRecs ? (
                    <div className="flex justify-center">
                        <button
                            onClick={generateRecommendations}
                            className="px-6 py-3 bg-white text-black text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-zinc-200 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                        >
                            Generate Recommendations
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="flex items-center justify-between mb-2 px-1">
                            <h3 className="text-zinc-500 text-[10px] uppercase tracking-widest font-medium">Curated For You</h3>
                            <button
                                onClick={() => { setShowRecs(false); setRecommendations([]); }}
                                className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                                title="Close Recommendations"
                            >
                                <X size={14} />
                            </button>
                        </div>

                        {recLoading ? (
                            <div className="h-32 flex items-center justify-center text-zinc-600 text-xs animate-pulse">
                                Analyzing taste profile...
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                {recommendations.map(movie => (
                                    <div key={movie.id} className="group relative aspect-[2/3] bg-zinc-900 rounded-lg overflow-hidden cursor-pointer" title={movie.title}>
                                        <img
                                            src={movie.imageUrl}
                                            className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-500 grayscale group-hover:grayscale-0"
                                            loading="lazy"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0">
                                            <p className="text-xs font-medium text-white line-clamp-1">{movie.title}</p>
                                            <div className="flex items-center justify-between mt-1">
                                                <span className="text-[10px] text-zinc-400">{movie.year}</span>
                                                {movie.match && <span className="text-[10px] text-zinc-300">{movie.match}%</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
