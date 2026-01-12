
import { supabase } from './supabase';
import { Movie, Profile, Playlist } from '../types';

export const SocialService = {
    // --- Profiles ---

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

    // --- Playlists ---

    async getPlaylists(userId: string): Promise<Playlist[]> {
        const { data, error } = await supabase
            .from('playlists')
            .select(`
                *,
                items:playlist_items(
                    metadata
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching playlists:', error);
            return [];
        }

        // Transform for easier UI consumption: limit to 4 items and map metadata
        return data.map((p: any) => ({
            ...p,
            items: p.items.slice(0, 4)
        }));
    },

    async getPublicPlaylists(userId?: string): Promise<Playlist[]> {
        let query = supabase
            .from('playlists')
            .select(`
            *,
            profiles!playlists_user_id_fkey (username, avatar_url),
            items:playlist_items(metadata)
        `)
            .eq('is_public', true)
            .order('created_at', { ascending: false })
            .limit(50);

        // If a userId is provided, exclude their own playlists
        if (userId) {
            query = query.neq('user_id', userId);
        }

        const { data, error } = await query;
        if (error) {
            console.error('Error fetching public playlists:', error);
            return [];
        }
        return data.map((p: any) => ({
            ...p,
            items: p.items.slice(0, 4)
        }));
    },

    async searchPlaylists(query: string): Promise<Playlist[]> {
        const { data, error } = await supabase
            .from('playlists')
            .select(`
            *,
            profiles!playlists_user_id_fkey (username, avatar_url)
        `)
            .eq('is_public', true)
            .ilike('name', `%${query}%`)
            .limit(20);

        if (error) {
            console.error('Error searching playlists:', error);
            return [];
        }
        return data || [];
    },

    async createPlaylist(userId: string, name: string, description?: string, isPublic: boolean = true) {
        const { data, error } = await supabase
            .from('playlists')
            .insert({
                user_id: userId,
                name,
                description,
                is_public: isPublic,
                type: 'custom'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deletePlaylist(playlistId: string) {
        const { error } = await supabase
            .from('playlists')
            .delete()
            .eq('id', playlistId);
        if (error) throw error;
    },

    async getPlaylistDetails(playlistId: string): Promise<Playlist | null> {
        const { data, error } = await supabase
            .from('playlists')
            .select('*')
            .eq('id', playlistId)
            .single();

        if (error) {
            console.error("Error fetching playlist details:", error);
            return null;
        }
        return data;
    },

    async addToPlaylist(playlistId: string, movie: Movie) {
        // We only store essential metadata to reconstruct the card
        const metadata = {
            title: movie.title,
            poster_path: movie.imageUrl,
            backdrop_path: movie.backdropUrl,
            vote_average: movie.match ? movie.match / 10 : 0, // Convert back to 0-10 scale if needed
            release_date: movie.year ? `${movie.year}-01-01` : null // Approx
        };

        const { error } = await supabase
            .from('playlist_items')
            .insert({
                playlist_id: playlistId,
                tmdb_id: movie.id.toString(),
                media_type: movie.mediaType || 'movie',
                metadata
            });

        if (error) {
            // Ignore duplicate violations
            if (error.code === '23505') return;
            throw error;
        }
    },

    async removeFromPlaylist(playlistId: string, tmdbId: string) {
        const { error } = await supabase
            .from('playlist_items')
            .delete()
            .match({ playlist_id: playlistId, tmdb_id: tmdbId });
        if (error) throw error;
    },

    async getPlaylistItems(playlistId: string): Promise<Movie[]> {
        const { data, error } = await supabase
            .from('playlist_items')
            .select('*')
            .eq('playlist_id', playlistId)
            .order('added_at', { ascending: false });

        if (error) {
            console.error('Error fetching playlist items:', error);
            return [];
        }

        // Map DB items back to local Movie interface
        return data.map((item: any) => ({
            id: parseInt(item.tmdb_id),
            tmdbId: parseInt(item.tmdb_id),
            title: item.metadata.title,
            imageUrl: item.metadata.poster_path,
            backdropUrl: item.metadata.backdrop_path,
            match: Math.round((item.metadata.vote_average || 0) * 10),
            year: item.metadata.release_date ? new Date(item.metadata.release_date).getFullYear() : 0,
            genre: [],
            description: '',
            mediaType: item.media_type
        }));
    },


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
    },

    async getFeaturedMovies() {
        const { data, error } = await supabase
            .from('featured_movies')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
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
    },

    async removeFeaturedMovie(id: string) {
        const { error } = await supabase
            .from('featured_movies')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    async getFeaturedPlaylists() {
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

        return data.map((p: any) => ({
            ...p,
            items: p.items.slice(0, 9)
        }));
    },

    async getUserStats(userId: string) {
        // Watch History Count
        const { count: historyCount } = await supabase
            .from('watch_history')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        // Saved Items (My List / Watch Later)
        const { data: watchLater } = await supabase
            .from('playlists')
            .select('id')
            .match({ user_id: userId, type: 'watch_later' })
            .single();

        let listCount = 0;
        if (watchLater) {
            const { count } = await supabase
                .from('playlist_items')
                .select('*', { count: 'exact', head: true })
                .eq('playlist_id', watchLater.id);
            listCount = count || 0;
        }

        // Get breakdown of history types (this is rough, doing it via get because we need metadata)
        // Ideally we'd do a Count Group By, but Supabase JS client doesn't support that easily without RPC.
        // We'll just estimate or strictly just show total history for now to avoid heavy fetches.
        return {
            historyCount: historyCount || 0,
            listCount: listCount || 0
        };
    },

    async clearWatchHistory(userId: string) {
        const { error } = await supabase
            .from('watch_history')
            .delete()
            .eq('user_id', userId);
        if (error) throw error;
    },

    // --- App Settings ---

    async getAppSettings() {
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
        return settings;
    },

    async updateAppSetting(key: string, value: string) {
        const { error } = await supabase
            .from('app_settings')
            .upsert({ key, value });
        if (error) throw error;
    }
};
