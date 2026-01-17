
import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { SocialService } from '../lib/social';
import { Profile, Notification } from '../types';
import { UserPlus, UserCheck, Activity, ChevronLeft, Search, Bell, Check, X } from 'lucide-react';

interface MobileActivityPageProps {
    onNavigate?: (page: string, params?: any) => void;
}

export const MobileActivityPage: React.FC<MobileActivityPageProps> = ({ onNavigate }) => {
    const { user } = useAuth();
    const [followers, setFollowers] = useState<Profile[]>([]);
    const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const myFollowers = await SocialService.getFollowers(user.id);
                setFollowers(myFollowers);

                const statusMap = new Set<string>();
                await Promise.all(myFollowers.map(async (follower) => {
                    const isFollowing = await SocialService.isFollowing(user.id, follower.id);
                    if (isFollowing) statusMap.add(follower.id);
                }));
                setFollowingIds(statusMap);

                // Notifications
                const notifs = await SocialService.getNotifications(user.id);
                setNotifications(notifs.filter(n => !n.is_read));

                await SocialService.markActivitySeen(user.id);
            } catch (error) {
                console.error("Failed to load activity", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [user]);

    const handleFollowBack = async (targetId: string) => {
        if (!user) return;
        const isAlreadyFollowing = followingIds.has(targetId);
        const newSet = new Set(followingIds);
        if (isAlreadyFollowing) {
            newSet.delete(targetId);
            setFollowingIds(newSet);
            await SocialService.unfollowUser(user.id, targetId);
        } else {
            newSet.add(targetId);
            setFollowingIds(newSet);
            await SocialService.followUser(user.id, targetId);
        }
    };

    const handleRespondToInvite = async (notification: Notification, status: 'accepted' | 'rejected') => {
        if (!notification.data?.invite_id) return;
        try {
            await SocialService.respondToInvite(notification.data.invite_id, status);
            await SocialService.markNotificationRead(notification.id);
            setNotifications(notifications.filter(n => n.id !== notification.id));
        } catch (e) {
            console.error("Failed to respond to invite", e);
        }
    };

    const playlistInvites = notifications.filter(n => n.type === 'playlist_invite');

    return (
        <div className="min-h-screen bg-[#0f1014] pb-24 animate-in fade-in duration-300">
            {/* Mobile Header */}
            <div className="sticky top-0 z-40 bg-[#0f1014]/95 backdrop-blur-xl border-b border-white/5 px-4 pt-4 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-900 rounded-lg text-white">
                        <Activity size={20} />
                    </div>
                    <h1 className="text-xl font-black text-white tracking-tight">Activity Log</h1>
                </div>
            </div>

            {/* Content */}
            <div className="px-4 py-4 space-y-6">

                {/* INVITATIONS SECTION */}
                {playlistInvites.length > 0 && (
                    <div>
                        <h2 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Bell size={12} /> Pending Invites
                        </h2>
                        <div className="space-y-3">
                            {playlistInvites.map(notif => (
                                <div key={notif.id} className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl">
                                    <div className="flex gap-4 mb-4">
                                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
                                            <Bell size={18} />
                                        </div>
                                        <div>
                                            <h3 className="text-white font-bold text-sm leading-tight mb-1">{notif.title}</h3>
                                            <p className="text-zinc-400 text-xs leading-relaxed">{notif.message}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleRespondToInvite(notif, 'accepted')}
                                            className="flex-1 py-2 bg-blue-500 text-white text-xs font-bold rounded-xl active:scale-95 transition-transform"
                                        >
                                            Accept
                                        </button>
                                        <button
                                            onClick={() => handleRespondToInvite(notif, 'rejected')}
                                            className="flex-1 py-2 bg-zinc-800 text-zinc-400 text-xs font-bold rounded-xl active:scale-95 transition-transform"
                                        >
                                            Decline
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}


                {/* FOLLOWS SECTION */}
                <div>
                    <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">New Interactions</h2>

                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="flex items-center justify-between animate-pulse">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-zinc-900 rounded-full" />
                                        <div className="space-y-1">
                                            <div className="h-4 w-24 bg-zinc-900 rounded" />
                                            <div className="h-2 w-16 bg-zinc-900 rounded" />
                                        </div>
                                    </div>
                                    <div className="w-20 h-8 bg-zinc-900 rounded-full" />
                                </div>
                            ))}
                        </div>
                    ) : followers.length === 0 && playlistInvites.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-16 h-16 bg-zinc-900/50 rounded-full flex items-center justify-center mb-4 border border-white/5">
                                <Activity size={24} className="text-zinc-600" />
                            </div>
                            <h3 className="text-white font-bold mb-1">All Caught Up</h3>
                            <p className="text-zinc-500 text-xs">No new activity to show right now.</p>
                        </div>
                    ) : followers.length > 0 ? (
                        <div className="space-y-1">
                            {followers.map(follower => {
                                const isFollowingBack = followingIds.has(follower.id);
                                return (
                                    <div key={follower.id} className="p-3 bg-zinc-900/30 rounded-2xl border border-white/5 flex items-center justify-between">
                                        <div
                                            className="flex items-center gap-3"
                                            onClick={() => onNavigate && onNavigate('profile', { id: follower.id })}
                                        >
                                            <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10">
                                                <img
                                                    src={follower.avatar_url || `https://ui-avatars.com/api/?name=${follower.username}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-white">{follower.username}</div>
                                                <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide">Followed You</div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleFollowBack(follower.id)}
                                            className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${isFollowingBack
                                                ? 'bg-zinc-800 text-zinc-500'
                                                : 'bg-white text-black shadow-lg shadow-white/10'
                                                }`}
                                        >
                                            {isFollowingBack ? <UserCheck size={16} /> : <UserPlus size={16} />}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-10 text-center text-zinc-600 text-xs">No new followers</div>
                    )}
                </div>
            </div>
        </div>
    );
};
