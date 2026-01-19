import React from 'react';
import { HeroMovie } from '../types';
import { Play, Plus, Info } from 'lucide-react';

interface MobileHeroProps {
    movie: HeroMovie;
    onPlay?: (movie: HeroMovie) => void;
    onAddToPlaylist?: (movie: HeroMovie) => void;
}

import { useAuth } from '../lib/AuthContext';

export const MobileHero: React.FC<MobileHeroProps> = ({ movie, onPlay, onAddToPlaylist }) => {
    const { profile } = useAuth();
    const canStream = profile?.can_stream || profile?.role === 'admin';
    // Skeleton State
    if (movie.id === 0) {
        return (
            <div className="relative w-full h-[55vh] overflow-hidden bg-zinc-900">
                <div className="absolute inset-0 w-full h-full bg-zinc-900" />
                <div className="absolute bottom-0 left-0 px-6 w-full flex flex-col gap-4 z-10 pb-16">
                    <div className="h-10 w-3/4 bg-white/5 rounded-lg" />
                    <div className="flex items-center gap-4">
                        <div className="h-4 w-24 bg-white/5 rounded" />
                        <div className="h-4 w-16 bg-white/5 rounded" />
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                        <div className="h-10 w-full bg-white/5 rounded-full" />
                        <div className="h-10 w-12 bg-white/5 rounded-full" />
                    </div>
                </div>
                <div className="absolute bottom-0 w-full h-32 bg-gradient-to-t from-[#0f1014] to-transparent" />
            </div>
        );
    }

    return (
        <div className="relative w-full h-[60vh] overflow-hidden mb-6">
            {/* Background Image - Taller for mobile portrait */}
            <div className="absolute inset-0 w-full h-full">
                <img
                    src={movie.posterUrl || movie.imageUrl} // Prefer poster on mobile? Or cropped backdrop? Usually backdrop is better for text overlay, but poster is better for mobile verticality. Let's try backdrop with object-center first, as standard. Actually, maybe poster is too tall. Let's stick to backdrop but maybe different crop.
                    // User said "same logic fully copied". So use backdropUrl usually.
                    // But for mobile optimization, object-cover center is standard.
                    alt={movie.title}
                    className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f1014] via-[#0f1014]/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-b from-[#0f1014]/30 via-transparent to-transparent" />
            </div>

            {/* Content */}
            <div className="absolute bottom-0 left-0 px-5 w-full flex flex-col gap-3 z-10 pb-8">
                {/* Genre/Tags pill */}
                <div className="flex flex-wrap gap-2 mb-1">
                    {movie.genre && movie.genre.slice(0, 3).map((g, i) => (
                        <span key={i} className="text-[10px] font-bold text-white/90 bg-white/10 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/5 uppercase tracking-wider">
                            {g}
                        </span>
                    ))}
                </div>

                <h1 className="text-4xl font-bold text-white leading-[0.9] tracking-tighter drop-shadow-2xl">
                    {movie.title}
                </h1>

                <div className="flex items-center gap-3 text-xs font-medium text-gray-300 tracking-wide">
                    <span className="text-green-400 font-bold">{movie.match}% Match</span>
                    <span>•</span>
                    <span className="text-white/90">{movie.year}</span>
                    <span>•</span>
                    <span className="text-white/80">{movie.duration || "2h 15m"}</span>
                    <span className="ml-auto text-[10px] font-bold text-zinc-400 border border-white/10 px-1 rounded uppercase">HD</span>
                </div>

                {/* Mobile Horizontal Buttons layout */}
                <div className="flex items-center gap-3 pt-3">
                    {canStream ? (
                        <button
                            onClick={() => onPlay?.(movie)}
                            className="flex-1 h-12 flex items-center justify-center gap-2 bg-white text-black rounded-xl font-bold text-sm tracking-wide active:scale-95 transition-transform"
                        >
                            <Play size={18} className="fill-black" />
                            Play
                        </button>
                    ) : (
                        <button
                            disabled
                            className="flex-1 h-12 flex items-center justify-center gap-2 bg-white/10 text-zinc-500 rounded-xl font-bold text-sm tracking-wide opacity-50 cursor-not-allowed"
                        >
                            <Play size={18} className="fill-zinc-500" />
                            Preview Only
                        </button>
                    )}

                    <button
                        onClick={() => onAddToPlaylist?.(movie)}
                        className="w-12 h-12 flex items-center justify-center rounded-xl bg-white/10 border border-white/10 backdrop-blur-md active:scale-95 transition-transform"
                    >
                        <Plus size={24} className="text-white" />
                    </button>
                </div>
            </div>
        </div>
    );
};
