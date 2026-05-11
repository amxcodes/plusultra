import { supabase } from '../lib/supabase';
import type { Notification } from '../types';

type PrivateNotificationProfile = {
    last_seen_announcements?: string | null;
    last_seen_activity?: string | null;
};

export const NotificationService = {
    async pruneExpiredDirectMessageNotifications(userId: string) {
        const { error } = await supabase.rpc('prune_expired_direct_message_notifications', {
            p_user_id: userId
        });

        if (error) throw error;
    },

    async getNotifications(userId: string) {
        await this.pruneExpiredDirectMessageNotifications(userId);

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async getUnreadCounts(userId: string) {
        await this.pruneExpiredDirectMessageNotifications(userId);

        // Get user's last seen timestamps
        const { data } = await supabase
            .rpc('get_private_profile', {
                p_user_id: userId
            })
            .single();

        const profile = data as PrivateNotificationProfile | null;

        if (!profile) return { announcementsCount: 0, activityCount: 0 };

        // Count unread announcements
        const { count: announcementsCount } = await supabase
            .from('announcements')
            .select('id', { count: 'exact' })
            .eq('is_active', true)
            .gt('created_at', profile.last_seen_announcements || '1970-01-01')
            .limit(1);

        // Count new follows
        const { count: followsCount } = await supabase
            .from('follows')
            .select('follower_id', { count: 'exact' })
            .eq('following_id', userId)
            .gt('created_at', profile.last_seen_activity || '1970-01-01')
            .limit(1);

        // Count new non-request activity notifications since the last visit
        const { count: notificationsCount } = await supabase
            .from('notifications')
            .select('id', { count: 'exact' })
            .eq('user_id', userId)
            .filter('type', 'neq', 'playlist_invite')
            .gt('created_at', profile.last_seen_activity || '1970-01-01')
            .limit(1);

        // Pending requests should continue to badge until handled.
        const { count: requestCount } = await supabase
            .from('notifications')
            .select('id', { count: 'exact' })
            .eq('user_id', userId)
            .eq('type', 'playlist_invite')
            .eq('is_read', false)
            .limit(1);

        const activityCount = (followsCount || 0) + (notificationsCount || 0) + (requestCount || 0);

        return {
            announcementsCount: announcementsCount || 0,
            activityCount
        };
    },

    async markAnnouncementsSeen(_userId: string) {
        const { error } = await supabase.rpc('mark_announcements_seen');
        if (error) throw error;
    },

    async markActivitySeen(_userId: string) {
        const { error } = await supabase.rpc('mark_activity_seen');
        if (error) throw error;
    },

    async markNotificationRead(notificationId: string) {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId);
        if (error) throw error;
    },

    requestBrowserNotificationPermission() {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            return Promise.resolve<'denied'>('denied');
        }

        if (Notification.permission !== 'default') {
            return Promise.resolve(Notification.permission);
        }

        return Notification.requestPermission();
    },

    async showBrowserNotification(
        title: string,
        options: NotificationOptions & { onClick?: () => void } = {}
    ) {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            return null;
        }

        let permission = Notification.permission;
        if (permission === 'default') {
            permission = await this.requestBrowserNotificationPermission();
        }

        if (permission !== 'granted') {
            return null;
        }

        const notification = new Notification(title, options);
        if (options.onClick) {
            notification.onclick = () => {
                window.focus();
                options.onClick?.();
                notification.close();
            };
        }

        return notification;
    },

    async showDesktopNotification(title: string, body?: string) {
        if (!window.desktop?.isDesktop || !window.desktop.showNotification) {
            return { ok: false };
        }

        return window.desktop.showNotification({ title, body });
    },

    subscribeToDirectMessageNotifications(
        userId: string,
        onNotification: (notification: Notification) => void
    ): () => void {
        const channel = supabase
            .channel(`direct-message-notifications-${userId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
                (payload) => {
                    const nextNotification = payload.new as Notification | undefined;
                    if (nextNotification?.type === 'direct_message') {
                        onNotification(nextNotification);
                    }
                }
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    },

    subscribeToUnreadCountChanges(userId: string, onChange: () => void): () => void {
        const channel = supabase
            .channel(`navbar-unread-counts-${userId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'announcements' },
                () => onChange()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
                () => onChange()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'follows', filter: `following_id=eq.${userId}` },
                () => onChange()
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    },
};
