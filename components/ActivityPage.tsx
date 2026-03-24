import React, { useState } from 'react';
import { Activity, Bell, Check, Heart, LibraryBig, UserCheck, UserPlus, X } from 'lucide-react';
import { useActivityFeed, type ActivityFeedTab } from '../hooks/useActivityFeed';
import { Notification } from '../types';

interface ActivityPageProps {
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
                icon: <Heart size={18} />,
                badge: 'Playlist Like',
                iconClass: 'bg-red-500/15 text-red-300 border-red-500/30',
            };
        case 'follower_new_playlist':
            return {
                icon: <LibraryBig size={18} />,
                badge: 'New Playlist',
                iconClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
            };
        case 'follow':
            return {
                icon: <UserPlus size={18} />,
                badge: 'New Follower',
                iconClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
            };
        default:
            return {
                icon: <Bell size={18} />,
                badge: 'Update',
                iconClass: 'bg-zinc-800 text-zinc-300 border-zinc-700',
            };
    }
};

export const ActivityPage: React.FC<ActivityPageProps> = ({ onNavigate }) => {
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

    if (isLoading) {
        return (
            <div className="pt-24 px-8 md:px-16 max-w-5xl mx-auto min-h-screen">
                <div className="space-y-6 animate-pulse">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-white/5" />
                        <div className="space-y-2">
                            <div className="h-8 w-44 rounded bg-white/5" />
                            <div className="h-4 w-72 rounded bg-white/5" />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        {[1, 2, 3].map((item) => (
                            <div key={item} className="h-14 rounded-2xl bg-white/5" />
                        ))}
                    </div>
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map((item) => (
                            <div key={item} className="h-24 rounded-2xl bg-white/5" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="pt-24 pb-40 px-8 md:px-16 max-w-5xl mx-auto min-h-screen animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-white/10 rounded-full">
                    <Activity size={32} className="text-white" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white">Activity</h1>
                    <p className="text-zinc-400">One place for friendly updates, requests, and followers.</p>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-8">
                {ACTIVITY_TABS.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`rounded-2xl border px-4 py-4 text-left transition-all ${isActive
                                ? 'border-white bg-white text-black shadow-lg shadow-white/10'
                                : 'border-white/10 bg-[#0f1014] text-zinc-300 hover:border-white/20 hover:bg-white/5'
                                }`}
                        >
                            <div className="text-xs uppercase tracking-[0.2em] font-bold opacity-70">{tab.label}</div>
                            <div className="text-2xl font-black mt-2">{tabCount(tab.id)}</div>
                        </button>
                    );
                })}
            </div>

            {activeTab === 'notifications' && (
                <div className="space-y-4">
                    {feedNotifications.length === 0 ? (
                        <div className="bg-[#0f1014] border border-white/10 rounded-3xl p-12 text-center">
                            <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-600">
                                <Bell size={28} />
                            </div>
                            <h2 className="text-xl font-bold text-white">No notifications yet</h2>
                            <p className="text-zinc-500 mt-2">Likes, follower playlist drops, and future recommendations will show up here.</p>
                        </div>
                    ) : feedNotifications.map((notification) => {
                        const accent = getNotificationAccent(notification);
                        const canOpen = Boolean(notification.data?.playlist_id || notification.data?.actor_id);

                        return (
                            <div
                                key={notification.id}
                                className={`bg-[#0f1014] border border-white/10 rounded-3xl p-5 transition-colors ${canOpen ? 'hover:bg-white/5 cursor-pointer' : ''}`}
                                onClick={() => canOpen && openNotificationTarget(notification)}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${accent.iconClass}`}>
                                        {accent.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 flex-wrap mb-2">
                                            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-500">
                                                {accent.badge}
                                            </span>
                                            <span className="text-xs text-zinc-600">
                                                {new Date(notification.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                        <h3 className="text-white font-semibold text-lg">{notification.title}</h3>
                                        <p className="text-zinc-400 mt-1 leading-relaxed">{notification.message}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {activeTab === 'requests' && (
                <div className="space-y-4">
                    {requestNotifications.length === 0 ? (
                        <div className="bg-[#0f1014] border border-white/10 rounded-3xl p-12 text-center">
                            <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-600">
                                <Bell size={28} />
                            </div>
                            <h2 className="text-xl font-bold text-white">No pending requests</h2>
                            <p className="text-zinc-500 mt-2">Playlist invites and future approval-style actions will appear here.</p>
                        </div>
                    ) : requestNotifications.map((notification) => (
                        <div key={notification.id} className="bg-[#0f1014] border border-white/10 rounded-3xl p-5">
                            <div className="flex items-start justify-between gap-5">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
                                        <Bell size={18} />
                                    </div>
                                    <div>
                                        <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-blue-400 mb-2">Request</div>
                                        <h3 className="text-white font-semibold text-lg">{notification.title}</h3>
                                        <p className="text-zinc-400 mt-1">{notification.message}</p>
                                        <p className="text-zinc-600 text-xs mt-3">{new Date(notification.created_at).toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => handleRespondToInvite(notification, 'accepted')}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-400 border border-green-500/20 rounded-xl hover:bg-green-500 hover:text-white transition-all font-medium text-sm"
                                    >
                                        <Check size={16} /> Accept
                                    </button>
                                    <button
                                        onClick={() => handleRespondToInvite(notification, 'rejected')}
                                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white transition-all font-medium text-sm"
                                    >
                                        <X size={16} /> Reject
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'followers' && (
                <div className="bg-[#0f1014] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="p-6 border-b border-white/5">
                        <h2 className="text-lg font-semibold text-white">Followers</h2>
                        <p className="text-zinc-500 text-sm mt-1">See who followed you and follow them back if you want.</p>
                    </div>

                    {followers.length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center">
                            <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4 text-zinc-600">
                                <UserPlus size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-white">No followers yet</h3>
                            <p className="text-zinc-500 mt-2 max-w-xs">When people follow you, they will show up here.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {followers.map((follower) => {
                                const isFollowingBack = followingIds.has(follower.id);

                                return (
                                    <div key={follower.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors group">
                                        <div
                                            onClick={() => onNavigate?.('profile', { id: follower.id })}
                                            className="flex items-center gap-4 cursor-pointer"
                                        >
                                            <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10">
                                                <img
                                                    src={follower.avatar_url || `https://ui-avatars.com/api/?name=${follower.username}`}
                                                    alt={follower.username}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div>
                                                <h3 className="text-white font-medium text-lg">{follower.username}</h3>
                                                <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold">Started following you</p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleFollowBack(follower.id)}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm transition-all ${isFollowingBack
                                                ? 'bg-zinc-800 text-zinc-400 hover:bg-red-900/50 hover:text-red-300 border border-transparent'
                                                : 'bg-white text-black hover:bg-zinc-200 shadow-lg shadow-white/10'
                                                }`}
                                        >
                                            {isFollowingBack ? (
                                                <>
                                                    <UserCheck size={16} />
                                                    <span>Following</span>
                                                </>
                                            ) : (
                                                <>
                                                    <UserPlus size={16} />
                                                    <span>Follow Back</span>
                                                </>
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
    );
};
