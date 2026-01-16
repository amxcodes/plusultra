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

            {/* Header */}
            <div className="flex flex-col items-center text-center mb-8">
                <div className="relative mb-4 group" onClick={() => isOwnProfile && setShowAvatarModal(true)}>
                    <img
                        src={profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.username}&background=10b981&color=fff&bold=true`}
                        alt={profile.username}
                        className="w-28 h-28 rounded-full object-cover shadow-2xl"
                    />
                    {isOwnProfile && (
                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-active:opacity-100 transition-opacity">
                            <span className="text-[10px] uppercase font-bold text-white">Edit</span>
                        </div>
                    )}
                </div>

                <h1 className="text-3xl font-bold text-white mb-2">{profile.username}</h1>

                <div className="flex items-center gap-6 mb-6">
                    <div className="text-center">
                        <div className="text-lg font-bold text-white">{stats.followers}</div>
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Followers</div>
                    </div>
                    <div className="text-center">
                        <div className="text-lg font-bold text-white">{stats.following}</div>
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Following</div>
                    </div>
                    <div className="text-center">
                        <div className="text-lg font-bold text-white">{playlists.length}</div>
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Playlists</div>
                    </div>
                </div>

                {!isOwnProfile && currentUser && (
                    <button
                        onClick={handleFollow}
                        className={`w-full py-3 rounded-xl font-bold text-sm transition-colors ${isFollowing ? 'bg-zinc-800 text-white' : 'bg-white text-black'}`}
                    >
                        {isFollowing ? 'Unfollow' : 'Follow'}
                    </button>
                )}
            </div>

            {/* Playlists */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-white">Playlists</h2>
                    {isOwnProfile && (
                        <button className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                            + New
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {playlists.map(playlist => {
                        const previewImages = playlist.items?.map(i => i.metadata?.poster_path ? `https://image.tmdb.org/t/p/w200${i.metadata.poster_path}` : null).filter(Boolean).slice(0, 4) as string[] || [];

                        return (
                            <div
                                key={playlist.id}
                                onClick={() => onNavigate && onNavigate('playlist', { id: playlist.id })}
                                className="flex flex-col gap-2"
                            >
                                <div className="aspect-square bg-zinc-900 rounded-xl overflow-hidden relative border border-white/5">
                                    {previewImages.length > 0 ? (
                                        <div className={`grid w-full h-full ${previewImages.length >= 4 ? 'grid-cols-2 grid-rows-2' : 'grid-cols-1'}`}>
                                            {previewImages.slice(0, previewImages.length >= 4 ? 4 : 1).map((src, idx) => (
                                                <img key={idx} src={src} className="w-full h-full object-cover" />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <span className="text-4xl font-black text-zinc-800">{playlist.name[0]}</span>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-bold text-zinc-200 text-sm truncate">{playlist.name}</h3>
                                    <p className="text-[10px] text-zinc-500 font-medium">{playlist.items?.length || 0} tracks</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ADMIN INSPECTOR: Watch History & Searches */}
            {isAdmin && !isOwnProfile && (
                <div className="mt-12 pt-8 border-t border-white/5">
                    <div className="flex items-center gap-2 mb-6">
                        <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Admin View</span>
                        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">User Activity</h2>
                    </div>

                    {/* Watch History */}
                    {watchHistory.length > 0 && (
                        <div className="mb-8">
                            <h3 className="text-white font-bold text-sm mb-3">Watch History</h3>
                            <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
                                {watchHistory.map((item, idx) => (
                                    <div key={idx} className="flex-none w-28 group relative">
                                        <div className="aspect-[2/3] rounded-lg overflow-hidden bg-zinc-900 border border-white/5">
                                            <img
                                                src={item.posterUrl?.startsWith('/') ? `https://image.tmdb.org/t/p/w200${item.posterUrl}` : item.posterUrl}
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1">
                                                <div className="text-[9px] text-white truncate text-center">{item.title}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Searches */}
                    {profile.recent_searches && profile.recent_searches.length > 0 && (
                        <div>
                            <h3 className="text-white font-bold text-sm mb-3">Recent Searches</h3>
                            <div className="space-y-2">
                                {profile.recent_searches.map((term, idx) => (
                                    <div key={idx} className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800 flex items-center gap-3">
                                        <Search size={14} className="text-zinc-600" />
                                        <span className="text-zinc-300 text-sm font-medium">{term}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {watchHistory.length === 0 && (!profile.recent_searches || profile.recent_searches.length === 0) && (
                        <div className="text-zinc-600 text-xs italic">No activity recorded for this user.</div>
                    )}
                </div>
            )}
        </div>
    );
}

