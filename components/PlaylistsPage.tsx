
import React, { useEffect, useState } from 'react';
import { Playlist } from '../types';
import { PlaylistEngagement } from '../lib/playlistEngagement';
import { ChevronLeft, Flame, Sparkles, Heart } from 'lucide-react';
import { PlaylistRow } from './PlaylistRow';
import { PlaylistCard } from './PlaylistCard';
import { getDisplayName } from '../lib/displayName';
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
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-10">
                {playlists.map((playlist) => {
                    const ownerName = getDisplayName(playlist.profiles?.username);
                    const subtitle = (
                        <span className="text-[10px] text-zinc-500 flex items-center gap-1 uppercase tracking-widest">by <span className="text-zinc-400 font-bold">{ownerName}</span></span>
                    );
                    return (
                        <div key={playlist.id} className="w-full flex justify-center">
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
                    <div className="flex p-1.5 bg-black/40 backdrop-blur-xl rounded-full border border-white/5 z-10 shadow-2xl relative">
                        {/* Animated Selection Pill overlay logic can be done with absolute positioning if desired, but applying styling directly for now */}
                        <button
                            onClick={() => setViewMode('discover')}
                            className={`px-8 py-2.5 rounded-full text-xs uppercase tracking-widest font-bold transition-all duration-300 transform active:scale-95 ${
                                viewMode === 'discover' 
                                    ? 'bg-gradient-to-tr from-white/20 to-white/5 border border-white/10 text-white shadow-[0_10px_30px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] backdrop-blur-3xl relative z-10' 
                                    : 'bg-transparent text-zinc-500 hover:text-zinc-300 border border-transparent'
                            }`}
                        >
                            Discover
                        </button>
                        <button
                            onClick={() => setViewMode('liked')}
                            className={`px-8 py-2.5 rounded-full text-xs uppercase tracking-widest font-bold transition-all duration-300 transform active:scale-95 ${
                                viewMode === 'liked' 
                                    ? 'bg-gradient-to-tr from-white/20 to-white/5 border border-white/10 text-white shadow-[0_10px_30px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] backdrop-blur-3xl relative z-10' 
                                    : 'bg-transparent text-zinc-500 hover:text-zinc-300 border border-transparent'
                            }`}
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
