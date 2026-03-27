
import React, { useEffect, useState } from 'react';
import { Playlist } from '../types';
import { PlaylistEngagement } from '../lib/playlistEngagement';
import { ChevronLeft } from 'lucide-react';
import { PlaylistRow } from './PlaylistRow';
import { PlaylistCard } from './PlaylistCard';
import { getDisplayName } from '../lib/displayName';
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
                )}
            </div>
        </div>
    );
};
