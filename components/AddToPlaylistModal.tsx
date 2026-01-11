
import React, { useState, useEffect } from 'react';
import { X, Plus, Lock, Globe, Check } from 'lucide-react';
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
    const [creatingNew, setCreatingNew] = useState(false);

    // New Playlist State
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [isPublic, setIsPublic] = useState(true);

    // Status tracking for added items (simple local feedback)
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

    const handleCreate = async () => {
        if (!user || !newName.trim()) return;
        try {
            const newList = await SocialService.createPlaylist(user.id, newName, newDesc, isPublic);
            if (newList) {
                setPlaylists([newList, ...playlists]);
                setCreatingNew(false);
                setNewName('');
                setNewDesc('');
                // Optionally auto-add? Let's just select it.
            }
        } catch (e) {
            console.error("Failed to create playlist", e);
        }
    };

    const handleTogglePlaylist = async (playlistId: string) => {
        // In a real app we'd check if it's already in there. 
        // For now, we just attempt to ADD. If it fails (duplicate), we ignore. 
        // Ideally we'd show a "Check" if it's already in.
        // Since we don't fetch "is in playlist" status for every list, we'll just show success upon click.
        try {
            await SocialService.addToPlaylist(playlistId, movie);
            setAddedIds(prev => new Set(prev).add(playlistId));
        } catch (e) {
            console.error("Failed to add to playlist", e);
        }
    };

    if (!user) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-[#151518] border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/5">
                    <h2 className="text-lg font-bold text-white">Add to Playlist</h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={20} className="text-zinc-400 hover:text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 max-h-[60vh] overflow-y-auto">

                    {/* Movie Preview */}
                    <div className="flex items-center gap-4 mb-6 bg-white/5 p-3 rounded-xl">
                        <img src={movie.imageUrl} className="w-12 h-16 object-cover rounded bg-black" />
                        <div>
                            <h3 className="font-semibold text-white text-sm line-clamp-1">{movie.title}</h3>
                            <p className="text-xs text-zinc-500">{movie.year} • {movie.mediaType === 'tv' ? 'TV Series' : 'Movie'}</p>
                        </div>
                    </div>

                    {/* List of Playlists */}
                    {loading ? (
                        <div className="text-center py-8 text-zinc-500">Loading playlists...</div>
                    ) : (
                        <div className="space-y-2">
                            {playlists.map(list => {
                                const isAdded = addedIds.has(list.id);
                                return (
                                    <button
                                        key={list.id}
                                        onClick={() => handleTogglePlaylist(list.id)}
                                        disabled={isAdded}
                                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all
                                    ${isAdded
                                                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                                                : 'bg-zinc-900 border-white/5 hover:bg-zinc-800 hover:border-white/10 text-white'}
                                `}
                                    >
                                        <div className="text-left">
                                            <div className="font-medium text-sm">{list.name}</div>
                                            <div className="text-[10px] text-zinc-500 flex items-center gap-1">
                                                {list.is_public ? <Globe size={10} /> : <Lock size={10} />}
                                                {list.items_count || 0} items
                                            </div>
                                        </div>
                                        {isAdded ? <Check size={18} /> : <Plus size={18} className="text-zinc-500" />}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {!loading && playlists.length === 0 && !creatingNew && (
                        <div className="text-center py-6 text-zinc-500 text-sm">
                            No playlists found. Create one below!
                        </div>
                    )}
                </div>

                {/* Footer / Create New */}
                <div className="p-4 border-t border-white/5 bg-zinc-900/50">
                    {creatingNew ? (
                        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                            <input
                                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20"
                                placeholder="Playlist Name"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                autoFocus
                            />
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleCreate}
                                    disabled={!newName.trim()}
                                    className="flex-1 bg-white text-black text-sm font-bold py-2 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                                >
                                    Create
                                </button>
                                <button
                                    onClick={() => setCreatingNew(false)}
                                    className="px-3 py-2 bg-white/5 rounded-lg text-white hover:bg-white/10"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                                    <input type="radio" checked={isPublic} onChange={() => setIsPublic(true)} className="accent-white" />
                                    Public
                                </label>
                                <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                                    <input type="radio" checked={!isPublic} onChange={() => setIsPublic(false)} className="accent-white" />
                                    Private
                                </label>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setCreatingNew(true)}
                            className="w-full py-2 flex items-center justify-center gap-2 text-sm font-medium text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/5 border-dashed"
                        >
                            <Plus size={16} /> Create New Playlist
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
};
