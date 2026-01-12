import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { Movie } from '../types';
import { TmdbService } from '../services/tmdb';
import { MovieCard } from './MovieCard';

interface ViewAllPageProps {
    title: string;
    fetchUrl?: string;
    initialMovies?: Movie[];
    forcedMediaType?: 'movie' | 'tv';
    onBack: () => void;
    onMovieSelect: (movie: Movie) => void;
}

export const ViewAllPage: React.FC<ViewAllPageProps> = ({
    title,
    fetchUrl,
    initialMovies,
    forcedMediaType,
    onBack,
    onMovieSelect
}) => {
    const [movies, setMovies] = useState<Movie[]>([]);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [hasMore, setHasMore] = useState(true);

    // Scroll to top on mount
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // Initial Load
    useEffect(() => {
        if (initialMovies) {
            setMovies(initialMovies);
            setHasMore(false);
        } else if (fetchUrl) {
            loadMore(1);
        }
    }, [fetchUrl, initialMovies]);

    const loadMore = async (pageNum: number) => {
        if (!fetchUrl || loading) return;
        setLoading(true);
        try {
            const separator = fetchUrl.includes('?') ? '&' : '?';
            const urlWithPage = `${fetchUrl}${separator}page=${pageNum}`;

            const newMovies = await TmdbService.getCategory(urlWithPage, forcedMediaType);

            if (newMovies.length === 0) setHasMore(false);

            setMovies(prev => pageNum === 1 ? newMovies : [...prev, ...newMovies]);
            setPage(pageNum);
        } catch (error) {
            console.error("Failed to load more movies", error);
        } finally {
            setLoading(false);
        }
    };

    // Infinite Scroll
    useEffect(() => {
        const handleScroll = () => {
            if (window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 1000) {
                if (hasMore && !loading && !initialMovies) {
                    loadMore(page + 1);
                }
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [hasMore, loading, page, initialMovies]);

    // Local Search Filtering
    const filteredMovies = movies.filter(m =>
        m.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen pt-4 pb-20 pl-24 pr-8">
            {/* Header with Back Button and Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 sticky top-14 z-40 bg-[#0f1014]/95 backdrop-blur-xl py-6 px-6 -ml-8 -mr-8 pl-16 pr-8 border-b border-white/5">
                <div className="flex items-center gap-4 mb-4 md:mb-0">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-6 h-6 text-white" />
                    </button>
                    <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent pb-2">
                        {title}
                    </h1>
                </div>

                <div className="relative w-full md:w-96 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-white transition-colors" />
                    <input
                        type="text"
                        placeholder={`Search in ${title}...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-full py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-white/30 focus:bg-black/60 transition-all placeholder:text-zinc-600"
                    />
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-8">
                {filteredMovies.map((movie, index) => (
                    <div
                        key={`${movie.id}-${index}`}
                        onClick={() => onMovieSelect(movie)}
                        className="cursor-pointer transform transition-transform hover:scale-105"
                    >
                        <MovieCard movie={movie} />
                        {movie.time > 0 && movie.duration > 0 && (
                            <div className="h-1 bg-zinc-800 mt-2 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-red-600"
                                    style={{ width: `${(movie.time / movie.duration) * 100}%` }}
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Loading Skeleton */}
            {loading && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 mt-8">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => (
                        <div key={i} className="aspect-[2/3] bg-zinc-900/50 animate-pulse rounded-lg" />
                    ))}
                </div>
            )}

            {/* No Results */}
            {filteredMovies.length === 0 && !loading && (
                <div className="text-center py-20 text-zinc-500">
                    <p className="text-xl">No results found</p>
                </div>
            )}
        </div>
    );
};
