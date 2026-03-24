import { supabase } from '../lib/supabase';

type PrivateNotificationProfile = {
    last_seen_announcements?: string | null;
    last_seen_activity?: string | null;
};

export const NotificationService = {
    async getNotifications(userId: string) {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async getUnreadCounts(userId: string) {
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
            .neq('type', 'playlist_invite')
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

    async markAnnouncementsSeen(userId: string) {
        const { error } = await supabase
            .from('profiles')
            .update({ last_seen_announcements: new Date().toISOString() })
            .eq('id', userId);
        if (error) throw error;
    },

    async markActivitySeen(userId: string) {
        const { error } = await supabase
            .from('profiles')
            .update({ last_seen_activity: new Date().toISOString() })
            .eq('id', userId);
        if (error) throw error;
    },

    async markNotificationRead(notificationId: string) {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId);
        if (error) throw error;
    },
};
