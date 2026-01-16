import React, { useEffect, useState, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { Movie } from '../types';
import { TmdbService } from '../services/tmdb';
import { MovieCard } from './MovieCard';
import { ContinueWatchingCard } from './ContinueWatchingCard';

interface MobileRowProps {
    title: string;
    fetchUrl?: string;
    movies?: Movie[];
    onMovieSelect: (movie: Movie) => void;
    isLarge?: boolean;
    forcedMediaType?: 'movie' | 'tv';
    variant?: 'standard' | 'continue-watching';
    isLoading?: boolean;
    onViewAll?: () => void;
}

export const MobileRow: React.FC<MobileRowProps> = ({ title, fetchUrl, movies, onMovieSelect, isLarge = false, forcedMediaType, variant = 'standard', isLoading, onViewAll }) => {
    const [data, setData] = useState<Movie[]>([]);
    const [internalLoading, setInternalLoading] = useState(true);
    const rowRef = useRef<HTMLDivElement>(null);

    const showSkeleton = isLoading !== undefined ? isLoading : internalLoading;

    useEffect(() => {
        if (movies) {
            setData(movies);
            setInternalLoading(false);
        } else if (fetchUrl) {
            const fetchData = async () => {
                setInternalLoading(true);
                const results = await TmdbService.getCategory(fetchUrl, forcedMediaType);
                setData(results);
                setInternalLoading(false);
            };
            fetchData();
        }
    }, [fetchUrl, movies, forcedMediaType]);


    if (showSkeleton) {
        return (
            <div className="pl-4 my-6 relative z-10 animate-pulse">
                {/* Title Skeleton */}
                <div className="h-5 w-32 bg-white/5 rounded mb-3" />

                {/* Horizontal Scroll Skeleton */}
                <div className="flex items-center space-x-3 overflow-hidden py-2">
                    {[1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            className={`bg-zinc-900 rounded-lg ${variant === 'continue-watching' ? 'min-w-[200px] aspect-video' : 'min-w-[120px] aspect-[2/3]'}`}
                        />
                    ))}
                </div>
            </div>
        );
    }

    if (data.length === 0) return null;

    return (
        <div className="pl-4 my-2 relative z-10">
            {/* Header: Title + Show More */}
            <div className="flex items-end justify-between pr-4 mb-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                    {title}
                </h2>

                {onViewAll && (
                    <button
                        onClick={onViewAll}
                        className="text-[10px] font-bold text-zinc-400 hover:text-white flex items-center gap-1 transition-colors uppercase tracking-wider"
                    >
                        More <ChevronRight size={12} />
                    </button>
                )}
            </div>

            <div className="relative">
                {/* Row Container - optimized for touch */}
                <div
                    ref={rowRef}
                    className="flex items-center space-x-3 overflow-x-auto scrollbar-hide py-4 pr-4"
                    style={{ msOverflowStyle: 'none', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
                >
                    {data.map((movie) => (
                        <div
                            key={movie.id}
                            className={`relative ${variant === 'continue-watching' ? 'min-w-[200px]' : 'min-w-[120px]'} flex-shrink-0`}
                        >
                            {variant === 'continue-watching' ? (
                                <ContinueWatchingCard movie={movie} onClick={() => onMovieSelect(movie)} />
                            ) : (
                                <div onClick={() => onMovieSelect(movie)}>
                                    <MovieCard movie={movie} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
