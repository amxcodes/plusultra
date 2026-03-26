import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Globe, Lock, Heart } from 'lucide-react';
import { Playlist } from '../types';
import { PlaylistCard } from './PlaylistCard';

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

                <div ref={rowRef} onScroll={handleScroll} className="flex items-center space-x-4 overflow-x-scroll scrollbar-hide md:space-x-6 px-4 py-8" style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
                    {playlists.map((playlist) => {
                        const subtitle = (
                            <span className="text-[10px] text-zinc-500 flex items-center gap-1 uppercase tracking-widest">by <span className="text-zinc-400 font-bold">{playlist.profiles?.username || 'Unknown'}</span></span>
                        );
                        
                        return (
                            <div key={playlist.id} className="min-w-[160px] w-[160px] md:min-w-[200px] md:w-[200px] flex-shrink-0 relative">
                                <PlaylistCard
                                    playlist={playlist}
                                    aspectRatio="portrait"
                                    onClick={() => onPlaylistSelect(playlist)}
                                    subtitle={subtitle}
                                />
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
