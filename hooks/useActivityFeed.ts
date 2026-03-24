import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { SocialService } from '../lib/social';
import { Notification, Profile } from '../types';

export type ActivityFeedTab = 'notifications' | 'requests' | 'followers';

export const useActivityFeed = () => {
    const { user } = useAuth();
    const [followers, setFollowers] = useState<Profile[]>([]);
    const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setFollowers([]);
            setFollowingIds(new Set());
            setNotifications([]);
            setIsLoading(false);
            return;
        }

        let cancelled = false;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [myFollowers, myFollowingIds, activityNotifications] = await Promise.all([
                    SocialService.getFollowers(user.id),
                    SocialService.getFollowingIds(user.id),
                    SocialService.getNotifications(user.id),
                ]);

                if (cancelled) return;

                setFollowers(myFollowers);
                setFollowingIds(new Set(myFollowingIds));
                setNotifications(activityNotifications);

                await SocialService.markActivitySeen(user.id);
            } catch (error) {
                console.error('Failed to load activity', error);
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        void fetchData();

        return () => {
            cancelled = true;
        };
    }, [user]);

    const requestNotifications = useMemo(() => (
        notifications.filter(notification => notification.type === 'playlist_invite' && !notification.is_read)
    ), [notifications]);

    const feedNotifications = useMemo(() => (
        notifications.filter(notification => notification.type !== 'playlist_invite')
    ), [notifications]);

    const handleFollowBack = async (targetId: string) => {
        if (!user) return;

        const isAlreadyFollowing = followingIds.has(targetId);
        const nextFollowingIds = new Set(followingIds);

        if (isAlreadyFollowing) {
            nextFollowingIds.delete(targetId);
            setFollowingIds(nextFollowingIds);
            await SocialService.unfollowUser(user.id, targetId);
            return;
        }

        nextFollowingIds.add(targetId);
        setFollowingIds(nextFollowingIds);
        await SocialService.followUser(user.id, targetId);
    };

    const handleRespondToInvite = async (notification: Notification, status: 'accepted' | 'rejected') => {
        if (!notification.data?.invite_id) return;

        try {
            await SocialService.respondToInvite(notification.data.invite_id, status);
            await SocialService.markNotificationRead(notification.id);
            setNotifications(prev => prev.filter(item => item.id !== notification.id));
        } catch (error) {
            console.error('Failed to respond to invite', error);
        }
    };

    return {
        user,
        followers,
        followingIds,
        requestNotifications,
        feedNotifications,
        isLoading,
        handleFollowBack,
        handleRespondToInvite,
    };
};
