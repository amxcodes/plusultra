import React, { useState, useEffect } from 'react';
import { X, Search, UserPlus, Check, Loader2, Link } from 'lucide-react';
import { SocialService } from '../lib/social';
import { Profile } from '../types';
import { useAuth } from '../lib/AuthContext';

interface InviteCollaboratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    playlistId: string;
    playlistName: string;
}

export const InviteCollaboratorModal: React.FC<InviteCollaboratorModalProps> = ({
    isOpen,
    onClose,
    playlistId,
    playlistName
}) => {
    const { user } = useAuth();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Profile[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [pendingInvites, setPendingInvites] = useState<Set<string>>(new Set());
    const [existingCollaborators, setExistingCollaborators] = useState<Set<string>>(new Set());
    const [loadingCollabs, setLoadingCollabs] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && playlistId) {
            loadExistingCollaborators();
        } else {
            setQuery('');
            setResults([]);
            setError('');
        }
    }, [isOpen, playlistId]);

    useEffect(() => {
        const searchTimeout = setTimeout(async () => {
            if (query.trim().length >= 2) {
                setIsSearching(true);
                try {
                    const users = await SocialService.searchUsers(query);
                    // Filter out self and existing collaborators (if we want to hide them, or just disable button)
                    setResults(users.filter(u => u.id !== user?.id));
                } catch (e) {
                    console.error("Search failed", e);
                } finally {
                    setIsSearching(false);
                }
            } else {
                setResults([]);
            }
        }, 300);

        return () => clearTimeout(searchTimeout);
    }, [query, user]);

    const loadExistingCollaborators = async () => {
        setLoadingCollabs(true);
        try {
            const collabs = await SocialService.getCollaborators(playlistId);
            const collabSet = new Set(collabs.map(c => c.user_id));
            setExistingCollaborators(collabSet);
        } catch (e) {
            console.error("Failed to load collaborators", e);
        } finally {
            setLoadingCollabs(false);
        }
    };

    const handleInvite = async (targetUser: Profile) => {
        setPendingInvites(prev => new Set(prev).add(targetUser.id));
        setError('');
        try {
            await SocialService.inviteCollaborator(playlistId, targetUser.id);
            setExistingCollaborators(prev => new Set(prev).add(targetUser.id));
        } catch (e: any) {
            console.error("Invite failed", e);
            setError('Failed to send invite. Try again.');
            setPendingInvites(prev => {
                const next = new Set(prev);
                next.delete(targetUser.id);
                return next;
            });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 fade-in">
            <div className="w-full max-w-md bg-[#0f1014] border border-white/10 rounded-2xl shadow-2xl overflow-hidden scale-in">

                {/* Header */}
                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
                    <div>
                        <h2 className="text-lg font-bold text-white">Invite Collaborators</h2>
                        <p className="text-zinc-500 text-xs truncate max-w-[200px]">
                            to "{playlistName}"
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                {/* Search Body */}
                <div className="p-4 space-y-4">
                    {/* Search Input */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search by username..."
                            className="w-full bg-zinc-900/50 border border-white/10 text-white rounded-xl py-3 pl-10 pr-4 placeholder:text-zinc-600 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all"
                            autoFocus
                        />
                    </div>

                    {/* Results List */}
                    <div className="min-h-[200px] max-h-[300px] overflow-y-auto custom-scrollbar space-y-2">
                        {isSearching ? (
                            <div className="flex items-center justify-center h-20 text-zinc-500 gap-2">
                                <Loader2 size={20} className="animate-spin" />
                                <span className="text-sm">Searching...</span>
                            </div>
                        ) : query.length < 2 ? (
                            <div className="text-center py-8">
                                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3 text-zinc-600">
                                    <UserPlus size={24} />
                                </div>
                                <p className="text-zinc-500 text-sm">Search for users to invite</p>
                            </div>
                        ) : results.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-zinc-500 text-sm">No users found for "{query}"</p>
                            </div>
                        ) : (
                            results.map(result => {
                                const isInvited = existingCollaborators.has(result.id);
                                const isPending = pendingInvites.has(result.id);

                                return (
                                    <div key={result.id} className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800">
                                                <img
                                                    src={result.avatar_url || `https://ui-avatars.com/api/?name=${result.username}`}
                                                    alt={result.username}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="text-left">
                                                <div className="text-white font-medium text-sm">{result.username}</div>
                                                {/* <div className="text-zinc-600 text-[10px] uppercase font-bold">User</div> */}
                                            </div>
                                        </div>

                                        {isInvited ? (
                                            <button disabled className="px-3 py-1.5 bg-green-500/10 text-green-500 text-xs font-bold rounded-lg border border-green-500/20 flex items-center gap-1 cursor-default">
                                                <Check size={14} /> Invited
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleInvite(result)}
                                                disabled={isPending}
                                                className="px-3 py-1.5 bg-white text-black text-xs font-bold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                            >
                                                {isPending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                                                Invite
                                            </button>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Footer or Magic Link Copy (Optional) */}
                <div className="p-4 bg-zinc-900/30 border-t border-white/5 text-center">
                    {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
                    <p className="text-zinc-600 text-[10px]">
                        Collaborators will receive a notification to join.
                    </p>
                </div>
            </div>
        </div>
    );
};
