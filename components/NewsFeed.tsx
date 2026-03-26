import React, { useEffect, useState } from 'react';
import { TmdbService } from '../services/tmdb';
import { Movie } from '../types';
import { Play, ArrowRight } from 'lucide-react';
import { MovieCard } from './MovieCard';

interface NewsFeedProps {
    onMovieSelect: (movie: Movie) => void;
}

const PROVIDERS = [
    { id: 8, name: 'Netflix', color: 'text-red-500', border: 'border-red-500' },
    { id: 337, name: 'Disney+', color: 'text-blue-400', border: 'border-blue-400' },
    { id: 9, name: 'Prime Video', color: 'text-sky-400', border: 'border-sky-400' },
    { id: 350, name: 'Apple TV+', color: 'text-white', border: 'border-white' },
    { id: 15, name: 'Hulu', color: 'text-green-500', border: 'border-green-500' },
    { id: 1899, name: 'Max', color: 'text-purple-400', border: 'border-purple-400' },
];

export const NewsFeed: React.FC<NewsFeedProps> = ({ onMovieSelect }) => {
    const [activeProvider, setActiveProvider] = useState(PROVIDERS[0]);
    const [movies, setMovies] = useState<Movie[]>([]);
    const [heroItem, setHeroItem] = useState<Movie | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadContent = async () => {
            setIsLoading(true);
            try {
                const data = await TmdbService.getByProvider(activeProvider.id);
                setMovies(data);

                if (data.length > 0) {
                    const detailed = await TmdbService.getDetails(data[0].id.toString(), 'movie');
                    setHeroItem(detailed as Movie);
                }
            } catch (error) {
                console.error("Failed to load provider content", error);
            } finally {
                setTimeout(() => setIsLoading(false), 500); // Minimal delay for smoothness
            }
        };

        loadContent();
    }, [activeProvider]);

    return (
        <div className="pb-20 bg-[#0f1014] min-h-screen text-white font-sans selection:bg-white/20 md:pl-[72px] lg:pl-[72px]">

            {/* STATIC HEADER & TABS */}
            <div className="pt-20 px-6 md:pr-8 lg:pr-12 border-b border-white/5 pb-0">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-1 h-6 bg-white"></div>
                    <h1 className="text-xl font-bold tracking-widest uppercase">Streaming News</h1>
                </div>

                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-6 pt-2 px-2 -mx-2">
                    {PROVIDERS.map((provider) => (
                        <button
                            key={provider.id}
                            onClick={() => setActiveProvider(provider)}
                            className={`px-5 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all duration-300 backdrop-blur-3xl border border-white/5 shadow-lg ${activeProvider.id === provider.id
                                ? `bg-gradient-to-tr from-white/20 to-white/5 text-white scale-105 shadow-[0_10px_30px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)]`
                                : 'bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10 active:scale-95'
                                }`}
                        >
                            {provider.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* HERO SECTION - PURE STATIC LAYOUT */}
            {heroItem && (
                <div className="px-6 md:pr-8 lg:pr-12 py-12 border-b border-white/5">
                    <div className="items-center z-10 w-full grid grid-cols-1 lg:grid-cols-2 gap-12">
                        <div className="flex flex-col justify-center">
                            <div className={`text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2 ${activeProvider.color}`}>
                                Features on {activeProvider.name}
                            </div>

                            <h2 className="text-4xl md:text-6xl font-black leading-[1.1] tracking-tighter mb-6">
                                {heroItem.title}
                            </h2>

                            <p className="text-lg text-zinc-400 mt-2 leading-relaxed font-light max-w-xl mb-8">
                                {heroItem.description}
                            </p>

                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => onMovieSelect(heroItem)}
                                    className="h-12 px-8 rounded-full bg-gradient-to-tr from-white/20 to-white/5 text-white font-bold text-[11px] tracking-widest uppercase flex items-center gap-2 backdrop-blur-3xl border border-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
                                >
                                    <Play size={16} fill="currentColor" /> Play Now
                                </button>
                            </div>
                        </div>

                        <div
                            className="relative aspect-video w-full bg-white/5 backdrop-blur-md rounded-[24px] overflow-hidden cursor-pointer border border-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] group hover:border-white/10 transition-all duration-500"
                            onClick={() => onMovieSelect(heroItem)}
                        >
                            <img
                                src={heroItem.backdropUrl || heroItem.imageUrl}
                                alt={heroItem.title}
                                className="w-full h-full object-cover"
                            />
                            {/* Subtle overlay */}
                            <div className="absolute inset-0 bg-black/10"></div>
                        </div>

                    </div>
                </div>
            )}

            {/* GRID LAYOUT - CLEAN & STATIC */}
            <div className="px-6 md:pr-8 lg:pr-12 py-12">
                <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
                    <h3 className="text-lg font-bold uppercase tracking-widest text-white">Latest Arrivals</h3>
                    <span className="text-xs font-mono text-zinc-500">UPDATED WEEKLY</span>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-12">
                    {movies.slice(1).map((movie) => (
                        <div key={movie.id} className="flex justify-center">
                            <MovieCard movie={movie} onClick={() => onMovieSelect(movie)} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
