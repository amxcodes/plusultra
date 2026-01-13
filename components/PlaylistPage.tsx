
import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { SocialService } from '../lib/social';
import { PlaylistEngagement } from '../lib/playlistEngagement';
import { Playlist, Movie } from '../types';
import { Trash2, Share2, ChevronLeft, X, CheckCircle, Heart, Eye, Edit2, Check } from 'lucide-react';
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
    const [siteUrl, setSiteUrl] = useState('');
    const [copied, setCopied] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState('');

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                window.scrollTo(0, 0);
                // Track View first (non-blocking)
                PlaylistEngagement.trackView(playlistId);

                // Fetch items, details, and like status in parallel
                const [playlistItems, playlistDetails, liked] = await Promise.all([
                    SocialService.getPlaylistItems(playlistId),
                    SocialService.getPlaylistDetails(playlistId),
                    PlaylistEngagement.checkIfLiked(playlistId)
                ]);

                setItems(playlistItems);
                setPlaylist(playlistDetails);
                if (playlistDetails) setLikeCount(playlistDetails.likes_count || 0);

                setSiteUrl(window.location.origin);
                setIsLiked(liked);
            } catch (e) {
                console.error("Failed to load playlist data:", e);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [playlistId]);

    const handleLikeToggle = async () => {
        if (!playlist) return;

        // Optimistic update
        const newStatus = !isLiked;
        setIsLiked(newStatus);
        setLikeCount(prev => newStatus ? prev + 1 : Math.max(0, prev - 1));

        if (newStatus) {
            await PlaylistEngagement.likePlaylist(playlist.id);
        } else {
            await PlaylistEngagement.unlikePlaylist(playlist.id);
        }
    };

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

    const handleShare = () => {
        // Strip trailing slash from siteUrl if present to prevent double slash (//)
        const baseUrl = siteUrl ? siteUrl.replace(/\/$/, '') : window.location.origin;
        const link = `${baseUrl}/playlist/${playlistId}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSaveName = async () => {
        if (!playlist || !editedName.trim()) return;

        try {
            await SocialService.updatePlaylist(playlist.id, { name: editedName.trim() });
            setPlaylist({ ...playlist, name: editedName.trim() });
            setIsEditingName(false);
        } catch (error) {
            console.error('Error updating playlist name:', error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0f1014] pt-24 px-4 md:px-12 pb-20 fade-in-up relative">
                {/* Header Skeleton */}
                <div className="max-w-7xl mx-auto mb-16 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-zinc-900 mb-8 border border-zinc-800" />

                    <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pb-8 border-b border-zinc-800/50">
                        <div className="space-y-4 w-full md:w-auto">
                            <div className="h-10 md:h-14 w-2/3 md:w-96 bg-zinc-900 rounded-xl" />
                            <div className="h-6 w-48 bg-zinc-900 rounded-lg" />
                        </div>
                        <div className="flex gap-4">
                            <div className="w-24 h-12 bg-zinc-900 rounded-xl" />
                            <div className="w-40 h-12 bg-zinc-900 rounded-xl" />
                        </div>
                    </div>
                </div>

                {/* Grid Skeleton */}
                <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 gap-y-12 animate-pulse">
                    {[...Array(12)].map((_, i) => (
                        <div key={i} className="flex flex-col gap-3">
                            <div className="aspect-[2/3] bg-zinc-900 rounded-xl border border-white/5" />
                            <div className="space-y-2">
                                <div className="h-4 w-3/4 bg-zinc-900 rounded" />
                                <div className="h-3 w-1/2 bg-zinc-900 rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

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
                        {isEditingName ? (
                            <div className="flex items-center gap-3 mb-4">
                                <input
                                    type="text"
                                    value={editedName}
                                    onChange={(e) => setEditedName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveName();
                                        if (e.key === 'Escape') setIsEditingName(false);
                                    }}
                                    className="text-5xl md:text-6xl font-black text-white tracking-tighter bg-transparent border-b-2 border-white/20 focus:border-white outline-none flex-1"
                                    autoFocus
                                />
                                <button
                                    onClick={handleSaveName}
                                    className="p-3 bg-white text-black rounded-xl hover:bg-white/90 transition-all"
                                >
                                    <Check size={24} />
                                </button>
                                <button
                                    onClick={() => setIsEditingName(false)}
                                    className="p-3 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-all"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 mb-4 group/title">
                                <h1 className="text-5xl md:text-6xl font-black text-white tracking-tighter">
                                    {playlist?.name || (items.length === 0 ? 'Empty Playlist' : 'Playlist Content')}
                                </h1>
                                {isOwner && !isSystem && (
                                    <button
                                        onClick={() => {
                                            setEditedName(playlist?.name || '');
                                            setIsEditingName(true);
                                        }}
                                        className="p-2 text-zinc-600 hover:text-white hover:bg-zinc-900 rounded-lg transition-all opacity-0 group-hover/title:opacity-100"
                                    >
                                        <Edit2 size={20} />
                                    </button>
                                )}
                            </div>
                        )}
                        <p className="text-lg text-zinc-500 font-light flex items-center gap-4">
                            <span className="flex items-center gap-2"><Eye size={16} /> {(playlist?.analytics?.total_views || 0).toLocaleString()} views</span>
                            <span className="text-zinc-700">•</span>
                            <span className="text-white font-bold">{items.length}</span> items stored
                        </p>
                    </div>
                    {/* Action Buttons */}
                    <div className="flex gap-4">
                        <button
                            onClick={handleLikeToggle}
                            className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 border transition-all ${isLiked ? 'bg-pink-500/10 text-pink-500 border-pink-500/50' : 'bg-black/20 text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-white'}`}
                        >
                            <Heart size={20} className={isLiked ? "fill-pink-500" : ""} />
                            <span>{likeCount}</span>
                        </button>

                        {isOwner && !isSystem && (
                            <button
                                onClick={() => setShowDeletePlaylistModal(true)}
                                className="px-6 py-3 rounded-xl font-bold flex items-center gap-2 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"
                            >
                                <Trash2 size={18} /> Delete Helper
                            </button>
                        )}
                        <button
                            onClick={handleShare}
                            className="group px-6 py-3 rounded-xl font-bold flex items-center gap-3 bg-gradient-to-r from-zinc-900 to-zinc-900 border border-zinc-800 hover:border-pink-500/50 transition-all duration-300 shadow-lg shadow-black/20 hover:shadow-pink-500/10 active:scale-95"
                        >
                            {copied ? <CheckCircle size={18} className="text-green-400" /> : <Share2 size={18} className="text-zinc-400 group-hover:text-white transition-colors" />}
                            <span className={`bg-clip-text text-transparent transition-all ${copied ? 'bg-green-400' : 'bg-gradient-to-r from-zinc-200 to-zinc-400 group-hover:from-white group-hover:to-pink-200'}`}>
                                {copied ? 'Link Copied!' : 'Share Playlist'}
                            </span>
                            {!copied && (
                                <span className="text-red-500 group-hover:scale-125 transition-transform duration-300 inline-block">
                                    ❤️
                                </span>
                            )}
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
