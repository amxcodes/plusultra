import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { SocialService } from '../lib/social';
import { Profile, Playlist, Movie } from '../types';
import { Plus, Lock, Globe, Trash2, X, Search, Sparkles, TrendingUp } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { MovieCard } from './MovieCard';


// --- DUPLICATED / SIMPLIFIED MODALS FOR MOBILE ---

interface JikanCharacter {
    mal_id: number;
    url: string;
    images: { jpg: { image_url: string; }; };
    name: string;
}

const MobileAvatarModal = ({ isOpen, onClose, onSelect, currentAvatar }: { isOpen: boolean; onClose: () => void; onSelect: (url: string) => void; currentAvatar?: string }) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [characters, setCharacters] = useState<JikanCharacter[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const debouncedQuery = useDebounce(searchQuery, 500);

    useEffect(() => {
        if (!isOpen) return;
        const fetchCharacters = async () => {
            setIsLoading(true);
            try {
                const url = debouncedQuery
                    ? `https://api.jikan.moe/v4/characters?q=${debouncedQuery}&limit=20&order_by=favorites&sort=desc`
                    : `https://api.jikan.moe/v4/top/characters?limit=20`;
                const res = await fetch(url);
                const data = await res.json();
                setCharacters(data.data || []);
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchCharacters();
    }, [isOpen, debouncedQuery]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-md flex flex-col pt-10">
            <div className="flex items-center justify-between px-6 pb-4">
                <h3 className="text-xl font-bold text-white">Select Avatar</h3>
                <button onClick={onClose} className="p-2 bg-zinc-800 rounded-full text-white"><X size={20} /></button>
            </div>

            <div className="px-6 mb-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                    <input
                        type="text"
                        placeholder="Search Anime Characters..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-zinc-800/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-20 grid grid-cols-3 gap-3">
                {isLoading ? (
                    <div className="col-span-3 text-center py-10 text-zinc-500">Loading...</div>
                ) : (
                    characters.map((char) => (
                        <button
                            key={char.mal_id}
                            onClick={() => onSelect(char.images.jpg.image_url)}
                            className={`relative aspect-[3/4] rounded-xl overflow-hidden bg-zinc-800 ${currentAvatar === char.images.jpg.image_url ? 'ring-2 ring-white' : ''}`}
                        >
                            <img src={char.images.jpg.image_url} alt={char.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-1">
                                <span className="text-white text-[9px] font-bold block truncate">{char.name}</span>
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---

interface MobileProfilePageProps {
    userId?: string;
    onNavigate?: (page: string, params?: any) => void;
    onMovieSelect?: (movie: Movie) => void;
}

export const MobileProfilePage: React.FC<MobileProfilePageProps> = ({ userId, onNavigate, onMovieSelect }) => {
    const { user: currentUser, isAdmin, refreshProfile } = useAuth();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [stats, setStats] = useState({ followers: 0, following: 0 });
    const [isFollowing, setIsFollowing] = useState(false);
    const [watchHistory, setWatchHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [showAvatarModal, setShowAvatarModal] = useState(false);

    const targetId = userId || currentUser?.id;
    const isOwnProfile = currentUser?.id === targetId;

    useEffect(() => {
        if (!targetId) return;
        const loadData = async () => {
            setLoading(true);
            try {
                const [prof, plays, stat, checkFollow] = await Promise.all([
                    SocialService.getProfile(targetId),
                    SocialService.getPlaylists(targetId),
                    SocialService.getFollowStats(targetId),
                    currentUser && !isOwnProfile ? SocialService.isFollowing(currentUser.id, targetId) : Promise.resolve(false)
                ]);

                if (isAdmin && !isOwnProfile) {
                    const history = await SocialService.getUserWatchHistory(targetId);
                    setWatchHistory(history);
                }

                setProfile(prof);
                setPlaylists(plays);
                setStats(stat);
                setIsFollowing(checkFollow);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [targetId, currentUser, isOwnProfile]);

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
        } catch (e) { console.error(e); }
    };

    const handleAvatarUpdate = async (url: string) => {
        if (!currentUser) return;
        try {
            await SocialService.updateProfile(currentUser.id, { avatar_url: url });
            setProfile(prev => prev ? { ...prev, avatar_url: url } : null);
            await refreshProfile();
            setShowAvatarModal(false);
        } catch (e) { console.error(e); }
    };

    if (loading) return <div className="h-screen flex items-center justify-center text-zinc-500 pt-20">Loading...</div>;
    if (!profile) return <div className="h-screen flex items-center justify-center text-zinc-500 pt-20">User not found</div>;

    return (
        <div className="min-h-screen bg-[#0f1014] pt-6 px-4 pb-24">
            <MobileAvatarModal
                isOpen={showAvatarModal}
                onClose={() => setShowAvatarModal(false)}
                onSelect={handleAvatarUpdate}
                currentAvatar={profile.avatar_url}
            />

            {/* Premium Header Design */}
            <div className="relative flex flex-col items-center text-center mb-8 pt-6">

                {/* Background Ambient Glow */}
                <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-purple-500/10 via-blue-500/5 to-transparent blur-3xl -z-10" />

                {/* Avatar with Ring */}
                <div className="relative mb-5 group" onClick={() => isOwnProfile && setShowAvatarModal(true)}>
                    <div className="p-1 rounded-full bg-gradient-to-tr from-white/20 to-white/5 backdrop-blur-md">
                        <img
                            src={profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.username}&background=10b981&color=fff&bold=true`}
                            alt={profile.username}
                            className="w-28 h-28 rounded-full object-cover shadow-2xl"
                        />
                    </div>
                    {isOwnProfile && (
                        <div className="absolute inset-0 m-1 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-active:opacity-100 transition-opacity">
                            <span className="text-[10px] uppercase font-bold text-white tracking-widest">Edit</span>
                        </div>
                    )}
                </div>

                {/* Username / Email - Adjusted for long text */}
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 px-8 break-words w-full leading-tight">
                    {profile.username}
                </h1>

                {/* Role Badge (Optional, assuming User for now) */}
                <div className="mb-6">
                    <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                        Streamer
                    </span>
                </div>

                {/* Glass Stats Row */}
                <div className="flex items-center justify-center gap-0 mb-8 bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-2xl p-4 w-full max-w-[320px]">
                    <div className="flex-1 text-center border-r border-white/5">
                        <div className="text-lg font-bold text-white">{stats.followers}</div>
                        <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-medium">Followers</div>
                    </div>
                    <div className="flex-1 text-center border-r border-white/5">
                        <div className="text-lg font-bold text-white">{stats.following}</div>
                        <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-medium">Following</div>
                    </div>
                    <div className="flex-1 text-center">
                        <div className="text-lg font-bold text-white">{playlists.length}</div>
                        <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-medium">Playlists</div>
                    </div>
                </div>

                {!isOwnProfile && currentUser && (
                    <button
                        onClick={handleFollow}
                        className={`w-full max-w-[320px] py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all shadow-lg ${isFollowing
                            ? 'bg-zinc-900 text-white border border-zinc-800'
                            : 'bg-white text-black shadow-white/10'
                            }`}
                    >
                        {isFollowing ? 'Following' : 'Follow'}
                    </button>
                )}
            </div>

            {/* Playlists */}
            <div>
                {/* Premium Playlists Section */}
                <div className="px-2">
                    <div className="flex items-end justify-between mb-6">
                        <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                            Playlists
                            <span className="text-xs font-normal text-zinc-500 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">{playlists.length}</span>
                        </h2>
                        {isOwnProfile && (
                            <button className="w-8 h-8 flex items-center justify-center bg-white text-black rounded-full shadow-lg shadow-white/10 active:scale-90 transition-transform">
                                <Plus size={16} strokeWidth={3} />
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                        {playlists.map(playlist => {
                            const previewImages = playlist.items?.map(i => i.metadata?.poster_path ? `https://image.tmdb.org/t/p/w200${i.metadata.poster_path}` : null).filter(Boolean).slice(0, 4) as string[] || [];

                            return (
                                <div
                                    key={playlist.id}
                                    onClick={() => onNavigate && onNavigate('playlist', { id: playlist.id })}
                                    className="group flex flex-col gap-3 active:scale-95 transition-transform duration-200"
                                >
                                    <div className="aspect-square bg-zinc-900 rounded-2xl overflow-hidden relative border border-white/5 shadow-2xl shadow-black/50 group-hover:border-white/20 transition-colors">
                                        {previewImages.length > 0 ? (
                                            <div className={`grid w-full h-full ${previewImages.length >= 4 ? 'grid-cols-2 grid-rows-2' : 'grid-cols-1'}`}>
                                                {previewImages.slice(0, previewImages.length >= 4 ? 4 : 1).map((src, idx) => (
                                                    <img key={idx} src={src} className="w-full h-full object-cover" />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900/50">
                                                <span className="text-4xl font-black text-zinc-800">{playlist.name[0]}</span>
                                            </div>
                                        )}
                                        {/* Gradient Overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="px-1">
                                        <h3 className="font-bold text-white text-sm truncate leading-none mb-1.5">{playlist.name}</h3>
                                        <div className="flex items-center gap-2">
                                            {!playlist.is_public && <Lock size={10} className="text-zinc-500" />}
                                            <p className="text-[10px] text-zinc-500 font-medium lowercase tracking-wide">
                                                {playlist.items_count || playlist.items?.length || 0} tracks
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ADMIN INSPECTOR: Watch History & Searches */}
            {/* ADMIN INSPECTOR: User Activity */}
            {isAdmin && !isOwnProfile && (
                <div className="mt-12 mx-2 p-5 bg-zinc-900/30 border border-white/5 rounded-2xl relative overflow-hidden">
                    {/* Admin Badge/Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                                <TrendingUp size={14} className="text-red-500" />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-white leading-none mb-1">Activity Log</h2>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium">Admin Access</p>
                            </div>
                        </div>
                    </div>

                    {/* Watch History Grid */}
                    {watchHistory.length > 0 && (
                        <div className="mb-10">
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 pl-1 border-l-2 border-red-500/50">
                                Watch History <span className="text-zinc-600 ml-1">({watchHistory.length})</span>
                            </h3>
                            <div className="grid grid-cols-3 gap-3">
                                {watchHistory.slice(0, 12).map((item, idx) => ( // Limit to 12
                                    <div key={idx} className="group relative">
                                        <div className="aspect-[2/3] rounded-lg overflow-hidden bg-zinc-900 border border-white/5 shadow-lg">
                                            <img
                                                src={item.posterUrl?.startsWith('/') ? `https://image.tmdb.org/t/p/w200${item.posterUrl}` : item.posterUrl}
                                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                                loading="lazy"
                                            />
                                            {/* Info Overlay */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-100 pb-2 px-1 flex flex-col justify-end">
                                                <p className="text-[9px] font-bold text-white text-center leading-tight line-clamp-2">{item.title}</p>
                                                <p className="text-[8px] text-zinc-400 text-center mt-0.5">{new Date(item.lastUpdated).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {watchHistory.length > 12 && (
                                <div className="mt-3 text-center">
                                    <span className="text-[10px] text-zinc-500 italic">...and {watchHistory.length - 12} more</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Searches List */}
                    {profile.recent_searches && profile.recent_searches.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 pl-1 border-l-2 border-blue-500/50">
                                Recent Searches
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {profile.recent_searches.map((term, idx) => (
                                    <div key={idx} className="bg-black/40 border border-white/5 px-3 py-2 rounded-lg flex items-center gap-2">
                                        <Search size={12} className="text-zinc-600" />
                                        <span className="text-zinc-300 text-xs font-medium">{term}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {watchHistory.length === 0 && (!profile.recent_searches || profile.recent_searches.length === 0) && (
                        <div className="py-8 text-center border border-dashed border-white/5 rounded-xl">
                            <p className="text-zinc-600 text-xs font-medium">No activity recorded for this user.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

