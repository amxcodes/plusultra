import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Globe, Lock } from 'lucide-react';
import { Playlist } from '../types';

interface PlaylistRowProps {
    title: string;
    playlists: Playlist[];
    onPlaylistSelect: (playlist: Playlist) => void;
}

export const PlaylistRow: React.FC<PlaylistRowProps> = ({ title, playlists, onPlaylistSelect }) => {
    const rowRef = useRef<HTMLDivElement>(null);
    const [showLeft, setShowLeft] = useState(false);
    const [showRight, setShowRight] = useState(true);

    const handleScroll = () => {
        if (rowRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
            setShowLeft(scrollLeft > 0);
            setShowRight(scrollLeft < scrollWidth - clientWidth - 10);
        }
    };

    const handleClick = (direction: 'left' | 'right') => {
        if (rowRef.current) {
            const { scrollLeft, clientWidth } = rowRef.current;
            const scrollTo = direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth;
            rowRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
        }
    };

    if (!playlists || playlists.length === 0) return null;

    return (
        <div className="pl-4 md:pl-12 my-8 relative group z-10">
            <h2 className="text-xl md:text-2xl font-semibold mb-4 text-white/90 hover:text-white transition-colors cursor-pointer pl-2">
                {title}
            </h2>

            <div className="relative group">
                {/* Left Button */}
                <div className={`absolute top-0 bottom-0 left-0 z-[60] flex items-center justify-center w-12 transition-opacity duration-300 ${showLeft ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <button onClick={() => handleClick("left")} className="bg-black/60 backdrop-blur-md border border-white/20 rounded-full p-2 text-white hover:bg-white hover:text-black transition-all transform hover:scale-110 active:scale-95 shadow-xl">
                        <ChevronLeft size={24} />
                    </button>
                </div>

                {/* Row Container */}
                <div ref={rowRef} onScroll={handleScroll} className="flex items-center space-x-4 overflow-x-scroll scrollbar-hide md:space-x-6 px-4 py-8" style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
                    {playlists.map((playlist) => {
                        const previewImages = playlist.items?.map(i => i.poster_path ? `https://image.tmdb.org/t/p/w200${i.poster_path}` : null).filter(Boolean) as string[] || [];

                        return (
                            <div key={playlist.id} onClick={() => onPlaylistSelect(playlist)} className="min-w-[160px] w-[160px] md:min-w-[200px] md:w-[200px] cursor-pointer group/card flex flex-col gap-3 relative transform-gpu transition-transform duration-300 hover:scale-105">
                                <div className="aspect-[2/3] bg-zinc-900 rounded-xl overflow-hidden relative shadow-lg border border-white/5 group-hover/card:border-white/30">
                                    {previewImages.length > 0 ? (
                                        <div className={`grid w-full h-full ${previewImages.length >= 9 ? 'grid-cols-3 grid-rows-3' :
                                                previewImages.length >= 4 ? 'grid-cols-2 grid-rows-2' :
                                                    'grid-cols-1'
                                            }`}>
                                            {previewImages.slice(0, 9).map((src, idx) => (
                                                <img key={idx} src={src} className={`w-full h-full object-cover ${previewImages.length < 4 ? 'col-span-full row-span-full' : ''
                                                    } ${
                                                    /* Fill logic for edge cases if needed, but simple slice is usually enough */ ''
                                                    }`} alt="" />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-zinc-900 border border-white/5">
                                            <span className="text-4xl font-black text-zinc-800 select-none group-hover/card:text-zinc-700 transition-colors">
                                                {playlist.name[0]}
                                            </span>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/20 transition-colors duration-300" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-gray-200 group-hover/card:text-white truncate transition-colors">
                                        {playlist.name}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-zinc-500">by <span className="text-zinc-400">{playlist.profiles?.username || 'Unknown'}</span></span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Right Button */}
                <div className={`absolute top-0 bottom-0 right-0 z-[60] flex items-center justify-center w-12 transition-opacity duration-300 ${showRight ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <button onClick={() => handleClick("right")} className="bg-black/60 backdrop-blur-md border border-white/20 rounded-full p-2 text-white hover:bg-white hover:text-black transition-all transform hover:scale-110 active:scale-95 shadow-xl">
                        <ChevronRight size={24} />
                    </button>
                </div>
            </div>
        </div>
    );
};
