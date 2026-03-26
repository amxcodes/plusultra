import React from 'react';
import { HeroMovie } from '../types';
import { Play, Plus } from 'lucide-react';

interface HeroProps {
  movie: HeroMovie;
  onPlay?: (movie: HeroMovie) => void;
  onAddToPlaylist?: (movie: HeroMovie) => void;
}

import { useAuth } from '../lib/AuthContext';

export const Hero: React.FC<HeroProps> = ({ movie, onPlay, onAddToPlaylist }) => {
  const { profile } = useAuth();
  const canStream = profile?.can_stream || profile?.role === 'admin';
  // Skeleton State
  if (movie.id === 0) {
    return (
      <div className="relative w-full h-[70vh] md:h-[85vh] overflow-hidden bg-zinc-900">
        <div className="absolute inset-0 w-full h-full bg-zinc-900" />
        <div className="absolute bottom-0 left-0 pl-6 md:pl-24 pr-6 md:pr-8 w-full md:w-2/3 lg:w-1/2 flex flex-col gap-4 z-10 pb-24 md:pb-40">
          <div className="h-12 md:h-16 w-3/4 bg-white/5 rounded-lg" />
          <div className="flex items-center gap-4">
            <div className="h-4 w-24 bg-white/5 rounded" />
            <div className="h-4 w-16 bg-white/5 rounded" />
          </div>
          <div className="flex items-center gap-4 mt-2">
            <div className="h-10 md:h-12 w-32 bg-white/5 rounded-full" />
            <div className="h-10 md:h-12 w-10 md:w-12 bg-white/5 rounded-full" />
          </div>
        </div>
        {/* Bottom Fade Overlay for smooth transition to rows */}
        <div className="absolute bottom-0 w-full h-32 bg-gradient-to-t from-[#0f1014] to-transparent" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-[70vh] md:h-[85vh] overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 w-full h-full">
        <img
          src={movie.backdropUrl || movie.imageUrl}
          alt={movie.title}
          className="w-full h-full object-cover object-center"
        />
        {/* Gradients - Reduced opacity for "More Art" */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f1014] via-[#0f1014]/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f1014]/60 via-transparent to-transparent" />
      </div>

      {/* Content - Adjusted padding to prevent clipping of long titles */}
      <div className="absolute bottom-0 left-0 pl-6 md:pl-28 lg:pl-32 pr-6 w-full lg:w-[65%] xl:w-[55%] flex flex-col gap-3 md:gap-4 z-10 pb-24 md:pb-32">
        
        {/* Title */}
        <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black text-white leading-tight tracking-tighter drop-shadow-2xl w-full mb-1 text-balance break-words">
          {movie.title}
        </h1>

        <div className="flex flex-wrap items-center gap-2 md:gap-3 text-[10px] md:text-[11px] font-bold text-gray-300 mb-4 tracking-widest uppercase">
          <span className="text-green-400 drop-shadow-sm bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5">{movie.match}% Match</span>
          
          <span className="bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5 text-white/90">{movie.year}</span>
          
          <span className="bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5 text-white/80">{movie.duration || "2h 15m"}</span>
          
          {movie.genre && movie.genre.length > 0 && (
              <span className="bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5 text-white/80">{movie.genre[0]}</span>
          )}
          <span className="bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5 text-zinc-300">4K UHD</span>
        </div>

        {/* Description / Logline */}
        <p className="text-sm md:text-[15px] font-medium text-zinc-300 leading-relaxed max-w-2xl mb-6 md:mb-8 line-clamp-3 md:line-clamp-4 drop-shadow-md text-pretty">
          {movie.description || "Unravel the mystery of a nightmarish town in middle America that traps all those who enter. As the unwilling residents fight to keep a sense of normalcy and search for a way out, they must also survive the threats of the surrounding forest."}
        </p>

        {/* Minimal Glassy Buttons */}
        <div className="flex items-center gap-4 pt-4">
          {canStream && (
            <button
              onClick={() => onPlay?.(movie)}
              className="flex items-center justify-center gap-3 bg-gradient-to-tr from-white/20 to-white/5 hover:from-white/30 hover:to-white/10 backdrop-blur-3xl text-white px-10 py-4 rounded-[20px] font-bold tracking-widest uppercase text-[12px] transition-all duration-300 hover:scale-105 active:scale-95 border border-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] outline-none"
            >
              <Play size={18} strokeWidth={2.5} className="fill-white" />
              <span>Play</span>
            </button>
          )}

          <button
            onClick={() => onAddToPlaylist?.(movie)}
            className="group w-14 h-14 flex items-center justify-center rounded-[18px] bg-white/5 hover:bg-gradient-to-tr hover:from-white/20 hover:to-white/5 border border-white/5 hover:border-white/10 backdrop-blur-3xl transition-all duration-300 hover:scale-105 active:scale-95 outline-none hover:shadow-[0_10px_30px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)]"
            title="Add to Playlist"
          >
            <Plus size={22} strokeWidth={2} className="text-white transition-transform duration-300 group-hover:rotate-90" />
          </button>
        </div>
      </div>
    </div>
  );
};