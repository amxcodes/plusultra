import { supabase } from '../lib/supabase';
import { Profile } from '../types';
import { cache, CACHE_KEYS } from '../lib/cache';

export const ProfileService = {
    async getProfile(userId: string): Promise<Profile | null> {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error fetching profile:', error);
            return null;
        }
        return data;
    },

    async updateProfile(userId: string, updates: Partial<Profile>) {
        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId);
        if (error) throw error;
    },

    async searchUsers(query: string): Promise<Profile[]> {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .ilike('username', `%${query}%`)
            .limit(20);

        if (error) {
            console.error('Error searching users:', error);
            return [];
        }
        return data || [];
    },

    async followUser(followerId: string, followingId: string) {
        const { error } = await supabase
            .from('follows')
            .insert({ follower_id: followerId, following_id: followingId });
        if (error) throw error;
    },

    async unfollowUser(followerId: string, followingId: string) {
        const { error } = await supabase
            .from('follows')
            .delete()
            .match({ follower_id: followerId, following_id: followingId });
        if (error) throw error;
    },

    async getFollowStats(userId: string) {
        const { count: followers } = await supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', userId);

        const { count: following } = await supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('follower_id', userId);

        return { followers: followers || 0, following: following || 0 };
    },

    async isFollowing(followerId: string, followingId: string): Promise<boolean> {
        const { data } = await supabase
            .from('follows')
            .select('*')
            .match({ follower_id: followerId, following_id: followingId })
            .maybeSingle();
        return !!data;
    },

    async getFollowers(userId: string): Promise<Profile[]> {
        const { data, error } = await supabase
            .from('follows')
            .select(`
                follower:follower_id (*)
            `)
            .eq('following_id', userId);

        if (error) {
            console.error('Error fetching followers:', error);
            return [];
        }

        // Flatten the structure
        return data.map((d: any) => d.follower) || [];
    },

    async getUserStats(userId: string) {
        // Watch History Count (from JSONB in profiles table)
        const { data: profile } = await supabase
            .from('profiles')
            .select('watch_history')
            .eq('id', userId)
            .single();

        const historyCount = profile?.watch_history
            ? Object.keys(profile.watch_history).length
            : 0;

        // Total Playlists Created by User
        const { count: playlistsCount } = await supabase
            .from('playlists')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        // Liked Playlists Count
        const { count: likedCount } = await supabase
            .from('playlist_likes')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        // Total Views on User's Playlists
        const { data: userPlaylists } = await supabase
            .from('playlists')
            .select('analytics')
            .eq('user_id', userId);

        const totalViews = userPlaylists?.reduce((sum, p) => {
            return sum + (p.analytics?.total_views || 0);
        }, 0) || 0;

        return {
            historyCount: historyCount || 0,
            playlistsCount: playlistsCount || 0,
            likedPlaylistsCount: likedCount || 0,
            totalPlaylistViews: totalViews
        };
    },

    async getUserWatchHistory(userId: string) {
        const { data, error } = await supabase
            .from('profiles')
            .select('watch_history')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error fetching watch history:', error);
            return [];
        }

        // Convert JSONB object to array
        const historyObj = data?.watch_history || {};
        return Object.values(historyObj)
            .sort((a: any, b: any) => (b.lastUpdated || 0) - (a.lastUpdated || 0))
            .slice(0, 20); // Limit to 20 most recent
    },

    async getFullWatchHistory(userId: string) {
        const { data, error } = await supabase
            .from('profiles')
            .select('watch_history')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error fetching full watch history:', error);
            return [];
        }

        // Convert JSONB object to array (no limit)
        const historyObj = data?.watch_history || {};
        return Object.values(historyObj)
            .sort((a: any, b: any) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
    },

    async clearWatchHistory() {
        const { error } = await supabase.rpc('clear_my_watch_history');
        if (error) throw error;
    },

    async saveRecentSearch(userId: string, query: string) {
        // Get current searches
        const { data: profile } = await supabase
            .from('profiles')
            .select('recent_searches')
            .eq('id', userId)
            .single();

        let searches: string[] = profile?.recent_searches || [];

        // Remove if already exists (dedupe)
        searches = searches.filter(s => s.toLowerCase() !== query.toLowerCase());

        // Prepend new search
        searches.unshift(query);

        // Keep only top 3
        searches = searches.slice(0, 3);

        // Update profile
        const { error } = await supabase
            .from('profiles')
            .update({ recent_searches: searches })
            .eq('id', userId);

        if (error) throw error;
    },

    async getRecentSearches(userId: string): Promise<string[]> {
        const { data: profile } = await supabase
            .from('profiles')
            .select('recent_searches')
            .eq('id', userId)
            .single();

        return profile?.recent_searches || [];
    },

    async getAppSettings() {
        // Check cache first (no TTL - permanent until invalidated)
        const cached = cache.get(CACHE_KEYS.APP_SETTINGS);
        if (cached) return cached;

        const { data, error } = await supabase
            .from('app_settings')
            .select('*');

        if (error) {
            console.error('Error fetching settings:', error);
            return { site_url: '', donation_url: '' };
        }

        // Convert array to object
        const settings: Record<string, string> = {};
        data?.forEach((s: any) => settings[s.key] = s.value);

        cache.set(CACHE_KEYS.APP_SETTINGS, settings, 1440); // Cache for 24 hours
        return settings;
    },

    async updateAppSetting(key: string, value: string) {
        const { error } = await supabase
            .from('app_settings')
            .upsert({ key, value });
        if (error) throw error;

        // Invalidate cache so next fetch gets fresh data
        cache.invalidate(CACHE_KEYS.APP_SETTINGS);
    },

    // --- Taste Compatibility ---

    async getTasteCompatibility(userA: string, userB: string) {
        // Ensure consistent ordering to match unique pair
        const [u1, u2] = [userA, userB].sort();

        try {
            const { data, error } = await supabase
                .from('taste_compatibility')
                .select('*')
                .match({ user_a: u1, user_b: u2 })
                .maybeSingle();

            if (error) return null;
            return data;
        } catch (e) {
            return null;
        }
    },

    async updateTasteCompatibility(userA: string, userB: string, score: number, shared: string[]) {
        const [u1, u2] = [userA, userB].sort();

        try {
            const { error } = await supabase
                .from('taste_compatibility')
                .upsert({
                    user_a: u1,
                    user_b: u2,
                    score,
                    shared_genres: shared,
                    updated_at: new Date().toISOString()
                });

            if (error) console.error("Error updating taste compatibility", error);
        } catch (e) {
            // Ignore (table might not exist yet)
        }
    },
};
