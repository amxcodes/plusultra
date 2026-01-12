import React, { useState } from 'react';
import { Movie } from '../types';
import { Play, ListPlus } from 'lucide-react';
import { AddToPlaylistModal } from './AddToPlaylistModal';

interface MovieCardProps {
  movie: Movie;
  onClick?: () => void;
}

export const MovieCard: React.FC<MovieCardProps> = ({ movie, onClick }) => {
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

  return (
    <>
      <div
        onClick={onClick}
        className="relative group/card min-w-[160px] w-[160px] md:min-w-[200px] md:w-[200px] cursor-pointer transform-gpu transition-transform duration-300 hover:scale-105"
      >
        <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-gray-900 border border-white/10 group-hover/card:border-white/30">
          <img
            src={movie.imageUrl}
            alt={movie.title}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="auto"
          />

          {/* Hover Overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-4">
            {/* Play Button */}
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center transform scale-50 opacity-0 group-hover/card:scale-100 group-hover/card:opacity-100 transition-all duration-300 ease-out delay-75 shadow-xl">
              <Play className="text-black fill-black ml-1" size={20} />
            </div>

            {/* Add to Playlist Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPlaylistModal(true);
              }}
              className="w-10 h-10 rounded-full bg-black/40 border-2 border-white/50 hover:border-white hover:bg-white hover:text-black text-white flex items-center justify-center transform scale-50 opacity-0 group-hover/card:scale-100 group-hover/card:opacity-100 transition-all duration-300 ease-out delay-100"
              title="Add to Playlist"
            >
              <ListPlus size={18} />
            </button>
          </div>

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 pointer-events-none" />
        </div>

        <div className="mt-3 px-1 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300">
          <h3 className="text-sm font-bold text-white truncate">{movie.title}</h3>
          <p className="text-xs text-gray-400 mt-1">{movie.year} • {movie.genre?.[0]}</p>
        </div>
      </div>

      {/* Render Modal if Active (at root level ideally but here works via fixed position) */}
      {showPlaylistModal && (
        <AddToPlaylistModal
          movie={movie}
          onClose={() => setShowPlaylistModal(false)}
        />
      )}
    </>
  );
};