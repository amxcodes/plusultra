
import React, { useEffect, useState } from 'react';
import { TmdbService } from '../services/tmdb';
import { Movie } from '../types';
import { Play } from 'lucide-react';

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
                <div className="flex items-center gap-6 overflow-x-auto no-scrollbar pb-3">
                    {PROVIDERS.map((provider) => (
                        <button
                            key={provider.id}
                            onClick={() => setActiveProvider(provider)}
                            className={`text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors ${activeProvider.id === provider.id
                                ? `${provider.color}`
                                : 'text-zinc-600'
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
                            <img src={heroItem.posterUrl} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0f1014] via-transparent to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-6">
                                <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${activeProvider.color}`}>Featured on {activeProvider.name}</div>
                                <h2 className="text-3xl font-black leading-none mb-3 line-clamp-2">{heroItem.title}</h2>
                                <p className="text-xs text-zinc-300 line-clamp-2 mb-4 leading-relaxed opacity-80">{heroItem.description}</p>
                                <button className="bg-white text-black px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wide flex items-center gap-2 w-fit">
                                    <Play size={14} fill="currentColor" /> Watch Now
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Latest Grid */}
                    <div className="px-4 py-8">
                        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">New Arrivals</h3>
                        <div className="grid grid-cols-2 gap-4">
                            {movies.slice(1).map(movie => (
                                <div key={movie.id} onClick={() => onMovieSelect(movie)} className="flex flex-col gap-2">
                                    <div className="aspect-[2/3] bg-zinc-900 rounded-xl overflow-hidden relative">
                                        <img src={movie.imageUrl} className="w-full h-full object-cover" />
                                        <div className="absolute top-2 right-2 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-bold text-white border border-white/10">
                                            {String(movie.match).slice(0, 2)}%
                                        </div>
                                    </div>
                                    <div className="text-xs font-bold truncate">{movie.title}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
};
