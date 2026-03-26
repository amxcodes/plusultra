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
        className="relative group/card min-w-[160px] w-[160px] md:min-w-[200px] md:w-[200px] cursor-pointer"
      >
        <div className="relative aspect-[2/3] rounded-[24px] overflow-hidden bg-[#0a0a0a] border border-white/5 group-hover/card:border-white/10 group-hover/card:shadow-[0_10px_40px_rgba(0,0,0,0.5)] transform-gpu transition-all duration-500 group-hover/card:-translate-y-2">
          <img
            src={movie.imageUrl}
            alt={movie.title}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover/card:scale-105"
            loading="lazy"
            decoding="auto"
          />

          {/* Hover Overlay */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover/card:opacity-100 transition-all duration-500 flex flex-col items-center justify-center gap-4">
            
            <div className="flex items-center gap-3">
              {/* Play Button */}
              <div className="w-12 h-12 rounded-[18px] bg-gradient-to-tr from-white/20 to-white/5 hover:from-white/30 hover:to-white/10 backdrop-blur-xl border border-white/5 flex items-center justify-center transform translate-y-4 opacity-0 group-hover/card:translate-y-0 group-hover/card:opacity-100 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] delay-75 shadow-[0_10px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:border-white/10 text-white">
                <Play className="fill-white ml-0.5" size={20} strokeWidth={1.5} />
              </div>

              {/* Add to Playlist Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPlaylistModal(true);
                }}
                className="w-12 h-12 rounded-[18px] bg-white/5 hover:bg-gradient-to-tr hover:from-white/20 hover:to-white/5 backdrop-blur-xl border border-white/5 flex items-center justify-center transform translate-y-4 opacity-0 group-hover/card:translate-y-0 group-hover/card:opacity-100 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] delay-100 shadow-xl hover:shadow-[0_10px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] text-white outline-none focus:outline-none hover:border-white/10"
                title="Add to Playlist"
              >
                <ListPlus size={20} strokeWidth={1.5} />
              </button>
            </div>
            
          </div>

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80 pointer-events-none" />
        </div>

        {/* Text Area */}
        <div className="mt-4 px-2 opacity-60 group-hover/card:opacity-100 transition-opacity duration-300">
          <h3 className="text-[13px] tracking-wide font-bold text-white truncate drop-shadow-md">{movie.title}</h3>
          <p className="text-[10px] tracking-widest uppercase font-bold text-zinc-500 mt-1.5">{movie.year} {movie.genre?.[0] ? `• ${movie.genre[0]}` : ''}</p>
        </div>
      </div>

      {showPlaylistModal && (
        <AddToPlaylistModal
          movie={movie}
          onClose={() => setShowPlaylistModal(false)}
        />
      )}
    </>
  );
};