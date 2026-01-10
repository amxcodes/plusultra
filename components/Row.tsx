import React, { useEffect, useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Movie } from '../types';
import { TmdbService } from '../services/tmdb';
import { MovieCard } from './MovieCard';
import { ContinueWatchingCard } from './ContinueWatchingCard';

interface RowProps {
    title: string;
    fetchUrl?: string;
    movies?: Movie[];
    onMovieSelect: (movie: Movie) => void;
    isLarge?: boolean;
    forcedMediaType?: 'movie' | 'tv';
    variant?: 'standard' | 'continue-watching'; // NEW
}

export const Row: React.FC<RowProps> = ({ title, fetchUrl, movies, onMovieSelect, isLarge = false, forcedMediaType, variant = 'standard' }) => {
    const [data, setData] = useState<Movie[]>([]);
    const rowRef = useRef<HTMLDivElement>(null);
    const [showLeft, setShowLeft] = useState(false);
    const [showRight, setShowRight] = useState(true);

    useEffect(() => {
        if (movies) {
            setData(movies);
        } else if (fetchUrl) {
            const fetchData = async () => {
                const results = await TmdbService.getCategory(fetchUrl, forcedMediaType);
                setData(results);
            };
            fetchData();
        }
    }, [fetchUrl, movies, forcedMediaType]);

    const handleScroll = () => {
        if (rowRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
            setShowLeft(scrollLeft > 0);
            setShowRight(scrollLeft < scrollWidth - clientWidth - 10); // buffer
        }
    };

    const handleClick = (direction: 'left' | 'right') => {
        if (rowRef.current) {
            const { scrollLeft, clientWidth } = rowRef.current;
            const scrollTo = direction === 'left'
                ? scrollLeft - clientWidth
                : scrollLeft + clientWidth;

            rowRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
        }
    };

    if (data.length === 0) return null;

    return (
        <div className="pl-4 md:pl-12 my-8 relative group z-10">
            <h2 className="text-xl md:text-2xl font-semibold mb-4 text-white/90 hover:text-white transition-colors cursor-pointer pl-2">
                {title}
            </h2>

            <div className="relative group">
                {/* Left Button */}
                <div
                    className={`absolute top-0 bottom-0 left-0 z-[60] flex items-center justify-center w-12 transition-opacity duration-300 ${showLeft ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 pointer-events-none'}`}
                >
                    <button
                        onClick={() => handleClick("left")}
                        className="bg-black/60 backdrop-blur-md border border-white/20 rounded-full p-2 text-white hover:bg-white hover:text-black transition-all transform hover:scale-110 active:scale-95 shadow-xl"
                    >
                        <ChevronLeft size={24} />
                    </button>
                </div>

                {/* Row Container */}
                <div
                    ref={rowRef}
                    onScroll={handleScroll}
                    className="flex items-center space-x-4 overflow-x-scroll scrollbar-hide md:space-x-6 px-4 py-8"
                    style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
                >
                    {data.map((movie) => (
                        <div
                            key={movie.id}
                            className={`relative ${variant === 'continue-watching' ? 'min-w-[280px] md:min-w-[320px]' : 'min-w-[180px] md:min-w-[220px]'} cursor-pointer transition duration-200 ease-out hover:z-50`}
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

                {/* Right Button */}
                <div
                    className={`absolute top-0 bottom-0 right-0 z-[60] flex items-center justify-center w-12 transition-opacity duration-300 ${showRight ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 pointer-events-none'}`}
                >
                    <button
                        onClick={() => handleClick("right")}
                        className="bg-black/60 backdrop-blur-md border border-white/20 rounded-full p-2 text-white hover:bg-white hover:text-black transition-all transform hover:scale-110 active:scale-95 shadow-xl"
                    >
                        <ChevronRight size={24} />
                    </button>
                </div>
            </div>
        </div>
    );
};
