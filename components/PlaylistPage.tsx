
import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { SocialService } from '../lib/social';
import { Playlist, Movie } from '../types';
import { Trash2, Share2, ChevronLeft, X } from 'lucide-react';
import { MovieCard } from './MovieCard';

interface PlaylistPageProps {
    playlistId: string;
    onMovieSelect?: (movie: Movie) => void;
    onBack?: () => void;
}

// Minimal Confirm Modal for Item Removal
const RemoveItemModal = ({ isOpen, onClose, onConfirm }: { isOpen: boolean; onClose: () => void; onConfirm: () => void }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm fade-in-up">
            <div className="w-[360px] bg-[#0f1014] border border-white/10 rounded-2xl p-6 shadow-2xl text-center">
                <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trash2 size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Remove from Playlist?</h3>
                <p className="text-zinc-500 text-sm mb-6">
                    This movie will be removed from your list.
                </p>

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2.5 text-zinc-400 font-medium hover:bg-zinc-900 rounded-xl transition-colors">
                        Nah, keep it
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-2.5 bg-red-500/10 text-red-500 border border-red-500/20 font-bold rounded-xl hover:bg-red-500 hover:text-white transition-all"
                    >
                        Yes, remove
                    </button>
                </div>
            </div>
        </div>
    );
};

// Minimal Confirm Modal for Deleting Entire Playlist
const DeletePlaylistModal = ({ isOpen, onClose, onConfirm }: { isOpen: boolean; onClose: () => void; onConfirm: () => void }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm fade-in-up">
            <div className="w-[360px] bg-[#0f1014] border border-white/10 rounded-2xl p-6 shadow-2xl text-center">
                <div className="w-12 h-12 bg-red-500/10 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trash2 size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Delete Entire Playlist?</h3>
                <p className="text-zinc-500 text-sm mb-6">
                    This will permanently delete this playlist and all its contents. This action cannot be undone.
                </p>

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2.5 text-zinc-400 font-medium hover:bg-zinc-900 rounded-xl transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
                    >
                        Delete Playlist
                    </button>
                </div>
            </div>
        </div>
    );
};

export const PlaylistPage: React.FC<PlaylistPageProps> = ({ playlistId, onMovieSelect, onBack }) => {
    const { user } = useAuth();
    const [playlist, setPlaylist] = useState<Playlist | null>(null);
    const [items, setItems] = useState<Movie[]>([]);
    const [loading, setLoading] = useState(true);
    const [removeTargetId, setRemoveTargetId] = useState<string | null>(null);
    const [showDeletePlaylistModal, setShowDeletePlaylistModal] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                // Fetch items and details in parallel
                const [playlistItems, playlistDetails] = await Promise.all([
                    SocialService.getPlaylistItems(playlistId),
                    SocialService.getPlaylistDetails(playlistId)
                ]);

                setItems(playlistItems);
                setPlaylist(playlistDetails);
            } catch (e) {
                console.error("Failed to load playlist data:", e);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [playlistId]);

    const handleConfirmRemove = async () => {
        if (!removeTargetId) return;
        try {
            await SocialService.removeFromPlaylist(playlistId, removeTargetId);
            setItems(items.filter(i => i.id.toString() !== removeTargetId));
            setRemoveTargetId(null);
        } catch (e) {
            console.error("Failed to remove", e);
        }
    };

    const handleDeletePlaylist = async () => {
        if (!playlist) return;
        try {
            await SocialService.deletePlaylist(playlist.id);
            if (onBack) onBack();
        } catch (e) {
            console.error("Failed to delete playlist", e);
        }
    };

    if (loading) return <div className="h-screen flex items-center justify-center text-zinc-500 font-light tracking-wide">loading...</div>;

    const isOwner = user && playlist && user.id === playlist.user_id;
    const isSystem = playlist?.type === 'watch_later' || playlist?.type === 'favorites';

    return (
        <div className="min-h-screen bg-[#0f1014] pt-24 px-4 md:px-12 pb-20 fade-in-up relative">
            <RemoveItemModal
                isOpen={!!removeTargetId}
                onClose={() => setRemoveTargetId(null)}
                onConfirm={handleConfirmRemove}
            />

            <DeletePlaylistModal
                isOpen={showDeletePlaylistModal}
                onClose={() => setShowDeletePlaylistModal(false)}
                onConfirm={handleDeletePlaylist}
            />

            {/* Header */}
            <div className="max-w-7xl mx-auto mb-16">
                <button
                    onClick={onBack}
                    className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-600 transition-all mb-8 group"
                >
                    <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
                </button>

                <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pb-8 border-b border-zinc-800/50">
                    <div>
                        <h1 className="text-5xl md:text-6xl font-black text-white tracking-tighter mb-4">
                            {playlist?.name || (items.length === 0 ? 'Empty Playlist' : 'Playlist Content')}
                        </h1>
                        <p className="text-lg text-zinc-500 font-light flex items-center gap-3">
                            <span className="text-white font-bold">{items.length}</span> items stored
                        </p>
                    </div>
                    {/* Action Buttons */}
                    <div className="flex gap-4">
                        {isOwner && !isSystem && (
                            <button
                                onClick={() => setShowDeletePlaylistModal(true)}
                                className="px-6 py-3 rounded-xl font-bold flex items-center gap-2 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"
                            >
                                <Trash2 size={18} /> Delete Helper
                            </button>
                        )}
                        <button className="group px-6 py-3 rounded-xl font-bold flex items-center gap-3 bg-gradient-to-r from-zinc-900 to-zinc-900 border border-zinc-800 hover:border-pink-500/50 transition-all duration-300 shadow-lg shadow-black/20 hover:shadow-pink-500/10 active:scale-95">
                            <Share2 size={18} className="text-zinc-400 group-hover:text-white transition-colors" />
                            <span className="bg-gradient-to-r from-zinc-200 to-zinc-400 bg-clip-text text-transparent group-hover:from-white group-hover:to-pink-200 transition-all">
                                Share some love
                            </span>
                            <span className="text-red-500 group-hover:scale-125 transition-transform duration-300 inline-block">
                                ❤️
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 gap-y-12">
                {items.map(movie => (
                    <div key={movie.id} className="relative group">
                        <div onClick={() => onMovieSelect && onMovieSelect(movie)} className="cursor-pointer">
                            <MovieCard movie={movie} />
                        </div>

                        {/* Remove Button - styled minimally */}
                        <button
                            onClick={(e) => { e.stopPropagation(); setRemoveTargetId(movie.id.toString()); }}
                            className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-red-500 text-white/70 hover:text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all backdrop-blur-md translate-y-2 group-hover:translate-y-0"
                            title="Remove from playlist"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}

                {items.length === 0 && (
                    <div className="col-span-full py-32 text-center">
                        <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Trash2 size={40} className="text-zinc-700" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">This playlist is empty</h3>
                        <p className="text-zinc-500">Go explore and add some movies!</p>
                    </div>
                )}
            </div>
        </div>
    );
};
