
import { supabase } from './supabase';
import { Movie, Profile, Playlist } from '../types';
import { cache, CACHE_KEYS } from './cache';

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
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        const isOwnProfile = currentUser?.id === userId;

        let query = supabase
            .from('playlists')
            .select(`
                *,
                items:playlist_items(
                    metadata
                )
            `)
            .order('created_at', { ascending: false });

        if (isOwnProfile) {
            // Fetch playlists I own OR collaborate on
            // First, get IDs of playlists I collaborate on
            const { data: collaborations } = await supabase
                .from('playlist_collaborators')
                .select('playlist_id')
                .eq('user_id', userId)
                .eq('status', 'accepted');

            const collabIds = collaborations?.map(c => c.playlist_id) || [];

            // If has collaborations, construct OR query
            if (collabIds.length > 0) {
                // Syntax: user_id.eq.X,id.in.(Y,Z)
                // Note: id.in.(...) syntax in .or() can be tricky, using filter composition
                query = query.or(`user_id.eq.${userId},id.in.(${collabIds.join(',')})`);
            } else {
                // No collaborations, just owned
                query = query.eq('user_id', userId);
            }
        } else {
            // Viewing someone else: Only show their OWNED playlists
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching playlists:', error);
            return [];
        }

        // Transform for easier UI consumption: limit to 4 items and map metadata
        return data.map((p: any) => ({
            ...p,
            items_count: p.items.length, // Calculate TRUE count before slicing
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
            items_count: p.items.length,
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

    async updatePlaylist(playlistId: string, updates: { name?: string; description?: string }) {
        const { error } = await supabase
            .from('playlists')
            .update(updates)
            .eq('id', playlistId);
        if (error) throw error;
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
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // We only store essential metadata to reconstruct the card
        const metadata = {
            title: movie.title,
            poster_path: movie.imageUrl,
            backdrop_path: movie.backdropUrl,
            vote_average: movie.match ? movie.match / 10 : 0, // Convert back to 0-10 scale if needed
            release_date: movie.year ? `${movie.year}-01-01` : null, // Approx
            genre_ids: movie.genreIds // Store genre IDs
        };

        const { error } = await supabase
            .from('playlist_items')
            .insert({
                playlist_id: playlistId,
                tmdb_id: movie.id.toString(),
                media_type: movie.mediaType || 'movie',
                metadata,
                added_by_user_id: user.id // Track who added this item
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
        const { data: items, error } = await supabase
            .from('playlist_items')
            .select('*')
            .eq('playlist_id', playlistId)
            .order('added_at', { ascending: false });

        if (error) {
            console.error('Error fetching playlist items:', error);
            return [];
        }

        // Fetch profiles for added_by_user_id
        const userIds = [...new Set(items.map(i => i.added_by_user_id).filter(Boolean))];
        let profilesMap: Record<string, any> = {};

        if (userIds.length > 0) {
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, username, avatar_url')
                .in('id', userIds);

            if (profiles) {
                profilesMap = profiles.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
            }
        }

        // Map DB items back to local Movie interface
        return items.map((item: any) => ({
            id: parseInt(item.tmdb_id),
            tmdbId: parseInt(item.tmdb_id),
            title: item.metadata.title,
            imageUrl: item.metadata.poster_path,
            backdropUrl: item.metadata.backdrop_path,
            year: item.metadata.release_date ? new Date(item.metadata.release_date).getFullYear() : 0,
            match: Math.round(item.metadata.vote_average * 10),
            description: item.metadata.overview,
            genre: [], // Encoded in metadata if needed
            genreIds: item.metadata.genre_ids || [], // Retrieve genre IDs
            addedBy: item.added_by_user_id && profilesMap[item.added_by_user_id] ? {
                username: profilesMap[item.added_by_user_id].username,
                avatarUrl: profilesMap[item.added_by_user_id].avatar_url
            } : undefined,
            addedByUserId: item.added_by_user_id, // Map user ID
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
    },

    async removeFeaturedMovie(id: string) {
        const { error } = await supabase
            .from('featured_movies')
            .delete()
            .eq('id', id);
        if (error) throw error;
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

    // --- Notification Badges ---
    async getUnreadCounts(userId: string) {
        // Get user's last seen timestamps
        const { data: profile } = await supabase
            .from('profiles')
            .select('last_seen_announcements, last_seen_activity')
            .eq('id', userId)
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

    async clearWatchHistory() {
        const { error } = await supabase.rpc('clear_my_watch_history');
        if (error) throw error;
    },

    // --- App Settings ---

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

    // --- Recent Searches (Hybrid Storage) ---

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

    // --- Collaboration & Taste ---

    async inviteCollaborator(playlistId: string, userId: string) {
        const { error } = await supabase
            .from('playlist_collaborators')
            .insert({ playlist_id: playlistId, user_id: userId, role: 'editor', status: 'pending' });
        if (error) throw error;
    },

    async getCollaborators(playlistId: string) {
        const { data, error } = await supabase
            .from('playlist_collaborators')
            .select(`
                *,
                profile:user_id(id, username, avatar_url)
            `)
            .eq('playlist_id', playlistId);
        if (error) throw error;
        return data || [];
    },

    async respondToInvite(collaboratorId: string, status: 'accepted' | 'rejected') {
        if (status === 'rejected') {
            const { error } = await supabase
                .from('playlist_collaborators')
                .delete()
                .eq('id', collaboratorId);
            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('playlist_collaborators')
                .update({ status: 'accepted' })
                .eq('id', collaboratorId);
            if (error) throw error;
        }
    },

    async removeCollaborator(collaboratorId: string) {
        const { error } = await supabase
            .from('playlist_collaborators')
            .delete()
            .eq('id', collaboratorId);
        if (error) throw error;
    },

    async getNotifications(userId: string) {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async markNotificationRead(notificationId: string) {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId);
        if (error) throw error;
    },

    async updateTasteCompatibility(userA: string, userB: string, score: number, shared: string[]) {
        const { error } = await supabase
            .rpc('upsert_friend_compatibility', {
                p_user_1: userA,
                p_user_2: userB,
                p_score: score,
                p_shared_genres: shared
            });
        if (error) console.error("Failed to update compatibility:", error);
    },

    async getTasteCompatibility(userA: string, userB: string) {
        // 1. Try fetching from persistent storage
        const u1 = userA < userB ? userA : userB;
        const u2 = userA < userB ? userB : userA;

        const { data: stored } = await supabase
            .from('friend_compatibility')
            .select('*')
            .eq('user_a', u1)
            .eq('user_b', u2)
            .single();

        if (stored) {
            return {
                score: stored.score,
                shared: stored.shared_genres || [],
                message: stored.score > 75 ? "Vibe Twins!" : stored.score > 50 ? "Solid Mix" : "Eclectic Dup"
            };
        }

        // 2. Fallback to dynamic calculation
        const { data, error } = await supabase
            .rpc('calculate_taste_compatibility', { user_a: userA, user_b: userB });
        if (error) throw error;
        return data;
    },

    async getPlaylistCollaborationStats(playlistId: string) {
        const { data, error } = await supabase
            .rpc('get_playlist_collaboration_stats', { p_playlist_id: playlistId });
        if (error) throw error;
        return data || [];
    },

    async getWatchTogetherRecommendations(playlistId: string) {
        // 1. Get all items in the playlist
        const { data: items, error } = await supabase
            .from('playlist_items')
            .select('metadata')
            .eq('playlist_id', playlistId);

        if (error) throw error;
        if (!items || items.length === 0) return { matching_genres: ['Action', 'Comedy', 'Sci-Fi'] }; // Defaults

        // 2. Aggregate genres
        const genreCounts: Record<string, number> = {};
        items.forEach((item: any) => {
            // Try to extract genres from metadata (names or ids)
            const genres = item.metadata.genres || item.metadata.genre_ids || [];
            genres.forEach((g: any) => {
                const name = typeof g === 'object' ? g.name : g; // Handle {id, name} or "Name" or ID
                if (typeof name === 'string' || typeof name === 'number') {
                    genreCounts[name] = (genreCounts[name] || 0) + 1;
                }
            });
        });

        // 3. Sort by frequency
        const sortedGenres = Object.entries(genreCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([genre]) => genre)
            .slice(0, 3); // Top 3

        return { matching_genres: sortedGenres.length > 0 ? sortedGenres : ['Action', 'Adventure', 'Sci-Fi'] };
    }
};
