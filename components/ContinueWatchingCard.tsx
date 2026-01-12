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

    const season = (movie as any).season;
    const episode = (movie as any).episode;

    // Use the specific episode image or backdrop, falling back to poster
    // Note: App.tsx mapping puts the backdrop/still into `imageUrl` for this row??
    // Let's check App.tsx later. We'll design this card assuming `imageUrl` IS the wide image.

    const image = movie.imageUrl;

    return (
        <div
            onClick={onClick}
            className="group relative w-[280px] md:w-[320px] aspect-video rounded-2xl overflow-hidden cursor-pointer bg-zinc-900 ring-1 ring-white/10 hover:ring-white/40 transition-all duration-300 shadow-lg"
        >
            {/* Image Container (Static, Brightness change) */}
            <div className="absolute inset-0 overflow-hidden">
                <img
                    src={image}
                    alt={movie.title}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:brightness-110 transition-all duration-300"
                />
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-60 transition-opacity duration-300" />
            </div>

            {/* Center Play Button (Static Fade) */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-lg">
                    <Play className="w-5 h-5 fill-black text-black ml-1" />
                </div>
            </div>

            {/* Bottom Content */}
            <div className="absolute bottom-0 left-0 w-full p-5 flex flex-col justify-end translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                {movie.mediaType === 'tv' && season && episode && (
                    <div className="self-start px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold bg-white/10 backdrop-blur-md rounded-md text-white/90 mb-2 border border-white/10 shadow-lg">
                        S{season} E{episode}
                    </div>
                )}
                <h4 className="text-white font-bold text-lg leading-tight drop-shadow-xl line-clamp-1 group-hover:text-white transition-colors">
                    {movie.title}
                </h4>
            </div>
        </div>
    );
};
