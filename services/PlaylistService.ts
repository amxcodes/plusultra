import { supabase } from '../lib/supabase';
import { Playlist, Movie } from '../types';
import { getDisplayName } from '../lib/displayName';

export const PlaylistService = {
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
            profiles: p.profiles ? {
                ...p.profiles,
                username: getDisplayName(p.profiles.username)
            } : p.profiles,
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
        return (data || []).map((playlist: any) => ({
            ...playlist,
            profiles: playlist.profiles ? {
                ...playlist.profiles,
                username: getDisplayName(playlist.profiles.username)
            } : playlist.profiles,
        }));
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
        // JOIN to avoid N+1 query
        const { data: items, error } = await supabase
            .from('playlist_items')
            .select(`
                *,
                profile:added_by_user_id ( username, avatar_url )
            `)
            .eq('playlist_id', playlistId)
            .order('added_at', { ascending: false });

        if (error) {
            console.error('Error fetching playlist items:', error);
            return [];
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
            genreIds: item.metadata.genre_ids || [],
            addedBy: item.profile ? {
                username: getDisplayName(item.profile.username),
                avatarUrl: item.profile.avatar_url
            } : undefined,
            addedByUserId: item.added_by_user_id,
            mediaType: item.media_type
        }));
    },

    async getPlaylistCollaborationStats(playlistId: string) {
        // Aggregate items added by each user
        const { data: items, error } = await supabase
            .from('playlist_items')
            .select('added_by_user_id, profile:added_by_user_id(username, avatar_url)')
            .eq('playlist_id', playlistId);

        if (error) {
            console.error('Error fetching stats:', error);
            return [];
        }

        const statsMap: Record<string, any> = {};

        items.forEach((item: any) => {
            const uid = item.added_by_user_id;
            if (!uid) return;

            if (!statsMap[uid]) {
                statsMap[uid] = {
                    user_id: uid,
                    username: getDisplayName(item.profile?.username),
                    avatar_url: item.profile?.avatar_url || '',
                    items_added: 0,
                    role: 'editor' // Default role
                };
            }
            statsMap[uid].items_added++;
        });

        return Object.values(statsMap);
    },

    // --- Collaboration ---

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
        return (data || []).map((collaborator: any) => ({
            ...collaborator,
            profile: collaborator.profile ? {
                ...collaborator.profile,
                username: getDisplayName(collaborator.profile.username)
            } : collaborator.profile
        }));
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
};
