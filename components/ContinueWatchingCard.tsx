import React, { useRef } from 'react';
import { Movie } from '../types';
import { Play } from 'lucide-react';

interface ContinueWatchingCardProps {
    movie: Movie;
    onClick: () => void;
}

export const ContinueWatchingCard: React.FC<ContinueWatchingCardProps> = ({ movie, onClick }) => {
    const { season, episode } = movie;

    // Use the specific episode image or backdrop, falling back to poster
    // Note: App.tsx mapping puts the backdrop/still into `imageUrl` for this row??
    // Let's check App.tsx later. We'll design this card assuming `imageUrl` IS the wide image.

    const image = movie.imageUrl;

    return (
        <div
            onClick={onClick}
            className="group/cwcard relative w-[280px] md:w-[320px] aspect-video rounded-[24px] overflow-hidden cursor-pointer bg-[#0a0a0a] border border-white/5 group-hover/cwcard:border-white/10 group-hover/cwcard:shadow-[0_10px_40px_rgba(0,0,0,0.5)] transform-gpu transition-all duration-500 group-hover/cwcard:-translate-y-2"
        >
            <div className="absolute inset-0 overflow-hidden">
                <img
                    src={image}
                    alt={movie.title}
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover/cwcard:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 pointer-events-none" />
                
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover/cwcard:opacity-100 transition-all duration-500 flex flex-col items-center justify-center gap-4 z-10">
                  <div className="flex items-center gap-3">
                    {/* Play Button */}
                    <div className="w-12 h-12 rounded-[18px] bg-gradient-to-tr from-white/20 to-white/5 hover:from-white/30 hover:to-white/10 backdrop-blur-xl border border-white/5 flex items-center justify-center transform translate-y-4 opacity-0 group-hover/cwcard:translate-y-0 group-hover/cwcard:opacity-100 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] delay-75 shadow-[0_10px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:border-white/10 text-white">
                      <Play className="fill-white ml-0.5" size={20} strokeWidth={1.5} />
                    </div>
                  </div>
                </div>
            </div>

            {/* Bottom Content Area */}
            <div className="absolute bottom-0 left-0 w-full p-5 flex flex-col justify-end translate-y-2 group-hover/cwcard:translate-y-0 transition-transform duration-500 opacity-80 group-hover/cwcard:opacity-100 z-20 pointer-events-none">
                <h4 className="text-white font-bold text-[15px] tracking-wide leading-tight drop-shadow-md line-clamp-1 mb-1.5">
                    {movie.title}
                </h4>
                
                {movie.mediaType === 'tv' && season && episode && (
                    <div className="self-start px-3 py-1 text-[10px] tracking-widest uppercase font-bold text-zinc-400 bg-white/5 backdrop-blur-md rounded-[10px] border border-white/5">
                        S{season} E{episode}
                    </div>
                )}
            </div>
        </div>
    );
};
