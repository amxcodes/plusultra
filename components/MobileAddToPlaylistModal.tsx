
import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Lock, Globe, Check, Image as ImageIcon, LayoutGrid, List, ChevronRight } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { SocialService } from '../lib/social';
import { Playlist, Movie } from '../types';

interface MobileAddToPlaylistModalProps {
    movie: Movie;
    onClose: () => void;
}

export const MobileAddToPlaylistModal: React.FC<MobileAddToPlaylistModalProps> = ({ movie, onClose }) => {
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
            // slightly delay to allow animation
            setTimeout(() => inputRef.current?.focus(), 100);
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

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Centered Card */}
            <div className="relative w-full max-w-xs bg-[#121214] rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">

                {/* Content */}
                <div className="flex flex-col flex-1 overflow-hidden">

                    {/* Header */}
                    <div className="px-6 py-4 flex items-center justify-start gap-4 border-b border-white/5 bg-[#121214]">
                        <div className="w-12 h-16 rounded bg-zinc-800 overflow-hidden shrink-0 shadow-lg">
                            <img src={movie.posterUrl || movie.imageUrl} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-lg font-bold text-white truncate">{movie.title}</h2>
                            <p className="text-zinc-500 text-xs font-medium">Add to Playlist</p>
                        </div>
                        <button onClick={onClose} className="p-2 bg-zinc-900 rounded-full text-zinc-400">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Playlists */}
                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 custom-scrollbar">
                        {loading ? (
                            <div className="py-10 flex justify-center">
                                <div className="animate-spin w-6 h-6 border-2 border-white/20 border-t-white rounded-full" />
                            </div>
                        ) : (
                            playlists.map(list => {
                                const isAdded = addedIds.has(list.id);
                                return (
                                    <button
                                        key={list.id}
                                        onClick={() => handleTogglePlaylist(list.id)}
                                        className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all border ${isAdded
                                            ? 'bg-white text-black border-transparent shadow-lg shadow-white/10'
                                            : 'bg-zinc-900/50 text-zinc-300 border-white/5 active:scale-[0.98]'
                                            }`}
                                    >
                                        {/* Icon */}
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isAdded ? 'bg-black text-white' : 'bg-zinc-800 text-zinc-500'
                                            }`}>
                                            {isAdded ? <Check size={18} strokeWidth={3} /> : <List size={18} />}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 text-left">
                                            <div className="font-bold text-sm leading-none mb-1">{list.name}</div>
                                            <div className="flex items-center gap-2 text-[10px] font-medium opacity-60">
                                                <span>{list.is_public ? 'Public' : 'Private'}</span>
                                                <span className="w-0.5 h-0.5 bg-current rounded-full" />
                                                <span>{list.items_count || 0} items</span>
                                            </div>
                                        </div>

                                        {/* Action Status */}
                                        {isAdded && (
                                            <div className="text-[10px] font-bold uppercase tracking-wider bg-black/10 px-2 py-1 rounded">
                                                Added
                                            </div>
                                        )}
                                    </button>
                                );
                            })
                        )}

                        {!loading && playlists.length === 0 && !isCreating && (
                            <div className="text-center py-10 text-zinc-500">
                                No playlists found. Create one?
                            </div>
                        )}
                    </div>

                    {/* Footer - Create New */}
                    <div className="p-4 bg-[#09090b] border-t border-white/5 pb-8 safe-area-bottom">
                        {isCreating ? (
                            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">New Playlist</span>
                                    <button onClick={() => setIsCreating(false)} className="text-zinc-500 p-1"><X size={16} /></button>
                                </div>

                                <div className="flex gap-3">
                                    <input
                                        ref={inputRef}
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        placeholder="Playlist Name"
                                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-white/20"
                                    />
                                    <button
                                        onClick={() => setIsPublic(!isPublic)}
                                        className={`w-12 flex items-center justify-center rounded-xl border ${isPublic ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
                                    >
                                        {isPublic ? <Globe size={20} /> : <Lock size={20} />}
                                    </button>
                                </div>

                                <button
                                    onClick={handleCreate}
                                    disabled={!newName.trim()}
                                    className="w-full bg-white text-black font-bold h-12 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-transform"
                                >
                                    Create Playlist
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsCreating(true)}
                                className="w-full bg-zinc-900 text-white font-bold h-12 rounded-xl border border-white/10 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                            >
                                <Plus size={18} />
                                Create New Playlist
                            </button>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};
