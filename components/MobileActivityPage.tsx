import React, { useState } from 'react';
import { Activity, Bell, Check, Heart, LibraryBig, UserCheck, UserPlus, X } from 'lucide-react';
import { useActivityFeed, type ActivityFeedTab } from '../hooks/useActivityFeed';
import { Notification } from '../types';

interface MobileActivityPageProps {
    onNavigate?: (page: string, params?: any) => void;
}

const ACTIVITY_TABS: Array<{ id: ActivityFeedTab; label: string }> = [
    { id: 'notifications', label: 'Notifications' },
    { id: 'requests', label: 'Requests' },
    { id: 'followers', label: 'Followers' },
];

const getNotificationAccent = (notification: Notification) => {
    switch (notification.type) {
        case 'playlist_liked':
            return {
                icon: <Heart size={16} />,
                badge: 'Playlist Like',
                iconClass: 'bg-red-500/15 text-red-300 border-red-500/30',
            };
        case 'follower_new_playlist':
            return {
                icon: <LibraryBig size={16} />,
                badge: 'New Playlist',
                iconClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
            };
        case 'follow':
            return {
                icon: <UserPlus size={16} />,
                badge: 'New Follower',
                iconClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
            };
        default:
            return {
                icon: <Bell size={16} />,
                badge: 'Update',
                iconClass: 'bg-zinc-800 text-zinc-300 border-zinc-700',
            };
    }
};

