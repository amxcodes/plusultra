import { supabase } from '../lib/supabase';

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
        const { data: profile } = await supabase
            .rpc('get_private_profile', {
                p_user_id: userId
            })
            .single();

        if (!profile) return { announcementsCount: 0, activityCount: 0 };

        // Count unread announcements
        const { count: announcementsCount } = await supabase
            .from('announcements')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true)
            .gt('created_at', profile.last_seen_announcements || '1970-01-01');

        // Count new follows
        const { count: followsCount } = await supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', userId)
            .gt('created_at', profile.last_seen_activity || '1970-01-01');

        // Count new likes on user's playlists
        const { data: userPlaylists } = await supabase
            .from('playlists')
            .select('id')
            .eq('user_id', userId);

        let likesCount = 0;
        if (userPlaylists && userPlaylists.length > 0) {
            const playlistIds = userPlaylists.map(p => p.id);
            const { count } = await supabase
                .from('playlist_likes')
                .select('*', { count: 'exact', head: true })
                .in('playlist_id', playlistIds)
                .gt('created_at', profile.last_seen_activity || '1970-01-01');
            likesCount = count || 0;
        }

        const activityCount = (followsCount || 0) + likesCount;

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
