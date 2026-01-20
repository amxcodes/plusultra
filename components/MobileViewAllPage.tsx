
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, X } from 'lucide-react';
import { Movie } from '../types';
import { TmdbService } from '../services/tmdb';
import { MovieCard } from './MovieCard';
import { ContinueWatchingCard } from './ContinueWatchingCard';

interface MobileViewAllPageProps {
    title: string;
    fetchUrl?: string;
    initialMovies?: Movie[];
    forcedMediaType?: 'movie' | 'tv';
    onBack: () => void;
    onMovieSelect: (movie: Movie) => void;
}

export const MobileViewAllPage: React.FC<MobileViewAllPageProps> = ({
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
    const [showSearch, setShowSearch] = useState(false);

    // Initial Load
    useEffect(() => {
        window.scrollTo(0, 0);
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
            if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
                if (hasMore && !loading && !initialMovies) {
                    loadMore(page + 1);
                }
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [hasMore, loading, page, initialMovies]);

    const filteredMovies = movies.filter(m =>
        m.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-[#0f1014] pb-20">
            {/* Safe Area Top */}
            <div className="sticky top-0 z-40 bg-[#0f1014]/95 backdrop-blur-xl border-b border-white/5 pt-safe">
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onBack}
                            className="p-2 -ml-2 active:scale-95 transition-transform"
                        >
                            <ArrowLeft className="w-6 h-6 text-white" />
                        </button>
                        {!showSearch && (
                            <h1 className="text-xl font-black tracking-tight text-white truncate max-w-[200px]">
                                {title}
                            </h1>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {showSearch ? (
                            <div className="flex items-center bg-zinc-900 rounded-full px-3 py-1.5 animate-in slide-in-from-right-10 w-48 md:w-64">
                                <Search size={14} className="text-zinc-400 mr-2" />
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Search..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="bg-transparent border-none outline-none text-sm text-white w-full placeholder:text-zinc-600"
                                />
                                <button onClick={() => { setShowSearch(false); setSearchTerm(''); }} className="ml-2">
                                    <X size={14} className="text-zinc-400" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowSearch(true)}
                                className="p-2 -mr-2 text-zinc-400 hover:text-white"
                            >
                                <Search className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="px-3 pt-4">
                <div className={`grid ${title === 'Continue Watching' ? 'grid-cols-1' : 'grid-cols-3'
                    } gap-3`}>
                    {filteredMovies.map((movie, index) => (
                        title === 'Continue Watching' ? (
                            <ContinueWatchingCard
                                key={`${movie.id}-${index}`}
                                movie={movie}
                                onClick={() => onMovieSelect(movie)}
                            />
                        ) : (
                            <div
                                key={`${movie.id}-${index}`}
                                onClick={() => onMovieSelect(movie)}
                                className="relative group active:scale-95 transition-transform duration-200"
                            >
                                <div className="aspect-[2/3] bg-zinc-900 rounded-lg overflow-hidden relative shadow-lg">
                                    <img
                                        src={movie.imageUrl}
                                        alt={movie.title}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                    />
                                    {/* Score Badge */}
                                    <div className="absolute top-1.5 right-1.5 bg-black/80 backdrop-blur-[2px] px-1.5 py-0.5 rounded text-[9px] font-black text-white border border-white/10 shadow-xl">
                                        {movie.match}%
                                    </div>

                                    {/* Progress Bar for Resume */}
                                    {typeof movie.time === 'number' && movie.time > 0 && typeof movie.duration === 'number' && movie.duration > 0 && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-800">
                                            <div
                                                className="h-full bg-red-600"
                                                style={{ width: `${(movie.time / movie.duration) * 100}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    ))}
                </div>

                {/* Loaders */}
                {loading && (
                    <div className={`grid ${title === 'Continue Watching' ? 'grid-cols-1' : 'grid-cols-3'} gap-3 mt-3`}>
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className={`bg-zinc-900/50 animate-pulse rounded-lg ${title === 'Continue Watching' ? 'h-32' : 'aspect-[2/3]'
                                }`} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
