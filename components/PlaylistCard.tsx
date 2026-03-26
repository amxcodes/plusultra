import React from 'react';
import { Playlist } from '../types';
import { Play, Trash2, Heart } from 'lucide-react';

interface PlaylistCardProps {
    playlist: Playlist;
    aspectRatio?: 'square' | 'portrait'; // portrait is 2/3
    onClick?: () => void;
    onDelete?: (e: React.MouseEvent) => void;
    subtitle?: React.ReactNode;
}

export const PlaylistCard: React.FC<PlaylistCardProps> = ({
    playlist,
    aspectRatio = 'square',
    onClick,
    onDelete,
    subtitle,
}) => {
    const previewImages = playlist.items
        ?.map(i => i.metadata?.poster_path ? `https://image.tmdb.org/t/p/w300${i.metadata.poster_path}` : null)
        .filter(Boolean)
        .slice(0, 4) as string[] || [];

    const aspectClass = aspectRatio === 'portrait' ? 'aspect-[2/3]' : 'aspect-square';

    return (
        <div
            onClick={onClick}
            className="relative group/card cursor-pointer w-full flex flex-col transition-transform duration-300 active:scale-95"
        >
            <div className={`relative ${aspectClass} rounded-[24px] overflow-hidden bg-[#0a0a0a] border border-white/5 group-hover/card:border-white/10 group-hover/card:shadow-[0_10px_40px_rgba(0,0,0,0.5)] transform-gpu transition-all duration-500 group-hover/card:-translate-y-2`}>
                
                {/* Collage Backing */}
                {previewImages.length > 0 ? (
                    <div className={`grid w-full h-full ${previewImages.length >= 4 ? 'grid-cols-2 grid-rows-2' : 'grid-cols-1'}`}>
                        {previewImages.slice(0, previewImages.length >= 4 ? 4 : 1).map((src, idx) => (
                            <img
                                key={idx}
                                src={src}
                                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover/card:scale-105"
                                loading="lazy"
                            />
                        ))}
                    </div>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 border border-white/5 transition-transform duration-700 group-hover/card:scale-105">
                        <span className="text-5xl font-black text-zinc-800 select-none transition-colors group-hover/card:text-zinc-700">
                            {playlist.name[0]}
                        </span>
                    </div>
                )}

                {/* Dark Glass Hover Overlay containing the central Play Button */}
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover/card:opacity-100 transition-all duration-500 flex flex-col items-center justify-center gap-4 z-10">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-white/20 to-white/5 hover:from-white/30 hover:to-white/10 backdrop-blur-xl border border-white/5 flex items-center justify-center transform translate-y-4 opacity-0 group-hover/card:translate-y-0 group-hover/card:opacity-100 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] delay-75 shadow-[0_10px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:border-white/10 text-white">
                        <Play className="fill-white ml-0.5" size={24} strokeWidth={1.5} />
                    </div>
                </div>

                {/* Ambient Base Gradient to darken the poster slightly at the bottom */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80 pointer-events-none" />

                {/* Top Right Likes Badge (if standard playlist grid) */}
                {playlist.likes_count !== undefined && playlist.likes_count > 0 && (
                    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-full flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-white border border-white/10 shadow-xl z-20">
                        <Heart size={12} className="fill-white text-white" />
                        {playlist.likes_count}
                    </div>
                )}

                {/* Hover Delete Button if User Owns the Playlist */}
                {onDelete && (
                    <button
                        onClick={onDelete}
                        className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center bg-black/50 hover:bg-red-500/90 border border-white/10 text-white/70 hover:text-white rounded-full opacity-0 group-hover/card:opacity-100 transition-all duration-300 backdrop-blur-xl translate-y-2 group-hover/card:translate-y-0 z-20 shadow-lg"
                        title="Delete Playlist"
                    >
                        <Trash2 size={16} strokeWidth={2} />
                    </button>
                )}
            </div>

            {/* Text Area explicitly mirroring MovieCard spacing and typography */}
            <div className="mt-4 px-2 opacity-60 group-hover/card:opacity-100 transition-opacity duration-300">
                <h3 className="text-[13px] tracking-wide font-bold text-white truncate drop-shadow-md">{playlist.name}</h3>
                {subtitle && (
                    <div className="text-[10px] tracking-widest uppercase font-bold text-zinc-500 mt-1.5 flex items-center gap-2">
                        {subtitle}
                    </div>
                )}
            </div>
        </div>
    );
};
