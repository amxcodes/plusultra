
import React, { useEffect, useState } from 'react';
import { Playlist } from '../types';
import { PlaylistEngagement } from '../lib/playlistEngagement';
import { ChevronLeft, Flame, Sparkles, Heart } from 'lucide-react';
import { PlaylistRow } from './PlaylistRow';
/* 
  Reusing the MovieCard style for playlists (vertical cards) 
  But since we have a PlaylistRow component that handles cards well, 
  we can reuse that or manually map a grid.
  Since this is a full page, a grid is better.
*/

interface PlaylistsPageProps {
    onBack?: () => void;
    onPlaylistSelect: (playlist: Playlist) => void;
}

type ViewMode = 'discover' | 'liked';

export const PlaylistsPage: React.FC<PlaylistsPageProps> = ({ onBack, onPlaylistSelect }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('discover');
    const [trendingPlaylists, setTrendingPlaylists] = useState<Playlist[]>([]);
    const [popularPlaylists, setPopularPlaylists] = useState<Playlist[]>([]);
    const [mostLikedPlaylists, setMostLikedPlaylists] = useState<Playlist[]>([]);
    const [likedPlaylists, setLikedPlaylists] = useState<Playlist[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [trending, popular, mostLiked, liked] = await Promise.all([
                    PlaylistEngagement.getTrendingThisWeek(12),
                    PlaylistEngagement.getPopularThisMonth(12),
                    PlaylistEngagement.getMostLikedAllTime(12),
                    PlaylistEngagement.getLikedPlaylists()
                ]);
                setTrendingPlaylists(trending);
                setPopularPlaylists(popular);
                setMostLikedPlaylists(mostLiked);
                setLikedPlaylists(liked);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const renderGrid = (playlists: Playlist[], emptyMessage: string, emptyIcon: React.ReactNode) => {
        if (playlists.length === 0) {
            return (
                <div className="text-center py-20 bg-zinc-900/30 rounded-2xl border border-white/5 mx-auto max-w-2xl">
                    <div className="text-zinc-600 mb-4 flex justify-center">{emptyIcon}</div>
                    <h3 className="text-xl font-semibold text-white mb-2">{emptyMessage}</h3>
                </div>
            );
        }

        return (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {playlists.map((playlist) => {
                    const previewImages = playlist.items?.map(i => i.metadata?.poster_path ? `https://image.tmdb.org/t/p/w300${i.metadata.poster_path}` : null).filter(Boolean) as string[] || [];
                    return (
                        <div key={playlist.id} onClick={() => onPlaylistSelect(playlist)} className="cursor-pointer group flex flex-col gap-3 relative transform-gpu transition-transform duration-300 hover:scale-105">
                            <div className="aspect-[2/3] bg-zinc-900 rounded-xl overflow-hidden relative shadow-lg border border-white/5 group-hover:border-white/30">
                                {previewImages.length > 0 ? (
                                    <div className={`grid w-full h-full ${previewImages.length >= 4 ? 'grid-cols-2 grid-rows-2' : 'grid-cols-1'}`}>
                                        {previewImages.slice(0, previewImages.length >= 4 ? 4 : 1).map((src, idx) => (
                                            <img key={idx} src={src} className="w-full h-full object-cover" alt="" />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-zinc-900 border border-white/5">
                                        <span className="text-4xl font-black text-zinc-800 select-none group-hover:text-zinc-700 transition-colors">
                                            {playlist.name[0]}
                                        </span>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                                {playlist.likes_count !== undefined && playlist.likes_count > 0 && (
                                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-full flex items-center gap-1.5 text-[10px] font-bold text-white border border-white/10 shadow-xl z-20">
                                        <Heart size={12} className="fill-white text-white" />
                                        {playlist.likes_count}
                                    </div>
                                )}
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-200 group-hover:text-white truncate transition-colors">
                                    {playlist.name}
                                </h3>
                                <div className="flex items-center justify-between mt-1">
                                    <span className="text-xs text-zinc-500">by <span className="text-zinc-400">{playlist.profiles?.username || 'Unknown'}</span></span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    if (loading) return (
        <div className="min-h-screen bg-[#0f1014] pt-4 px-4 md:px-12 pb-20 fade-in-up">
            <div className="max-w-7xl mx-auto">
                {/* Header Skeleton */}
                <div className="relative h-12 flex items-center justify-center mb-8 animate-pulse">
                    <div className="h-10 w-64 bg-zinc-900 rounded-full" />
                </div>

                {/* Sections Skeleton */}
                <div className="space-y-12 animate-pulse">
                    {[1, 2, 3].map(section => (
                        <div key={section}>
                            <div className="h-8 w-48 bg-white/5 rounded mb-6" />
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                                {[1, 2, 3, 4, 5, 6].map(card => (
                                    <div key={card} className="flex flex-col gap-3">
                                        <div className="aspect-[2/3] bg-zinc-900 rounded-xl border border-white/5" />
                                        <div className="space-y-2">
                                            <div className="h-4 w-3/4 bg-zinc-900 rounded" />
                                            <div className="h-3 w-1/2 bg-zinc-900 rounded" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#0f1014] pt-4 px-4 md:px-12 pb-20 fade-in-up">
            <div className="max-w-7xl mx-auto">
                <div className="relative h-12 flex items-center justify-center mb-8">
                    <button
                        onClick={onBack}
                        className="absolute left-0 w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-600 transition-all group lg:hidden z-20"
                    >
                        <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
                    </button>

                    {/* View Switcher */}
                    <div className="flex p-1 bg-zinc-900/50 backdrop-blur-md rounded-full border border-white/10 z-10">
                        <button
                            onClick={() => setViewMode('discover')}
                            className={`px-8 py-2 rounded-full text-sm font-bold transition-all duration-300 ${viewMode === 'discover' ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'text-zinc-500 hover:text-white'}`}
                        >
                            Discover
                        </button>
                        <button
                            onClick={() => setViewMode('liked')}
                            className={`px-8 py-2 rounded-full text-sm font-bold transition-all duration-300 ${viewMode === 'liked' ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'text-zinc-500 hover:text-white'}`}
                        >
                            My Liked
                        </button>
                    </div>
                </div>

                {viewMode === 'discover' ? (
                    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <section>
                            <div className="flex items-center gap-2 mb-6">
                                <h2 className="text-2xl font-bold text-white">Trending This Week</h2>
                            </div>
                            {renderGrid(trendingPlaylists, "No trending playlists right now", <Flame size={48} />)}
                        </section>

                        <section>
                            <div className="flex items-center gap-2 mb-6">
                                <h2 className="text-2xl font-bold text-white">Popular This Month</h2>
                            </div>
                            {renderGrid(popularPlaylists, "No popular playlists found", <Sparkles size={48} />)}
                        </section>

                        <section>
                            <div className="flex items-center gap-2 mb-6">
                                <h2 className="text-2xl font-bold text-white">Most Liked All Time</h2>
                            </div>
                            {renderGrid(mostLikedPlaylists, "No loved playlists yet", <Heart size={48} />)}
                        </section>
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-2 mb-6">
                            <h2 className="text-2xl font-bold text-white">Liked Collection</h2>
                        </div>
                        {renderGrid(likedPlaylists, "You haven't liked any playlists yet", <Heart size={48} />)}
                    </div>
                )}
            </div>
        </div>
    );
};
