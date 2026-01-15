import React, { useEffect, useState } from 'react';
import { TmdbService } from '../services/tmdb';
import { Movie } from '../types';
import { Play, ArrowRight } from 'lucide-react';

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
        <div className="pb-20 bg-[#0f1014] min-h-screen text-white font-sans selection:bg-white/20">

            {/* STATIC HEADER & TABS */}
            <div className="pt-20 px-6 md:px-12 border-b border-white/5 pb-0">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-1 h-6 bg-white"></div>
                    <h1 className="text-xl font-bold tracking-widest uppercase">Streaming News</h1>
                </div>

                <div className="flex items-center gap-8 overflow-x-auto no-scrollbar">
                    {PROVIDERS.map((provider) => (
                        <button
                            key={provider.id}
                            onClick={() => setActiveProvider(provider)}
                            className={`pb-4 text-sm font-bold uppercase tracking-widest border-b-2 transition-colors ${activeProvider.id === provider.id
                                ? `${provider.border} text-white`
                                : 'border-transparent text-zinc-500 hover:text-white'
                                }`}
                        >
                            {provider.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* HERO SECTION - PURE STATIC LAYOUT */}
            {heroItem && (
                <div className="px-6 md:px-12 py-12 border-b border-white/5">
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
                                    className="h-12 px-8 bg-white text-black font-bold text-sm tracking-wide uppercase flex items-center gap-2"
                                >
                                    <Play size={16} fill="currentColor" /> Play Now
                                </button>
                            </div>
                        </div>

                        <div
                            className="relative aspect-video w-full bg-zinc-900 overflow-hidden cursor-pointer"
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
            <div className="px-6 md:px-12 py-12">
                <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
                    <h3 className="text-lg font-bold uppercase tracking-widest text-white">Latest Arrivals</h3>
                    <span className="text-xs font-mono text-zinc-500">UPDATED WEEKLY</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-y-12 gap-x-6">
                    {movies.slice(1).map((movie) => (
                        <div
                            key={movie.id}
                            className="group cursor-pointer flex flex-col gap-4"
                            onClick={() => onMovieSelect(movie)}
                        >
                            <div className="relative aspect-[2/3] bg-zinc-900 overflow-hidden">
                                <img
                                    src={movie.imageUrl}
                                    alt={movie.title}
                                    className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity"
                                />
                                <div className="absolute top-2 right-2 bg-black text-white text-[10px] font-bold px-1.5 py-0.5 uppercase">
                                    {String(movie.match).slice(0, 2)}%
                                </div>
                            </div>

                            <div>
                                <h4 className="text-sm font-bold text-white leading-snug mb-1 truncate">
                                    {movie.title}
                                </h4>
                                <div className="flex items-center justify-between text-[11px] text-zinc-500 uppercase tracking-wider font-medium">
                                    <span>{movie.year}</span>
                                    <span>{movie.genre?.[0] || 'Drama'}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
