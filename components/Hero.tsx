import React from 'react';
import { HeroMovie } from '../types';
import { Play, Plus } from 'lucide-react';

interface HeroProps {
  movie: HeroMovie;
  onPlay?: (movie: HeroMovie) => void;
  onAddToPlaylist?: (movie: HeroMovie) => void;
}

export const Hero: React.FC<HeroProps> = ({ movie, onPlay, onAddToPlaylist }) => {
  return (
    <div className="relative w-full h-[85vh] overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 w-full h-full">
        <img
          src={movie.backdropUrl || movie.imageUrl}
          alt={movie.title}
          className="w-full h-full object-cover object-center"
        />
        {/* Gradients - Smoother bottom fade, kept minimal */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f1014] via-[#0f1014]/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f1014]/80 via-transparent to-transparent" />
      </div>

      {/* Content - Increased bottom padding to prevent collision with the negative margin list below */}
      <div className="absolute bottom-0 left-0 pl-24 md:pl-32 pr-8 w-full md:w-2/3 lg:w-1/2 flex flex-col gap-6 z-10 pb-36 md:pb-40">
        {/* Tagline Badge */}
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-none tracking-tight drop-shadow-2xl max-w-7xl mb-6">
          {movie.title}
        </h1>

        <div className="flex items-center gap-4 text-sm font-medium text-gray-200 mb-6">
          <span className="text-green-400 font-bold">{movie.match}% Match</span>
          <span>{movie.year}</span>
          <span className="bg-white/10 px-2 py-0.5 rounded text-[10px] font-semibold border border-white/10 backdrop-blur-md">4K</span>
          <span className="bg-white/10 px-2 py-0.5 rounded text-[10px] font-semibold border border-white/10 backdrop-blur-md">5.1</span>
        </div>

        {/* Minimalist Glassy Buttons - Fixed gaps and styling */}
        <div className="flex items-center gap-4 mt-2">
          <button
            onClick={() => onPlay?.(movie)}
            className="flex items-center gap-3 bg-white/90 hover:bg-white backdrop-blur-sm text-black px-8 py-3.5 rounded-2xl font-semibold tracking-wide transition-all duration-300 hover:scale-105"
          >
            <Play size={18} className="fill-black" />
            <span>Play</span>
          </button>

          <button
            onClick={() => onAddToPlaylist?.(movie)}
            className="w-14 h-14 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 flex items-center justify-center transition-all duration-300 text-white hover:scale-105"
          >
            <Plus size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};