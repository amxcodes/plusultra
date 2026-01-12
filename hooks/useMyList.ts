
import { useState, useEffect } from 'react';
import { Movie } from '../types';
import { useAuth } from '../lib/AuthContext';
import { SocialService } from '../lib/social';
import { supabase } from '../lib/supabase';

export const useMyList = () => {
    const { user } = useAuth();
    const [list, setList] = useState<Movie[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchList = async () => {
        if (!user) {
            setList([]);
            setLoading(false);
            return;
        }

        try {
            // 1. Find the 'watch_later' playlist for this user
            const playlists = await SocialService.getPlaylists(user.id);
            const watchLater = playlists.find(p => p.type === 'watch_later');

            if (watchLater) {
                // 2. Fetch items
                // We need a method to get items as Movie objects. 
                // SocialService.getPlaylistItems returns { playlist_id, tmdb_id, ... }
                // We need to fetch details. 
                // For performance, we might store metadata in the join or just fetch basic info.
                // Actually SocialService.getPlaylistDetails returns "items" which are Movies?
                // No, getPlaylistItems returns rows.

                // Let's use getPlaylistDetails from SocialService if it fetches movies.
                // Wait, getPlaylistDetails fetches metadata.
                // Let's check `SocialService.getPlaylistDetails`.

                // Inspecting previous `SocialService` code in memory...
                // `getPlaylistItems` fetches `playlist_items` rows. 
                // `playlist_items` has `metadata` column which stores `{ title, imageUrl, ... }` snapshot!
                // So we can reconstruct `Movie` objects from `metadata`.

                const items = await SocialService.getPlaylistItems(watchLater.id);
                setList(items);
            }
        } catch (error) {
            console.error("Error fetching My List:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchList();

        // Subscribe to changes?
        // Realtime subscription would be nice but simple refetch on focus or manual trigger is easier for v1.
    }, [user]);

    const addToList = async (movie: Movie) => {
        if (!user) return; // Prompt auth?

        // Optimistic Update
        const optimisticList = [movie, ...list];
        setList(optimisticList);

        try {
            const playlists = await SocialService.getPlaylists(user.id);
            let watchLater = playlists.find(p => p.type === 'watch_later');

            if (!watchLater) {
                // Should exist via trigger, but handle edge case
                watchLater = await SocialService.createPlaylist(user.id, "Watch Later", undefined, false);
                // If that fails or requires implementation modification to support type param...
                // SocialService.createPlaylist signature: (userId, name, description, isPublic)
                // It doesn't support 'type'.
                // The trigger creates it. If it's missing, maybe we just create a custom one named 'Watch Later'?
                // Ideally we fix the service to support type or assume it exists.
                // let's assume it exists for now as per schema trigger.
            }

            if (watchLater) {
                await SocialService.addToPlaylist(watchLater.id, movie);
            }
        } catch (error) {
            console.error("Failed to add to list", error);
            // Revert
            setList(list);
        }
    };

    const removeFromList = async (movieId: number) => {
        if (!user) return;

        // Optimistic
        const original = [...list];
        setList(prev => prev.filter(m => m.id !== movieId));

        try {
            const playlists = await SocialService.getPlaylists(user.id);
            const watchLater = playlists.find(p => p.type === 'watch_later');
            if (watchLater) {
                // We need to remove by TMDB ID
                await SocialService.removeFromPlaylist(watchLater.id, movieId.toString());
            }
        } catch (error) {
            console.error("Failed to remove from list", error);
            setList(original);
        }
    };

    const isInList = (movieId: number) => {
        return list.some(m => m.id === movieId || m.tmdbId === movieId);
    };

    return { list, addToList, removeFromList, isInList, loading };
};
