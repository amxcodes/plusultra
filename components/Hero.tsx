import React from 'react';
import { HeroMovie } from '../types';
import { Play, Plus } from 'lucide-react';

interface HeroProps {
  movie: HeroMovie;
  onPlay?: (movie: HeroMovie) => void;
  onAddToPlaylist?: (movie: HeroMovie) => void;
}

export const Hero: React.FC<HeroProps> = ({ movie, onPlay, onAddToPlaylist }) => {
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
      <div className="absolute bottom-0 left-0 pl-6 md:pl-32 pr-6 md:pr-8 w-full md:w-2/3 lg:w-1/2 flex flex-col gap-2 md:gap-4 z-10 pb-24 md:pb-40">
        {/* Tagline Badge */}
        {/* Tagline Badge */}
        <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold text-white leading-[0.95] tracking-tighter drop-shadow-2xl max-w-4xl mb-2 line-clamp-3 md:line-clamp-4">
          {movie.title}
        </h1>

        <div className="flex items-center gap-3 text-sm font-medium text-gray-300 mb-6 tracking-wide">
          <span className="text-green-400 font-bold drop-shadow-sm">{movie.match}% Match</span>
          <span className="text-zinc-500">•</span>
          <span className="text-white/90">{movie.year}</span>
          <span className="text-zinc-500">•</span>
          <span className="text-white/80">{movie.duration || "2h 15m"}</span>
          <span className="text-zinc-500">•</span>
          {/* Genre if available */}
          {movie.genre && movie.genre.length > 0 && (
            <>
              <span className="text-white/80">{movie.genre[0]}</span>
              <span className="text-zinc-500">•</span>
            </>
          )}
          <span className="text-[10px] font-bold text-zinc-400 border border-white/10 px-1 rounded uppercase tracking-wider">4K</span>
        </div>

        {/* Description / Logline - Premium Feature */}
        <p className="text-sm md:text-lg text-gray-300 font-light leading-relaxed max-w-2xl mb-6 md:mb-8 line-clamp-3 drop-shadow-md">
          {movie.description || "Unravel the mystery of a nightmarish town in middle America that traps all those who enter. As the unwilling residents fight to keep a sense of normalcy and search for a way out, they must also survive the threats of the surrounding forest."}
        </p>

        {/* Minimal Buttons - No glass, no bounce */}
        {/* Minimal Buttons */}
        <div className="flex items-center gap-4 pt-2">
          <button
            onClick={() => onPlay?.(movie)}
            className="flex items-center gap-3 bg-white hover:bg-zinc-200 text-black px-8 py-3.5 rounded-full font-bold tracking-wide transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg shadow-white/10"
          >
            <Play size={20} className="fill-black" />
            <span>Play</span>
          </button>

          <button
            onClick={() => onAddToPlaylist?.(movie)}
            className="group w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 border border-white/5 backdrop-blur-sm transition-all duration-300 hover:scale-105 active:scale-95"
            title="Add to Playlist"
          >
            <Plus size={24} className="text-white group-hover:text-white transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
};