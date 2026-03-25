import { supabase } from '../lib/supabase';
import { Profile } from '../types';
import { cache, CACHE_KEYS } from '../lib/cache';
import { getDisplayName } from '../lib/displayName';

const PUBLIC_PROFILE_COLUMNS = 'id, username, avatar_url, created_at';

type PrivateProfileRow = {
    id: string;
    username: string;
    avatar_url: string | null;
    role?: 'user' | 'admin' | 'moderator';
    can_stream?: boolean | null;
    account_kind?: 'standard' | 'guest';
    guest_expires_at?: string | null;
    guest_created_by?: string | null;
    guest_secured_at?: string | null;
    guest_link_id?: string | null;
    is_guest_hidden?: boolean | null;
    recent_searches?: string[] | null;
    stats?: {
        total_movies?: number;
        total_shows?: number;
        watch_time?: number;
    } | null;
    last_seen_announcements?: string | null;
    last_seen_activity?: string | null;
    created_at?: string | null;
};

const normalizePublicProfile = (row: any): Profile => ({
    id: row.id,
    username: getDisplayName(row.username),
    avatar_url: row.avatar_url || '',
    created_at: row.created_at || undefined,
});

const normalizePrivateProfile = (row: PrivateProfileRow): Profile => ({
    id: row.id,
    username: getDisplayName(row.username),
    avatar_url: row.avatar_url || '',
    role: row.role,
    can_stream: row.can_stream ?? undefined,
    account_kind: row.account_kind,
    guest_expires_at: row.guest_expires_at ?? undefined,
    guest_created_by: row.guest_created_by ?? undefined,
    guest_secured_at: row.guest_secured_at ?? undefined,
    guest_link_id: row.guest_link_id ?? undefined,
    is_guest_hidden: row.is_guest_hidden ?? undefined,
    recent_searches: (row.recent_searches as string[] | null) || undefined,
    stats: row.stats || undefined,
    created_at: row.created_at || undefined,
});

export const ProfileService = {
    async getProfile(userId: string): Promise<Profile | null> {
        const { data, error } = await supabase
            .from('profiles')
            .select(PUBLIC_PROFILE_COLUMNS)
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error fetching profile:', error);
            return null;
        }
        return normalizePublicProfile(data);
    },

    async getPrivateProfile(userId?: string): Promise<Profile | null> {
        const { data, error } = await supabase
            .rpc('get_private_profile', {
                p_user_id: userId || null
            })
            .single();

        if (error) {
            console.error('Error fetching private profile:', error);
            return null;
        }

        return normalizePrivateProfile(data as PrivateProfileRow);
    },

    async updateProfile(userId: string, updates: Partial<Profile>) {
        const safeUpdates: Partial<Profile> = {};
        if (typeof updates.username === 'string') safeUpdates.username = updates.username;
        if (typeof updates.avatar_url === 'string') safeUpdates.avatar_url = updates.avatar_url;
        if (Array.isArray(updates.recent_searches)) safeUpdates.recent_searches = updates.recent_searches;
        if (Object.keys(safeUpdates).length === 0) return;

        const { error } = await supabase
            .from('profiles')
            .update(safeUpdates)
            .eq('id', userId);
        if (error) throw error;
    },

    async searchUsers(query: string): Promise<Profile[]> {
        const { data, error } = await supabase
            .rpc('search_public_profiles', {
                p_query: query,
                p_limit: 20,
            });

        if (error) {
            console.error('Error searching users:', error);
            return [];
        }
        return (data || []).map(normalizePublicProfile);
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
            .select('follower_id')
            .eq('following_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching followers:', error);
            return [];
        }

        const followerIds = (data || []).map((d: any) => d.follower_id).filter(Boolean);
        if (followerIds.length === 0) return [];

        const { data: followers, error: followersError } = await supabase
            .from('profiles')
            .select(PUBLIC_PROFILE_COLUMNS)
            .in('id', followerIds);

        if (followersError) {
            console.error('Error fetching follower profiles:', followersError);
            return [];
        }

        const profilesById = new Map((followers || []).map((profile: any) => [profile.id, normalizePublicProfile(profile)]));

        return followerIds
            .map(id => profilesById.get(id))
            .filter((profile): profile is Profile => Boolean(profile));
    },

    async getFollowingIds(userId: string): Promise<string[]> {
        const { data, error } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', userId);

        if (error) {
            console.error('Error fetching following ids:', error);
            return [];
        }

        return (data || [])
            .map((row: { following_id: string | null }) => row.following_id)
            .filter((id): id is string => Boolean(id));
    },

    async getUserStats(userId: string) {
        // Watch History Count (from JSONB in profiles table)
        const { data: profileHistory } = await supabase
            .rpc('get_private_watch_history', {
                p_user_id: userId
            });

        const historyCount = profileHistory
            ? Object.keys(profileHistory).length
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
            .rpc('get_private_watch_history', {
                p_user_id: userId
            });

        if (error) {
            console.error('Error fetching watch history:', error);
            return [];
        }

        // Convert JSONB object to array
        const historyObj = data || {};
        return Object.values(historyObj)
            .sort((a: any, b: any) => (b.lastUpdated || 0) - (a.lastUpdated || 0))
            .slice(0, 20); // Limit to 20 most recent
    },

    async getFullWatchHistory(userId: string) {
        const { data, error } = await supabase
            .rpc('get_private_watch_history', {
                p_user_id: userId
            });

        if (error) {
            console.error('Error fetching full watch history:', error);
            return [];
        }

        // Convert JSONB object to array (no limit)
        const historyObj = data || {};
        return Object.values(historyObj)
            .sort((a: any, b: any) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
    },

    async clearWatchHistory() {
        const { error } = await supabase.rpc('clear_my_watch_history');
        if (error) throw error;
    },

    async saveRecentSearch(userId: string, query: string) {
        // Get current searches
        const { data } = await supabase
            .rpc('get_private_profile', {
                p_user_id: userId
            })
            .single();

        const profile = data as PrivateProfileRow | null;
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
        const { data } = await supabase
            .rpc('get_private_profile', {
                p_user_id: userId
            })
            .single();

        const profile = data as PrivateProfileRow | null;
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
