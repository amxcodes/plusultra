// ... imports
import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { SocialService } from '../lib/social';
import { Profile, Playlist } from '../types';
import { UserPlus, UserMinus, Plus, Lock, Globe, Trash2, X, Search, Sparkles, TrendingUp, Users } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { ContinueWatchingCard } from './ContinueWatchingCard'; // Keep if used elsewhere or remove later
import { MovieCard } from './MovieCard';
import { Movie } from '../types';

interface ProfilePageProps {
    userId?: string; // If null, views own profile
    onNavigate?: (page: string, params?: any) => void;
    onMovieSelect?: (movie: Movie) => void;
}

// Types for Jikan API
interface JikanCharacter {
    mal_id: number;
    url: string;
    images: {
        jpg: {
            image_url: string;
            small_image_url: string;
        };
        webp: {
            image_url: string;
            small_image_url: string;
        };
    };
    name: string;
}

interface JikanResponse {
    data: JikanCharacter[];
}

// Avatar Selector Modal with Jikan API
const AvatarSelectorModal = ({ isOpen, onClose, onSelect, currentAvatar }: { isOpen: boolean; onClose: () => void; onSelect: (url: string) => void; currentAvatar?: string }) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [characters, setCharacters] = useState<JikanCharacter[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'top' | 'search'>('top');

    const debouncedQuery = useDebounce(searchQuery, 500);

    // Fetch Characters
    useEffect(() => {
        if (!isOpen) return;

        const fetchCharacters = async () => {
            setIsLoading(true);
            try {
                let url = '';
                if (activeTab === 'search' && debouncedQuery) {
                    url = `https://api.jikan.moe/v4/characters?q=${debouncedQuery}&limit=24&order_by=favorites&sort=desc`;
                } else {
                    url = `https://api.jikan.moe/v4/top/characters?limit=24`;
                }

                const res = await fetch(url);
                const data: JikanResponse = await res.json();
                setCharacters(data.data || []);
            } catch (e) {
                console.error("Failed to fetch characters", e);
            } finally {
                setIsLoading(false);
            }
        };

        fetchCharacters();
    }, [isOpen, activeTab, debouncedQuery]);

    useEffect(() => {
        if (searchQuery) setActiveTab('search');
    }, [searchQuery]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            {/* Backdrop: Removed black overlay, kept blur only */}
            <div className="absolute inset-0 backdrop-blur-sm fade-in" onClick={onClose} />

            {/* Modal Container */}
            <div className="relative w-[420px] max-h-[75vh] mb-32 bg-[#0f1014] border border-white/10 rounded-3xl shadow-2xl flex flex-col ring-1 ring-white/5 overflow-hidden fade-in-up">

                {/* Fixed Header Section: Transparent & Blended */}
                <div className="p-6 pb-0 space-y-6 flex-shrink-0 z-10 bg-[#0f1014]/90 backdrop-blur-md">

                    {/* Title & Close */}
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-xl font-bold text-white tracking-tight">Select Avatar</h3>
                            <p className="text-zinc-500 text-xs">Powered by MyAnimeList</p>
                        </div>
                        <button onClick={onClose} className="p-2 bg-zinc-800/50 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Split Logic: Left (Active) / Right (Search) */}
                    <div className="flex items-stretch gap-5 pb-6">
                        {/* Active Avatar Preview */}
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Current</span>
                            <div className="w-20 h-20 rounded-2xl overflow-hidden ring-2 ring-white/10 shadow-lg relative bg-zinc-900">
                                <img
                                    src={currentAvatar || `https://ui-avatars.com/api/?background=random`}
                                    className="w-full h-full object-cover"
                                    alt="Current"
                                />
                            </div>
                        </div>

                        {/* Search & Tabs Area */}
                        <div className="flex-1 flex flex-col gap-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search character..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/20 transition-all font-medium"
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setActiveTab('top'); setSearchQuery(""); }}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'top' ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-500 hover:text-white'}`}
                                >
                                    <TrendingUp size={13} /> Ranked
                                </button>
                                <button
                                    onClick={() => setActiveTab('search')}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'search' ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-500 hover:text-white'}`}
                                >
                                    <Sparkles size={13} /> Custom
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scrollable Content Wrapper */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-6">
                    <div className="min-h-[300px]">
                        {isLoading ? (
                            <div className="py-20 flex flex-col items-center justify-center gap-4 text-zinc-500">
                                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            </div>
                        ) : characters.length > 0 ? (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                {characters.map((char) => {
                                    const isActive = currentAvatar === char.images.jpg.image_url;
                                    return (
                                        <button
                                            key={char.mal_id}
                                            onClick={() => onSelect(char.images.jpg.image_url)}
                                            className={`group relative aspect-[3/4] rounded-xl overflow-hidden bg-zinc-800 transition-all duration-300 ${isActive ? 'ring-2 ring-white scale-95 shadow-xl shadow-white/10' : 'hover:scale-105 hover:shadow-lg hover:z-10'}`}
                                        >
                                            <img
                                                src={char.images.jpg.image_url}
                                                alt={char.name}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                            />
                                            {/* Active Indicator */}
                                            {isActive && (
                                                <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center">
                                                    <div className="w-6 h-6 bg-white rounded-full shadow-lg flex items-center justify-center">
                                                        <div className="w-2 h-2 bg-black rounded-full" />
                                                    </div>
                                                </div>
                                            )}
                                            {/* Hover Name Overlay */}
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2 pt-6 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center text-center">
                                                <span className="text-white text-[10px] font-bold truncate w-full">{char.name}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-20 flex flex-col items-center justify-center text-zinc-600">
                                <Search size={32} className="mb-2 opacity-20" />
                                <p className="text-xs font-medium">No characters found.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Minimal Input Modal
const CreatePlaylistModal = ({ isOpen, onClose, onSubmit }: { isOpen: boolean; onClose: () => void; onSubmit: (name: string, isPublic: boolean) => void }) => {
    const [name, setName] = useState("");
    const [isPublic, setIsPublic] = useState(true);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-sm fade-in-up">
            <div className="w-[400px] bg-[#0f1014] border border-white/10 rounded-2xl p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">New Playlist</h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <input
                    type="text"
                    placeholder="Playlist Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-zinc-600 transition-colors mb-4 placeholder:text-zinc-600"
                    autoFocus
                />

                <div className="flex items-center gap-3 mb-8 cursor-pointer group" onClick={() => setIsPublic(!isPublic)}>
                    <div className={`w-10 h-6 rounded-full p-1 transition-colors ${isPublic ? 'bg-white' : 'bg-zinc-800'}`}>
                        <div className={`w-4 h-4 rounded-full bg-black transition-transform ${isPublic ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                    <span className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors">
                        {isPublic ? 'Public Playlist' : 'Private Playlist'}
                    </span>
                </div>

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 text-zinc-400 font-medium hover:bg-zinc-900 rounded-xl transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={() => onSubmit(name, isPublic)}
                        disabled={!name.trim()}
                        className="flex-1 py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Create
                    </button>
                </div>
            </div>
        </div>
    );
};

// Minimal Confirm Modal
const DeleteConfirmModal = ({ isOpen, playlistName, onClose, onConfirm }: { isOpen: boolean; playlistName: string; onClose: () => void; onConfirm: () => void }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-sm fade-in-up">
            <div className="w-[360px] bg-[#0f1014] border border-white/10 rounded-2xl p-6 shadow-2xl text-center">
                <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trash2 size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Delete Playlist?</h3>
                <p className="text-zinc-500 text-sm mb-6">
                    Are you sure you want to delete <span className="text-white font-medium">"{playlistName}"</span>? This action cannot be undone.
                </p>

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2.5 text-zinc-400 font-medium hover:bg-zinc-900 rounded-xl transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-2.5 bg-red-500/10 text-red-500 border border-red-500/20 font-bold rounded-xl hover:bg-red-500 hover:text-white transition-all"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
};

export const ProfilePage: React.FC<ProfilePageProps> = ({ userId, onNavigate, onMovieSelect }) => {
    const { user: currentUser, isAdmin, refreshProfile } = useAuth();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [stats, setStats] = useState({ followers: 0, following: 0 });
    const [isFollowing, setIsFollowing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [watchHistory, setWatchHistory] = useState<any[]>([]); // Admin only

    // Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showAvatarModal, setShowAvatarModal] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Playlist | null>(null);

    // Determine which ID to fetch
    const targetId = userId || currentUser?.id;
    const isOwnProfile = currentUser?.id === targetId;

    useEffect(() => {
        if (!targetId) return;

        const loadData = async () => {
            setLoading(true);
            try {
                // If admin inspecting another user, we might want to fetch differently or force show private
                const [prof, plays, stat, checkFollow] = await Promise.all([
                    isAdmin && !isOwnProfile
                        ? SocialService.getPrivateProfile(targetId)
                        : SocialService.getProfile(targetId),
                    SocialService.getPlaylists(targetId), // This usually filters private. We need to manually filter if not own?
                    // actually getPlaylists returns all for own, and public for others.
                    // We need a way to get ALL for admin. SocialService.getPlaylists likely limits this via RLS.
                    // However, we just adjusted RLS to allow admins to view all.
                    // So getPlaylists needs to NOT filter in JS if it does.
                    // Looking at getPlaylists in social.ts... it just returns data.
                    SocialService.getFollowStats(targetId),
                    currentUser && !isOwnProfile ? SocialService.isFollowing(currentUser.id, targetId) : Promise.resolve(false)
                ]);

                // If Admin, fetch history
                if (isAdmin && !isOwnProfile) {
                    const history = await SocialService.getUserWatchHistory(targetId);
                    setWatchHistory(history);
                }

                setProfile(prof);
                // Client-side filter: If NOT match and NOT admin, filter private.
                // But RLS should handle security. We just display what we get.
                // If RLS works, Admin gets everything. User gets Public.
                setPlaylists(plays);
                setStats(stat);
                setIsFollowing(checkFollow);
            } catch (e) {
                console.error("Failed to load profile:", e);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [targetId, currentUser, isOwnProfile, isAdmin]);

    const handleFollow = async () => {
        if (!currentUser || !targetId) return;
        try {
            if (isFollowing) {
                await SocialService.unfollowUser(currentUser.id, targetId);
                setStats(s => ({ ...s, followers: s.followers - 1 }));
            } else {
                await SocialService.followUser(currentUser.id, targetId);
                setStats(s => ({ ...s, followers: s.followers + 1 }));
            }
            setIsFollowing(!isFollowing);
        } catch (e) {
            console.error("Follow action failed", e);
        }
    };

    const handleCreatePlaylist = async (name: string, isPublic: boolean) => {
        if (!currentUser) return;
        try {
            const newPlaylist = await SocialService.createPlaylist(currentUser.id, name, "", isPublic);
            if (newPlaylist) {
                // Initialize items array for UI
                const playlistWithItems = { ...newPlaylist, items: [] };
                setPlaylists([playlistWithItems, ...playlists]);
                setShowCreateModal(false);
            }
        } catch (e) {
            console.error("Failed to create playlist", e);
        }
    };

    const handleDeletePlaylist = async () => {
        if (!deleteTarget || !currentUser) return;
        try {
            await SocialService.deletePlaylist(deleteTarget.id);
            setPlaylists(prev => prev.filter(p => p.id !== deleteTarget.id));
            setDeleteTarget(null);
        } catch (e) {
            console.error("Failed to delete", e);
        }
    };

    const handleAvatarUpdate = async (url: string) => {
        if (!currentUser) return;
        try {
            // Update DB
            await SocialService.updateProfile(currentUser.id, { avatar_url: url });
            // Update Local State
            setProfile(prev => prev ? { ...prev, avatar_url: url } : null);
            // Refresh Global State (Navbar)
            await refreshProfile();
            setShowAvatarModal(false);
        } catch (e) {
            console.error("Failed to update avatar", e);
        }
    };

    if (loading) {
        return <div className="h-screen flex items-center justify-center text-zinc-500 font-light tracking-wide">loading...</div>;
    }

    if (!profile) {
        return <div className="h-screen flex items-center justify-center text-zinc-500">User not found</div>;
    }

    return (
        <div className="min-h-screen bg-[#0f1014] pt-20 px-4 md:px-12 pb-20 fade-in-up relative">

            <CreatePlaylistModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSubmit={handleCreatePlaylist}
            />

            <AvatarSelectorModal
                isOpen={showAvatarModal}
                onClose={() => setShowAvatarModal(false)}
                onSelect={handleAvatarUpdate}
                currentAvatar={profile.avatar_url}
            />

            <DeleteConfirmModal
                isOpen={!!deleteTarget}
                playlistName={deleteTarget?.name || ""}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDeletePlaylist}
            />

            {/* Minimal Header */}
            <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center md:items-start gap-8 mb-20">
                <div className="relative group cursor-pointer" onClick={() => isOwnProfile && setShowAvatarModal(true)}>
                    <img
                        src={profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.username}&background=10b981&color=fff&bold=true`}
                        alt={profile.username}
                        className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover shadow-2xl grayscale group-hover:grayscale-0 transition-all duration-700 ease-out"
                    />
                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    {isOwnProfile && (
                        <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white text-xs font-bold tracking-widest uppercase">Edit</span>
                        </div>
                    )}
                </div>

                <div className="flex-1 text-center md:text-left space-y-4">
                    <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tighter">{profile.username}</h1>

                    <div className="flex items-center justify-center md:justify-start gap-8 text-zinc-500 text-sm font-medium tracking-wide">
                        <div className="hover:text-white transition-colors cursor-default">
                            <span className="text-white block text-lg font-bold">{stats.followers}</span> Followers
                        </div>
                        <div className="hover:text-white transition-colors cursor-default">
                            <span className="text-white block text-lg font-bold">{stats.following}</span> Following
                        </div>
                        <div className="hover:text-white transition-colors cursor-default">
                            <span className="text-white block text-lg font-bold">{playlists.length}</span> Playlists
                        </div>
                    </div>

                    <div className="pt-2">
                        {!isOwnProfile && currentUser && (
                            <button
                                onClick={handleFollow}
                                className={`
                                    min-w-[140px] px-6 py-2.5 rounded-lg text-sm font-bold tracking-wide transition-all duration-300
                                    ${isFollowing
                                        ? 'bg-zinc-900 text-white hover:bg-red-500/10 hover:text-red-400 border border-zinc-800'
                                        : 'bg-white text-black hover:bg-gray-200 shadow-lg shadow-white/5'}
                                `}
                            >
                                {isFollowing ? 'Unfollow' : 'Follow'}
                            </button>
                        )}

                        {isOwnProfile && (
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="px-6 py-2.5 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 rounded-lg text-sm font-medium transition-all flex items-center gap-2 mx-auto md:mx-0"
                            >
                                <Plus size={16} /> New Playlist
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Playlists Grid - Minimal Cards */}
            <div className="max-w-6xl mx-auto">
                <h2 className="text-lg font-light text-zinc-500 mb-8 tracking-widest uppercase">Playlists</h2>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {playlists.map(playlist => {
                        // Collage Logic
                        const previewImages = playlist.items?.map(i => i.metadata?.poster_path ? `https://image.tmdb.org/t/p/w300${i.metadata.poster_path}` : null).filter(Boolean).slice(0, 4) as string[] || [];
                        const isSystem = playlist.type === 'watch_later' || playlist.type === 'favorites';

                        return (
                            <div
                                key={playlist.id}
                                onClick={() => onNavigate && onNavigate('playlist', { id: playlist.id })}
                                className="group cursor-pointer flex flex-col gap-3 relative"
                            >
                                {/* Thumbnail Container */}
                                <div className="aspect-square bg-zinc-900 rounded-lg overflow-hidden relative shadow-lg transition-transform duration-500 group-hover:-translate-y-1">
                                    {previewImages.length > 0 ? (
                                        <div className={`grid w-full h-full ${previewImages.length >= 4 ? 'grid-cols-2 grid-rows-2' : 'grid-cols-1'}`}>
                                            {previewImages.slice(0, previewImages.length >= 4 ? 4 : 1).map((src, idx) => (
                                                <img
                                                    key={idx}
                                                    src={src}
                                                    className="w-full h-full object-cover"
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-zinc-900 border border-white/5">
                                            <span className="text-4xl font-black text-zinc-800 select-none group-hover:text-zinc-700 transition-colors">
                                                {playlist.name[0]}
                                            </span>
                                        </div>
                                    )}

                                    {/* Overlay  */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                                </div>

                                {/* Text Info */}
                                <div>
                                    <h3 className="text-sm font-bold text-gray-200 group-hover:text-white truncate transition-colors">
                                        {playlist.name}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        {playlist.user_id !== (userId || currentUser?.id) ? (
                                            <div className="flex items-center gap-1 text-blue-400" title="Collaborative Playlist">
                                                <Users size={12} />
                                                <span className="text-xs font-medium">Shared</span>
                                            </div>
                                        ) : (
                                            playlist.is_public ?
                                                <Globe size={12} className="text-zinc-600" /> :
                                                <Lock size={12} className="text-zinc-600" />
                                        )}
                                        <span className="text-xs text-zinc-600 font-medium">
                                            • {playlist.items_count || playlist.items?.length || 0} tracks
                                        </span>
                                    </div>
                                </div>

                                {/* Delete Button (Hover) - Only for own custom playlists */}
                                {isOwnProfile && !isSystem && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(playlist); }}
                                        className="absolute top-2 right-2 p-2 bg-black/40 hover:bg-red-500/90 text-white/50 hover:text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all backdrop-blur-md translate-y-2 group-hover:translate-y-0 z-10"
                                        title="Delete Playlist"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        );
                    })}

                    {playlists.length === 0 && (
                        <div className="col-span-full py-20 text-center">
                            <p className="text-zinc-600">No playlists found.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Watch History - Admin Only */}
            {isAdmin && !isOwnProfile && watchHistory.length > 0 && (
                <div className="max-w-6xl mx-auto mt-16">
                    <h2 className="text-lg font-light text-zinc-500 mb-8 tracking-widest uppercase flex items-center gap-2">
                        Watch History
                        <span className="text-xs bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-zinc-600 font-bold">Admin</span>
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {watchHistory.map((item: any, idx: number) => {
                            // Construct Movie object for the card
                            const movie: Movie = {
                                id: parseInt(item.tmdbId) || 0,
                                tmdbId: item.tmdbId,
                                title: item.title || 'Unknown Title',
                                description: '',
                                imageUrl: (item.posterPath || item.posterUrl)?.startsWith('/')
                                    ? `https://image.tmdb.org/t/p/w500${item.posterPath || item.posterUrl}`
                                    : (item.posterPath || item.posterUrl) || '',
                                backdropUrl: item.backdropUrl,
                                year: new Date().getFullYear(), // Fallback
                                match: item.voteAverage || 0,
                                mediaType: item.type || 'movie',
                                // Inject hidden props for the card
                                ...item
                            } as unknown as Movie;

                            return (
                                <div key={idx} className="flex justify-center">
                                    <MovieCard
                                        movie={movie}
                                        onClick={() => onMovieSelect?.(movie)}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Recent Searches - Admin Only */}
            {isAdmin && !isOwnProfile && profile.recent_searches && profile.recent_searches.length > 0 && (
                <div className="max-w-6xl mx-auto mt-16 pb-20">
                    <h2 className="text-lg font-light text-zinc-500 mb-8 tracking-widest uppercase flex items-center gap-2">
                        <Search size={16} />
                        Recent Searches
                        <span className="text-xs bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-zinc-600 font-bold">Admin</span>
                    </h2>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {profile.recent_searches.map((search: string, idx: number) => (
                            <div key={idx} className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl flex items-center gap-3">
                                <Search size={16} className="text-zinc-600" />
                                <span className="text-zinc-300 font-medium truncate">{search}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
