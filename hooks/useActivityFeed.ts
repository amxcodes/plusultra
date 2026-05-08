import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { SocialService } from '../lib/social';
import { Notification, Profile, PublicProfilePresence, WatchPartyRoom } from '../types';
import { WatchPartyService } from '../services/WatchPartyService';

export type ActivityFeedTab = 'notifications' | 'requests' | 'followers';

export const useActivityFeed = () => {
    const { user } = useAuth();
    const [followers, setFollowers] = useState<Profile[]>([]);
    const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
    const [publicPresence, setPublicPresence] = useState<Record<string, PublicProfilePresence>>({});
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setFollowers([]);
            setFollowingIds(new Set());
            setPublicPresence({});
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

                const followerPresence = await WatchPartyService.listPublicPresence(
                    myFollowers.map((profile) => profile.id)
                );

                if (cancelled) return;

                setFollowers(myFollowers);
                setFollowingIds(new Set(myFollowingIds));
                setPublicPresence(
                    Object.fromEntries(
                        followerPresence.map((presence) => [presence.user_id, presence])
                    )
                );
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
        notifications.filter(notification => (
            (notification.type === 'playlist_invite' || notification.type === 'watch_party_invite') &&
            !notification.is_read
        ))
    ), [notifications]);

    const feedNotifications = useMemo(() => (
        notifications.filter(notification => (
            notification.type !== 'playlist_invite' &&
            notification.type !== 'watch_party_invite'
        ))
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

    const handleRespondToInvite = async (
        notification: Notification,
        status: 'accepted' | 'rejected'
    ): Promise<{ watchPartyRoom?: WatchPartyRoom | null }> => {
        if (!notification.data?.invite_id) return {};

        try {
            if (notification.type === 'watch_party_invite') {
                if (status === 'accepted') {
                    const watchPartyRoom = await WatchPartyService.acceptInvite(notification.data.invite_id);
                    await SocialService.markNotificationRead(notification.id);
                    setNotifications(prev => prev.filter(item => item.id !== notification.id));
                    return { watchPartyRoom };
                }

                await WatchPartyService.declineInvite(notification.data.invite_id);
                await SocialService.markNotificationRead(notification.id);
                setNotifications(prev => prev.filter(item => item.id !== notification.id));
                return {};
            }

            await SocialService.respondToInvite(notification.data.invite_id, status);
            await SocialService.markNotificationRead(notification.id);
            setNotifications(prev => prev.filter(item => item.id !== notification.id));
            return {};
        } catch (error) {
            console.error('Failed to respond to invite', error);
            return {};
        }
    };

    return {
        user,
        followers,
        followingIds,
        publicPresence,
        requestNotifications,
        feedNotifications,
        isLoading,
        handleFollowBack,
        handleRespondToInvite,
    };
};
