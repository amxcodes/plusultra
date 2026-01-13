
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Lock, Globe, Check, Image as ImageIcon, LayoutGrid, List } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { SocialService } from '../lib/social';
import { Playlist, Movie } from '../types';

interface AddToPlaylistModalProps {
    movie: Movie;
    onClose: () => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({ movie, onClose }) => {
    const { user } = useAuth();
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [loading, setLoading] = useState(true);

    // Creation State
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [isPublic, setIsPublic] = useState(true);
    const inputRef = useRef<HTMLInputElement>(null);

    // Track which playlists contain this movie
    const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!user) return;
        const loadPlaylists = async () => {
            try {
                const data = await SocialService.getPlaylists(user.id);
                setPlaylists(data);
            } catch (e) {
                console.error("Failed to load playlists", e);
            } finally {
                setLoading(false);
            }
        };
        loadPlaylists();
    }, [user]);

    // Focus input when creation mode starts
    useEffect(() => {
        if (isCreating && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isCreating]);

    const handleCreate = async () => {
        if (!user || !newName.trim()) return;
        try {
            const newList = await SocialService.createPlaylist(user.id, newName, '', isPublic);
            if (newList) {
                // Optimistically add
                const formattedList = { ...newList, items_count: 0, items: [] };
                setPlaylists([formattedList, ...playlists]);
                setIsCreating(false);
                setNewName('');
            }
        } catch (e) {
            console.error("Failed to create playlist", e);
        }
    };

    const handleTogglePlaylist = async (playlistId: string) => {
        const isAdded = addedIds.has(playlistId);

        // Optimistic Update
        setAddedIds(prev => {
            const next = new Set(prev);
            if (isAdded) next.delete(playlistId);
            else next.add(playlistId);
            return next;
        });

        // Update count visually
        setPlaylists(prev => prev.map(p => {
            if (p.id === playlistId) {
                return {
                    ...p,
                    items_count: (p.items_count || 0) + (isAdded ? -1 : 1)
                };
            }
            return p;
        }));

        try {
            if (isAdded) {
                await SocialService.removeFromPlaylist(playlistId, movie.id.toString());
            } else {
                await SocialService.addToPlaylist(playlistId, movie);
            }
        } catch (e) {
            console.error("Failed to toggle playlist item", e);
            // Revert
            setAddedIds(prev => {
                const next = new Set(prev);
                if (isAdded) next.add(playlistId);
                else next.delete(playlistId);
                return next;
            });
            setPlaylists(prev => prev.map(p => {
                if (p.id === playlistId) {
                    return {
                        ...p,
                        items_count: (p.items_count || 0) + (isAdded ? 1 : -1)
                    };
                }
                return p;
            }));
        }
    };

    if (!user) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="w-full max-w-md bg-[#121214] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Visual Header with Movie Backdrop */}
                <div className="relative h-32 w-full bg-zinc-900 group shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-t from-[#121214] to-transparent z-10" />
                    {movie.backdropUrl || movie.imageUrl ? (
                        <img
                            src={movie.backdropUrl || movie.imageUrl}
                            className="w-full h-full object-cover opacity-60"
                            alt={movie.title}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-700">
                            <ImageIcon size={48} />
                        </div>
                    )}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 z-20 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white/80 hover:text-white transition-colors backdrop-blur-sm"
                    >
                        <X size={18} />
                    </button>
                    <div className="absolute bottom-4 left-6 z-20">
                        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Add to Playlist</p>
                        <h2 className="text-xl font-bold text-white line-clamp-1">{movie.title}</h2>
                    </div>
                </div>

                {/* Playlist List */}
                <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-40 text-zinc-500 gap-3">
                            <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
                            <span className="text-xs">Loading playlists...</span>
                        </div>
                    ) : (
                        playlists.length > 0 ? (
                            playlists.map(list => {
                                const isAdded = addedIds.has(list.id);
                                return (
                                    <button
                                        key={list.id}
                                        onClick={() => handleTogglePlaylist(list.id)}
                                        className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all border border-transparent
                                            ${isAdded ? 'bg-zinc-800/60 border-zinc-700/50' : 'hover:bg-white/5'}
                                        `}
                                    >
                                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 transition-colors
                                            ${isAdded ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-600'}`}>
                                            {isAdded ? (
                                                <Check size={24} strokeWidth={3} />
                                            ) : (
                                                list.items?.[0]?.metadata?.poster_path ? (
                                                    <img src={list.items[0].metadata.poster_path} className="w-full h-full object-cover rounded-lg opacity-80" />
                                                ) : (
                                                    <LayoutGrid size={20} />
                                                )
                                            )}
                                        </div>

                                        <div className="flex-1 text-left">
                                            <div className={`font-semibold text-sm ${isAdded ? 'text-white' : 'text-zinc-200'}`}>
                                                {list.name}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                                                <span className="flex items-center gap-1">
                                                    {list.is_public ? <Globe size={10} /> : <Lock size={10} />}
                                                    {list.is_public ? 'Public' : 'Private'}
                                                </span>
                                                <span className="w-1 h-1 rounded-full bg-zinc-600" />
                                                <span>{list.items_count || 0} movies</span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })
                        ) : (
                            !isCreating && (
                                <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-4">
                                    <List size={40} strokeWidth={1} className="text-zinc-700" />
                                    <p className="text-sm">No playlists yet</p>
                                </div>
                            )
                        )
                    )}
                </div>

                {/* Footer / Creator Area */}
                <div className="p-4 bg-[#18181b] border-t border-white/5 shrink-0">
                    {isCreating ? (
                        <div className="animate-in slide-in-from-bottom-4 fade-in duration-300">
                            <div className="flex items-center justify-between mb-3 text-sm">
                                <span className="font-semibold text-white">New Playlist</span>
                                <button
                                    onClick={() => setIsCreating(false)}
                                    className="text-zinc-500 hover:text-white transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="flex gap-3">
                                <div className="relative flex-1 group">
                                    <input
                                        ref={inputRef}
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        placeholder="Playlist Name"
                                        className="w-full bg-[#09090b] border border-zinc-800 text-white text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 placeholder:text-zinc-600 shadow-inner"
                                        onKeyDown={e => e.key === 'Enter' && handleCreate()}
                                    />
                                </div>
                                <button
                                    onClick={() => setIsPublic(!isPublic)}
                                    className={`px-3 rounded-xl border flex items-center justify-center gap-2 transition-all w-12 shrink-0
                                        ${isPublic
                                            ? 'bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700'
                                            : 'bg-[#09090b] border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                                    title={isPublic ? "Public" : "Private"}
                                >
                                    {isPublic ? <Globe size={18} /> : <Lock size={18} />}
                                </button>
                            </div>

                            <button
                                onClick={handleCreate}
                                disabled={!newName.trim()}
                                className="w-full mt-3 bg-white hover:bg-zinc-200 text-black font-bold h-11 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-lg shadow-white/5"
                            >
                                Create Playlist
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsCreating(true)}
                            className="w-full h-12 flex items-center justify-center gap-2 bg-[#09090b] hover:bg-zinc-900 text-zinc-300 hover:text-white rounded-xl font-medium transition-all border border-zinc-800 hover:border-zinc-700 shadow-sm group"
                        >
                            <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-zinc-700 transition-colors">
                                <Plus size={14} />
                            </div>
                            Create New Playlist
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
