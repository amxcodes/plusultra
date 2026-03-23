import { supabase } from '../lib/supabase';
import { cache, CACHE_KEYS } from '../lib/cache';

export interface AdminViewSession {
    id: string;
    user_id: string;
    username: string | null;
    session_id: string;
    tmdb_id: string;
    title: string | null;
    media_type: 'movie' | 'tv';
    season: number | null;
    episode: number | null;
    provider_id: string | null;
    active_seconds: number;
    threshold_seconds: number;
    remaining_seconds: number;
    is_qualified: boolean;
    qualification_state: 'qualified' | 'close' | 'in_progress';
    qualified_at: string | null;
    session_date: string;
    started_at: string;
    last_heartbeat_at: string;
    updated_at: string;
}

export interface AdminPresenceUser {
    user_id: string;
    username: string | null;
    avatar_url: string | null;
    role: 'user' | 'admin' | 'moderator';
    can_stream: boolean | null;
    is_online: boolean;
    last_seen_at: string | null;
    current_session_started_at: string | null;
    current_online_seconds: number;
    today_active_seconds: number;
    total_active_seconds: number;
    session_count: number;
    last_path: string | null;
}

export interface AdminProviderAnalytics {
    provider_id: string;
    provider_name: string;
    enabled: boolean;
    render_mode: 'embed' | 'direct';
    risk_level: 'low' | 'medium' | 'high';
    sort_order: number;
    manual_votes: number;
    total_attempts: number;
    success_count: number;
    failure_count: number;
    quick_exit_count: number;
    no_ready_timeout_count: number;
    switched_early_count: number;
    retry_attempt_count: number;
    avg_active_seconds: number;
    success_rate: number;
    automatic_score: number;
    last_attempt_at: string | null;
}

export const AdminService = {
    async getAdminStats() {
        // Parallel fetch for overview stats
        const [users, playlists, announcements] = await Promise.all([
            // supabase.from('profiles').select('id', { count: 'exact', head: true }),
            // head: true is lighter
            supabase.from('profiles').select('id', { count: 'exact', head: true }),
            supabase.from('playlists').select('id', { count: 'exact', head: true }),
            supabase.from('announcements').select('id', { count: 'exact', head: true }).eq('is_active', true)
        ]);

        return {
            totalUsers: users.count || 0,
            totalPlaylists: playlists.count || 0,
            activeAnnouncements: announcements.count || 0
        };
    },

    async getAllUsers(limit = 50) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    },

    async deleteUserProfile(userId: string) {
        const { data, error } = await supabase
            .rpc('admin_delete_user', { p_user_id: userId });

        if (error) throw error;
        return data;
    },

    async updateUserRole(userId: string, newRole: 'admin' | 'moderator' | 'user') {
        const { error } = await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId);

        if (error) throw error;
    },

    async updateStreamingPermission(userId: string, canStream: boolean) {
        const { error } = await supabase
            .from('profiles')
            .update({ can_stream: canStream })
            .eq('id', userId);

        if (error) throw error;
    },

    // Announcements
    async getAnnouncements() {
        const { data, error } = await supabase
            .from('announcements')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async createAnnouncement(title: string, content: string, type: 'info' | 'warning' | 'success') {
        const { data, error } = await supabase
            .from('announcements')
            .insert({ title, content, type })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async toggleAnnouncement(id: string, isActive: boolean) {
        const { error } = await supabase
            .from('announcements')
            .update({ is_active: isActive })
            .eq('id', id);
        if (error) throw error;
    },

    async deleteAnnouncement(id: string) {
        const { error } = await supabase
            .from('announcements')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    // Content Management (Admin)
    async getAllPlaylists(limit = 50) {
        const { data, error } = await supabase
            .from('playlists')
            .select(`
                *,
                profiles!playlists_user_id_fkey(username),
                playlist_items(metadata)
            `)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return data || [];
    },

    async toggleFeaturedPlaylist(id: string, isFeatured: boolean) {
        const { error } = await supabase
            .from('playlists')
            .update({ is_featured: isFeatured })
            .eq('id', id);
        if (error) throw error;

        cache.invalidate(CACHE_KEYS.FEATURED_PLAYLISTS);
    },

    async getFeaturedMovies() {
        // Check cache first (1 hour TTL)
        const cached = cache.get(CACHE_KEYS.FEATURED_MOVIES);
        if (cached) return cached;

        const { data, error } = await supabase
            .from('featured_movies')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;

        const movies = data || [];
        cache.set(CACHE_KEYS.FEATURED_MOVIES, movies, 60); // Cache for 1 hour
        return movies;
    },

    async addFeaturedMovie(movie: any) {
        // Check duplicate
        const { data: existing } = await supabase
            .from('featured_movies')
            .select('id')
            .eq('tmdb_id', movie.id.toString())
            .single();

        if (existing) return;

        const { error } = await supabase
            .from('featured_movies')
            .insert({
                tmdb_id: movie.id.toString(),
                media_type: movie.mediaType || 'movie',
                metadata: movie
            });
        if (error) throw error;

        cache.invalidate(CACHE_KEYS.FEATURED_MOVIES);
    },

    async removeFeaturedMovie(id: string) {
        const { error } = await supabase
            .from('featured_movies')
            .delete()
            .eq('id', id);
        if (error) throw error;

        cache.invalidate(CACHE_KEYS.FEATURED_MOVIES);
    },

    async getFeaturedPlaylists() {
        // Check cache first (1 hour TTL)
        const cached = cache.get(CACHE_KEYS.FEATURED_PLAYLISTS);
        if (cached) return cached;

        const { data, error } = await supabase
            .from('playlists')
            .select(`
                *,
                profiles!playlists_user_id_fkey (username, avatar_url),
                items:playlist_items(metadata)
            `)
            .eq('is_featured', true)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching featured playlists:', error);
            return [];
        }

        const playlists = data.map((p: any) => ({
            ...p,
            items: p.items.slice(0, 9)
        }));

        cache.set(CACHE_KEYS.FEATURED_PLAYLISTS, playlists, 60); // Cache for 1 hour
        return playlists;
    },

    async getRecentViewSessions(options?: {
        limit?: number;
        userId?: string | null;
        onlyUnqualified?: boolean;
    }) {
        const { data, error } = await supabase
            .rpc('admin_get_recent_view_sessions', {
                p_limit: options?.limit ?? 75,
                p_user_id: options?.userId ?? null,
                p_only_unqualified: options?.onlyUnqualified ?? false
            });

        if (error) throw error;
        return (data || []) as AdminViewSession[];
    },

    async getPlatformPresence(options?: {
        limit?: number;
        search?: string | null;
        onlineOnly?: boolean;
    }) {
        const { data, error } = await supabase
            .rpc('admin_get_platform_presence', {
                p_limit: options?.limit ?? 100,
                p_search: options?.search ?? null,
                p_online_only: options?.onlineOnly ?? false
            });

        if (error) throw error;
        return (data || []) as AdminPresenceUser[];
    },

    async getProviderAnalytics(days = 30) {
        const { data, error } = await supabase
            .rpc('admin_get_provider_analytics', {
                p_days: days
            });

        if (error) throw error;
        return (data || []) as AdminProviderAnalytics[];
    }
};
