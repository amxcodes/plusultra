import React, { useState, useEffect } from 'react';
import { X, UserMinus, Shield, Eye, Loader2 } from 'lucide-react';
import { SocialService } from '../lib/social';
import { PlaylistCollaborator } from '../types';
import { useAuth } from '../lib/AuthContext';

interface CollaboratorsListProps {
    isOpen: boolean;
    onClose: () => void;
    playlistId: string;
    isOwner: boolean;
}

export const CollaboratorsList: React.FC<CollaboratorsListProps> = ({
    isOpen,
    onClose,
    playlistId,
    isOwner
}) => {
    const { user } = useAuth();
    const [collaborators, setCollaborators] = useState<PlaylistCollaborator[]>([]);
    const [loading, setLoading] = useState(true);
    const [removingId, setRemovingId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && playlistId) {
            loadCollaborators();
        }
    }, [isOpen, playlistId]);

    const loadCollaborators = async () => {
        setLoading(true);
        try {
            const data = await SocialService.getCollaborators(playlistId);
            // Sort: Owner first (if we have owner record?), then Accepted, then Pending
            setCollaborators(data);
        } catch (e) {
            console.error("Failed to load collaborators", e);
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async (collaboratorId: string) => {
        if (!isOwner) return;
        setRemovingId(collaboratorId);
        try {
            await SocialService.removeCollaborator(collaboratorId);
            setCollaborators(prev => prev.filter(c => c.id !== collaboratorId));
        } catch (e) {
            console.error("Failed to remove collaborator", e);
        } finally {
            setRemovingId(null);
        }
    };

    if (!isOpen) return null;

    // Filter to show only Accepted and Pending (rejected usually hidden or deleted)
    const activeCollaborators = collaborators.filter(c => c.status !== 'rejected');

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 fade-in pb-20 md:pb-0">
            <div className="w-full max-w-sm bg-[#0f1014] border border-white/10 rounded-2xl shadow-2xl overflow-hidden scale-in">

                {/* Header */}
                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
                    <h2 className="text-lg font-bold text-white">Collaborators</h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                {/* List Body */}
                <div className="p-4 min-h-[200px] max-h-[400px] overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center h-40 text-zinc-500">
                            <Loader2 size={24} className="animate-spin" />
                        </div>
                    ) : activeCollaborators.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3 text-zinc-600">
                                <Shield size={24} />
                            </div>
                            <p className="text-zinc-500 text-sm">No collaborators yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {activeCollaborators.map(collab => (
                                <div key={collab.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800">
                                            <img
                                                src={collab.profile?.avatar_url || `https://ui-avatars.com/api/?name=${collab.profile?.username || 'User'}`}
                                                alt={collab.profile?.username}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div>
                                            <div className="text-white font-medium text-sm">
                                                {collab.profile?.username || 'Unknown User'}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${collab.role === 'editor' ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-500/20 text-zinc-400'
                                                    }`}>
                                                    {collab.role}
                                                </span>
                                                {collab.status === 'pending' && (
                                                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                                                        Pending
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {isOwner && (
                                        <button
                                            onClick={() => handleRemove(collab.id)}
                                            disabled={removingId === collab.id}
                                            className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                            title="Remove Collaborator"
                                        >
                                            {removingId === collab.id ? (
                                                <Loader2 size={16} className="animate-spin" />
                                            ) : (
                                                <UserMinus size={16} />
                                            )}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
