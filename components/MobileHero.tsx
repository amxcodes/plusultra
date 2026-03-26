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

                <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight tracking-tighter drop-shadow-2xl w-full text-balance break-words mb-2">
                    {movie.title}
                </h1>

                <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-gray-300 tracking-widest uppercase">
                    <span className="text-green-400 bg-white/5 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/5">{movie.match}% Match</span>
                    <span className="bg-white/5 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/5 text-white/90">{movie.year}</span>
                    <span className="bg-white/5 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/5 text-white/80">{movie.duration || "2h 15m"}</span>
                    <span className="ml-auto text-[9px] font-bold text-zinc-400 border border-white/10 px-1 py-0.5 rounded uppercase">4K UHD</span>
                </div>

                {/* Mobile Horizontal Buttons layout */}
                <div className="flex items-center gap-3 pt-4">
                    {canStream ? (
                        <button
                            onClick={() => onPlay?.(movie)}
                            className="flex-1 h-14 flex items-center justify-center gap-2 bg-gradient-to-tr from-white/20 to-white/5 hover:from-white/30 hover:to-white/10 backdrop-blur-3xl text-white rounded-[20px] font-bold text-[12px] tracking-widest uppercase active:scale-95 transition-all outline-none border border-white/5 shadow-[0_10px_20px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)]"
                        >
                            <Play size={18} strokeWidth={2.5} className="fill-white" />
                            Play
                        </button>
                    ) : (
                        <button
                            disabled
                            className="flex-1 h-14 flex items-center justify-center gap-2 bg-white/5 border border-white/5 backdrop-blur-md text-zinc-500 rounded-[20px] font-bold text-[11px] tracking-widest uppercase opacity-50 cursor-not-allowed"
                        >
                            <Play size={18} className="fill-zinc-500" />
                            Preview
                        </button>
                    )}

                    <button
                        onClick={() => onAddToPlaylist?.(movie)}
                        className="group w-14 h-14 flex items-center justify-center rounded-[18px] bg-white/5 hover:bg-gradient-to-tr hover:from-white/20 hover:to-white/5 border border-white/5 hover:border-white/10 backdrop-blur-3xl active:scale-95 transition-all outline-none hover:shadow-[0_10px_20px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)]"
                    >
                        <Plus size={22} strokeWidth={2} className="text-white" />
                    </button>
                </div>
            </div>
        </div>
    );
};