export const MobileActivityPage: React.FC<MobileActivityPageProps> = ({ onNavigate }) => {
    const {
        followers,
        followingIds,
        requestNotifications,
        feedNotifications,
        isLoading,
        handleFollowBack,
        handleRespondToInvite,
    } = useActivityFeed();
    const [activeTab, setActiveTab] = useState<ActivityFeedTab>('notifications');

    const openNotificationTarget = (notification: Notification) => {
        if (notification.data?.playlist_id) {
            onNavigate?.('playlist', { id: notification.data.playlist_id });
            return;
        }

        if (notification.data?.actor_id) {
            onNavigate?.('profile', { id: notification.data.actor_id });
        }
    };

    const tabCount = (tab: ActivityFeedTab) => {
        switch (tab) {
            case 'notifications':
                return feedNotifications.length;
            case 'requests':
                return requestNotifications.length;
            case 'followers':
                return followers.length;
        }
    };

    return (
        <div className="min-h-screen bg-[#0f1014] pb-24 animate-in fade-in duration-300">
            <div className="sticky top-0 z-40 bg-[#0f1014]/95 backdrop-blur-xl border-b border-white/5 px-4 pt-4 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-900 rounded-lg text-white">
                        <Activity size={20} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white tracking-tight">Activity</h1>
                        <p className="text-[11px] text-zinc-500">Notifications, requests, and followers together.</p>
                    </div>
                </div>
            </div>

            <div className="px-4 py-4 space-y-5">
                <div className="grid grid-cols-3 gap-2">
                    {ACTIVITY_TABS.map((tab) => {
                        const isActive = activeTab === tab.id;

                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`rounded-2xl border px-3 py-3 text-left transition-all ${isActive
                                    ? 'border-white bg-white text-black'
                                    : 'border-white/10 bg-zinc-900/50 text-zinc-300'
                                    }`}
                            >
                                <div className="text-[10px] uppercase tracking-[0.15em] font-bold opacity-70">{tab.label}</div>
                                <div className="text-lg font-black mt-1">{tabCount(tab.id)}</div>
                            </button>
                        );
                    })}
                </div>

                {isLoading && (
                    <div className="space-y-3 animate-pulse">
                        {[1, 2, 3].map((item) => (
                            <div key={item} className="h-24 rounded-2xl bg-zinc-900" />
                        ))}
                    </div>
                )}

                {!isLoading && activeTab === 'notifications' && (
                    <div className="space-y-3">
                        {feedNotifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="w-16 h-16 bg-zinc-900/50 rounded-full flex items-center justify-center mb-4 border border-white/5">
                                    <Bell size={24} className="text-zinc-600" />
                                </div>
                                <h3 className="text-white font-bold mb-1">No notifications yet</h3>
                                <p className="text-zinc-500 text-xs max-w-[240px]">Likes, playlist drops from people you follow, and future recommendations will show here.</p>
                            </div>
                        ) : feedNotifications.map((notification) => {
                            const accent = getNotificationAccent(notification);
                            const canOpen = Boolean(notification.data?.playlist_id || notification.data?.actor_id);

                            return (
                                <div
                                    key={notification.id}
                                    onClick={() => canOpen && openNotificationTarget(notification)}
                                    className={`p-4 rounded-2xl border border-white/5 bg-zinc-900/40 ${canOpen ? 'active:scale-[0.99]' : ''}`}
                                >
                                    <div className="flex gap-3">
                                        <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center flex-shrink-0 ${accent.iconClass}`}>
                                            {accent.icon}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500 mb-1">{accent.badge}</div>
                                            <h3 className="text-white font-bold text-sm leading-tight">{notification.title}</h3>
                                            <p className="text-zinc-400 text-xs leading-relaxed mt-1">{notification.message}</p>
                                            <p className="text-zinc-600 text-[10px] mt-2">{new Date(notification.created_at).toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {!isLoading && activeTab === 'requests' && (
                    <div className="space-y-3">
                        {requestNotifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="w-16 h-16 bg-zinc-900/50 rounded-full flex items-center justify-center mb-4 border border-white/5">
                                    <Bell size={24} className="text-zinc-600" />
                                </div>
                                <h3 className="text-white font-bold mb-1">No pending requests</h3>
                                <p className="text-zinc-500 text-xs">Invites and future actions will appear here.</p>
                            </div>
                        ) : requestNotifications.map((notification) => (
                            <div key={notification.id} className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl">
                                <div className="flex gap-4 mb-4">
                                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
                                        <Bell size={18} />
                                    </div>
                                    <div>
                                        <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-blue-400 mb-1">Request</div>
                                        <h3 className="text-white font-bold text-sm leading-tight mb-1">{notification.title}</h3>
                                        <p className="text-zinc-400 text-xs leading-relaxed">{notification.message}</p>
                                        <p className="text-zinc-600 text-[10px] mt-2">{new Date(notification.created_at).toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleRespondToInvite(notification, 'accepted')}
                                        className="flex-1 py-2 bg-blue-500 text-white text-xs font-bold rounded-xl active:scale-95 transition-transform"
                                    >
                                        <span className="inline-flex items-center gap-1">
                                            <Check size={14} /> Accept
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => handleRespondToInvite(notification, 'rejected')}
                                        className="flex-1 py-2 bg-zinc-800 text-zinc-300 text-xs font-bold rounded-xl active:scale-95 transition-transform"
                                    >
                                        <span className="inline-flex items-center gap-1">
                                            <X size={14} /> Decline
                                        </span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {!isLoading && activeTab === 'followers' && (
                    <div>
                        {followers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="w-16 h-16 bg-zinc-900/50 rounded-full flex items-center justify-center mb-4 border border-white/5">
                                    <UserPlus size={24} className="text-zinc-600" />
                                </div>
                                <h3 className="text-white font-bold mb-1">No followers yet</h3>
                                <p className="text-zinc-500 text-xs">People who follow you will show up here.</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {followers.map((follower) => {
                                    const isFollowingBack = followingIds.has(follower.id);

                                    return (
                                        <div key={follower.id} className="p-3 bg-zinc-900/30 rounded-2xl border border-white/5 flex items-center justify-between">
                                            <div
                                                className="flex items-center gap-3"
                                                onClick={() => onNavigate?.('profile', { id: follower.id })}
                                            >
                                                <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10">
                                                    <img
                                                        src={follower.avatar_url || `https://ui-avatars.com/api/?name=${follower.username}`}
                                                        alt={follower.username}
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
                                                className={`px-3 h-9 flex items-center justify-center rounded-full text-xs font-bold transition-all ${isFollowingBack
                                                    ? 'bg-zinc-800 text-zinc-400'
                                                    : 'bg-white text-black shadow-lg shadow-white/10'
                                                    }`}
                                            >
                                                {isFollowingBack ? (
                                                    <span className="inline-flex items-center gap-1"><UserCheck size={14} /> Following</span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1"><UserPlus size={14} /> Follow Back</span>
                                                )}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
