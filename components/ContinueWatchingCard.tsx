import React, { useRef } from 'react';
import { Movie } from '../types';
import { Play } from 'lucide-react';

interface ContinueWatchingCardProps {
    movie: Movie;
    onClick: () => void;
}

export const ContinueWatchingCard: React.FC<ContinueWatchingCardProps> = ({ movie, onClick }) => {
    // Derive progress info
    // In App.tsx we should map history data to movie.meta or similar, but simplified:
    // We already passed `match` in App.tsx as a rough proxy or we can use the `duration` vs `time` if we extended the type.
    // For now, let's assume `movie` has extra properties injected by our App.tsx mapping.

    // We need to type-cast or assume these exist because we injected them in App.tsx
    // Or better: pass them explicitly? 
    // Let's assume the passed `movie` object has these fields from the history mapper.
    const progress = (movie as any).progress || 0; // 0 to 1
    const timeLeft = (movie as any).timeLeft || 0;
    const season = (movie as any).season;
    const episode = (movie as any).episode;

    // Use the specific episode image or backdrop, falling back to poster
    // Note: App.tsx mapping puts the backdrop/still into `imageUrl` for this row??
    // Let's check App.tsx later. We'll design this card assuming `imageUrl` IS the wide image.

    const image = movie.imageUrl;

    return (
        <div
            onClick={onClick}
            className="group relative w-[280px] md:w-[320px] aspect-video rounded-lg overflow-hidden cursor-pointer bg-zinc-900 border border-white/5 hover:border-white/20 transition-all duration-300 shadow-lg"
        >
            {/* Image */}
            <div className="absolute inset-0">
                <img
                    src={image}
                    alt={movie.title}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
            </div>

            {/* Play Button Overlay (Minimal, non-glassy) */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center shadow-lg">
                    <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                </div>
            </div>

            {/* Content / Metadata */}
            <div className="absolute bottom-0 left-0 w-full p-4">
                <h4 className="text-white font-bold text-sm truncate shadow-black drop-shadow-md mb-1">{movie.title}</h4>

                {movie.mediaType === 'tv' && season && episode ? (
                    <div className="text-xs text-zinc-300 font-medium mb-2 drop-shadow-md">
                        S{season}:E{episode}
                    </div>
                ) : (
                    <div className="text-xs text-zinc-300 font-medium mb-2 drop-shadow-md">
                        {Math.round(progress * 100)}% Complete
                    </div>
                )}

                {/* Minimal Progress Bar */}
                <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                        style={{ width: `${Math.max(5, progress * 100)}%` }}
                    />
                </div>
            </div>
        </div>
    );
};
