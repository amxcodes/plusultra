
import React, { useEffect, useState } from 'react';
import { TmdbService } from '../services/tmdb';
import { Movie } from '../types';
import { Play } from 'lucide-react';
import { MovieCard } from './MovieCard';

interface MobileNewsPageProps {
    onMovieSelect: (movie: Movie) => void;
}

const PROVIDERS = [
    { id: 8, name: 'Netflix', color: 'text-red-500', border: 'border-red-500' },
    { id: 337, name: 'Disney+', color: 'text-blue-400', border: 'border-blue-400' },
    { id: 9, name: 'Prime Video', color: 'text-sky-400', border: 'border-sky-400' },
    { id: 350, name: 'Apple TV+', color: 'text-white', border: 'border-white' },
];

export const MobileNewsPage: React.FC<MobileNewsPageProps> = ({ onMovieSelect }) => {
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
                    setHeroItem(await TmdbService.getDetails(data[0].id.toString(), 'movie') as Movie);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        loadContent();
    }, [activeProvider]);

    return (
        <div className="min-h-screen bg-[#0f1014] pb-24 text-white">

            {/* Header / Tabs */}
            <div className="pt-6 px-4 bg-[#0f1014] sticky top-0 z-40 border-b border-white/5">
                <h1 className="text-2xl font-black tracking-tight mb-4">News Feed</h1>
                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-4 pt-2 px-2 -mx-2">
                    {PROVIDERS.map((provider) => (
                        <button
                            key={provider.id}
                            onClick={() => setActiveProvider(provider)}
                            className={`px-5 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all duration-300 backdrop-blur-3xl border border-white/5 shadow-lg ${activeProvider.id === provider.id
                                ? `bg-gradient-to-tr from-white/20 to-white/5 text-white scale-105 shadow-[0_10px_30px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)]`
                                : 'bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10 active:scale-95'
                                }`}
                        >
                            {provider.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="h-64 flex items-center justify-center text-zinc-500 text-xs font-bold uppercase tracking-wider">Loading Updates...</div>
            ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

                    {/* Feature */}
                    {heroItem && (
                        <div className="relative aspect-[4/5] w-full" onClick={() => onMovieSelect(heroItem)}>
                            <img src={heroItem.imageUrl} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0f1014] via-transparent to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-6">
                                <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${activeProvider.color}`}>Featured on {activeProvider.name}</div>
                                <h2 className="text-3xl font-black leading-none mb-3 line-clamp-2">{heroItem.title}</h2>
                                <p className="text-xs text-zinc-300 line-clamp-2 mb-4 leading-relaxed opacity-80">{heroItem.description}</p>
                                <button className="px-6 py-3 rounded-[18px] bg-gradient-to-tr from-white/20 to-white/5 text-white border border-white/5 backdrop-blur-3xl shadow-[0_10px_30px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 w-fit active:scale-95 transition-all">
                                    <Play size={14} fill="currentColor" /> Watch Now
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Latest Grid */}
                    <div className="px-4 py-8">
                        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">New Arrivals</h3>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-8">
                            {movies.slice(1).map(movie => (
                                <div key={movie.id} className="w-full flex justify-center">
                                    <MovieCard movie={movie} onClick={() => onMovieSelect(movie)} />
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
};
