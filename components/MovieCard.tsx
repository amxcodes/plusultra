import React from 'react';
import { Movie } from '../types';
import { Play } from 'lucide-react';

interface MovieCardProps {
  movie: Movie;
}

export const MovieCard: React.FC<MovieCardProps> = ({ movie }) => {
  return (
    <div className="relative group/card min-w-[160px] w-[160px] md:min-w-[200px] md:w-[200px] cursor-pointer transform-gpu transition-transform duration-300 hover:scale-105">
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-gray-900 border border-white/10 group-hover/card:border-white/30">
        <img
          src={movie.imageUrl}
          alt={movie.title}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />

        {/* Hover Overlay - Simplified for performance */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          {/* Minimal Play Button: Solid White, No Blur/Glass */}
          <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center transform scale-50 opacity-0 group-hover/card:scale-100 group-hover/card:opacity-100 transition-all duration-300 ease-out">
            <Play className="text-black fill-black ml-1" size={24} />
          </div>
        </div>

        {/* Gradient Overlay for Text Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 pointer-events-none" />
      </div>

      <div className="mt-3 px-1 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300">
        <h3 className="text-sm font-bold text-white truncate">{movie.title}</h3>
        <p className="text-xs text-gray-400 mt-1">{movie.year} • {movie.genre?.[0]}</p>
      </div>
    </div>
  );
};