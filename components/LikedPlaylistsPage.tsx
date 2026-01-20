
import React, { useEffect, useState } from 'react';
import { Playlist } from '../types';
import { PlaylistEngagement } from '../lib/playlistEngagement';
import { ChevronLeft } from 'lucide-react';
import { PlaylistRow } from './PlaylistRow';
/* 
  Reusing the MovieCard style for playlists (vertical cards) 
  But since we have a PlaylistRow component that handles cards well, 
  we can reuse that or manually map a grid.
  Since this is a full page, a grid is better.
*/

interface LikedPlaylistsPageProps {
    onBack?: () => void;
    onPlaylistSelect: (playlist: Playlist) => void;
}

export const LikedPlaylistsPage: React.FC<LikedPlaylistsPageProps> = ({ onBack, onPlaylistSelect }) => {
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const data = await PlaylistEngagement.getLikedPlaylists();
                setPlaylists(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (loading) return <div className="h-screen flex items-center justify-center text-zinc-500">loading...</div>;

    return (
        <div className="min-h-screen bg-[#0f1014] pt-24 px-4 md:px-12 pb-20 fade-in-up">
            <div className="max-w-7xl mx-auto">
                <button
                    onClick={onBack}
                    className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-600 transition-all mb-8 group"
                >
                    <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
                </button>

                <h1 className="text-4xl font-bold text-white mb-2">Liked Playlists</h1>
                <p className="text-zinc-500 mb-12">Collections you've saved from the community.</p>

                {playlists.length === 0 ? (
                    <div className="text-center py-20 bg-zinc-900/30 rounded-2xl border border-white/5">
                        <div className="text-4xl mb-4">💔</div>
                        <h3 className="text-xl font-semibold text-white mb-2">No liked playlists yet</h3>
                        <p className="text-zinc-500">Explore trending playlists and tap the heart to save them here.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                        {playlists.map((playlist) => {
                            const previewImages = playlist.items?.map(i => i.metadata?.poster_path ? `https://image.tmdb.org/t/p/w300${i.metadata.poster_path}` : null).filter(Boolean) as string[] || [];
                            return (
                                <div key={playlist.id} onClick={() => onPlaylistSelect(playlist)} className="cursor-pointer group flex flex-col gap-3 relative transform-gpu transition-transform duration-300 hover:scale-105">
                                    <div className="aspect-[2/3] bg-zinc-900 rounded-xl overflow-hidden relative shadow-lg border border-white/5 group-hover:border-white/30">
                                        {previewImages.length > 0 ? (
                                            <div className={`grid w-full h-full ${previewImages.length >= 4 ? 'grid-cols-2 grid-rows-2' : 'grid-cols-1'}`}>
                                                {previewImages.slice(0, 4).map((src, idx) => (
                                                    <img key={idx} src={src} className={`w-full h-full object-cover ${previewImages.length < 4 ? 'col-span-full row-span-full' : ''}`} alt="" />
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
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-200 group-hover:text-white truncate transition-colors">
                                            {playlist.name}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs text-zinc-500">by <span className="text-zinc-400">{playlist.profiles?.username || 'Unknown'}</span></span>
                                            {playlist.likes_count !== undefined && (
                                                <span className="text-xs text-zinc-500 flex items-center gap-1 ml-auto">
                                                    ❤️ {playlist.likes_count}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
