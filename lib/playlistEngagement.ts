import { supabase } from './supabase';
import { Playlist } from '../types';
import { getDisplayName } from './displayName';

export const PlaylistEngagement = {
    // Like a playlist
    likePlaylist: async (playlistId: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const { error } = await supabase.rpc('like_playlist', { p_playlist_id: playlistId });
            if (error) throw error;
            return { success: true };
        } catch (error: any) {
            console.error('Error liking playlist:', error);
            return { success: false, error: error.message };
        }
    },

    // Unlike a playlist
    unlikePlaylist: async (playlistId: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const { error } = await supabase.rpc('unlike_playlist', { p_playlist_id: playlistId });
            if (error) throw error;
            return { success: true };
        } catch (error: any) {
            console.error('Error unliking playlist:', error);
            return { success: false, error: error.message };
        }
    },

    // Check if current user has liked a playlist
    checkIfLiked: async (playlistId: string): Promise<boolean> => {
        try {
            const { data: user } = await supabase.auth.getUser();
            if (!user.user) return false;

            const { data, error } = await supabase
                .from('playlist_likes')
                .select('*')
                .eq('playlist_id', playlistId)
                .eq('user_id', user.user.id)
                .maybeSingle();

            return !!data && !error;
        } catch {
            return false;
        }
    },

    // Get user's liked playlists
    getLikedPlaylists: async (): Promise<Playlist[]> => {
        try {
            const { data: user } = await supabase.auth.getUser();
            if (!user.user) return [];

            const { data, error } = await supabase
                .from('playlist_likes')
                .select(`
          playlist_id,
          playlists:playlist_id (
            id,
            name,
            description,
            is_public,
            is_featured,
            type,
            created_at,
            likes_count,
            user_id,
            profiles!playlists_user_id_fkey (
              username,
              avatar_url
            ),
            items:playlist_items (
              metadata
            )
          )
        `)
                .eq('user_id', user.user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return (data || []).map((item: any) => ({
                ...item.playlists,
                profiles: item.playlists.profiles ? {
                    ...item.playlists.profiles,
                    username: getDisplayName(item.playlists.profiles.username)
                } : item.playlists.profiles
            }));
        } catch (error) {
            console.error('Error fetching liked playlists:', error);
            return [];
        }
    },

    // Track a playlist view
    trackView: async (playlistId: string): Promise<void> => {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData.user?.id;

        // Server-side view tracking requires auth. Skip quietly for signed-out sessions.
        if (!userId) {
            return;
        }

        const trackedKey = `viewed_playlist_${playlistId}_${userId}`;
        const inFlightKey = `viewing_playlist_${playlistId}_${userId}`;

        if (typeof window !== 'undefined') {
            if (sessionStorage.getItem(trackedKey) || sessionStorage.getItem(inFlightKey)) {
                return;
            }

            // Temporary in-flight lock prevents strict-mode double invokes,
            // but only becomes a permanent session lock after a successful RPC.
            sessionStorage.setItem(inFlightKey, 'true');
        }

        try {
            const { error } = await supabase.rpc('track_playlist_view', { p_playlist_id: playlistId });

            if (error) {
                throw error;
            }

            if (typeof window !== 'undefined') {
                sessionStorage.setItem(trackedKey, 'true');
            }
        } catch (error) {
            console.error('Error tracking view:', error);
        } finally {
            if (typeof window !== 'undefined') {
                sessionStorage.removeItem(inFlightKey);
            }
        }
    },

    // Get trending playlists (this week)
    getTrendingThisWeek: async (limit: number = 20): Promise<Playlist[]> => {
        try {
            const { data, error } = await supabase
                .from('playlists')
                .select(`
          *,
          profiles!playlists_user_id_fkey (
            username,
            avatar_url
          ),
          items:playlist_items (
            metadata
          )
        `)
                .eq('is_public', true)
                .in('type', ['custom', 'curated'])
                .order('analytics->weekly_views' as any, { ascending: false })
                .limit(limit);

            if (error) throw error;
            return (data || []).map((playlist: any) => ({
                ...playlist,
                profiles: playlist.profiles ? {
                    ...playlist.profiles,
                    username: getDisplayName(playlist.profiles.username)
                } : playlist.profiles
            }));
        } catch (error) {
            console.error('Error fetching trending playlists:', error);
            return [];
        }
    },

    // Get popular playlists (this month)
    getPopularThisMonth: async (limit: number = 20): Promise<Playlist[]> => {
        try {
            const { data, error } = await supabase
                .from('playlists')
                .select(`
          *,
          profiles!playlists_user_id_fkey (
            username,
            avatar_url
          ),
          items:playlist_items (
            metadata
          )
        `)
                .eq('is_public', true)
                .in('type', ['custom', 'curated'])
                .order('analytics->monthly_views' as any, { ascending: false })
                .limit(limit);

            if (error) throw error;
            return (data || []).map((playlist: any) => ({
                ...playlist,
                profiles: playlist.profiles ? {
                    ...playlist.profiles,
                    username: getDisplayName(playlist.profiles.username)
                } : playlist.profiles
            }));
        } catch (error) {
            console.error('Error fetching popular playlists:', error);
            return [];
        }
    },

    // Get most liked playlists (all-time)
    getMostLikedAllTime: async (limit: number = 20): Promise<Playlist[]> => {
        try {
            const { data, error } = await supabase
                .from('playlists')
                .select(`
          *,
          profiles!playlists_user_id_fkey (
            username,
            avatar_url
          ),
          items:playlist_items (
            metadata
          )
        `)
                .eq('is_public', true)
                .in('type', ['custom', 'curated'])
                .order('likes_count', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return (data || []).map((playlist: any) => ({
                ...playlist,
                profiles: playlist.profiles ? {
                    ...playlist.profiles,
                    username: getDisplayName(playlist.profiles.username)
                } : playlist.profiles
            }));
        } catch (error) {
            console.error('Error fetching most liked playlists:', error);
            return [];
        }
    },
};
