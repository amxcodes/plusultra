import { supabase } from '../lib/supabase';

// Types
export interface ServerVote {
    provider_id: string;
    vote_count: number;
}

export interface UserStats {
    total_movies: number;
    total_shows: number;
    streak_days: number;
    last_watched: string | null;
    genre_counts: Record<string, number>;
}

export const StatsService = {
    /**
     * Get the best server for a specific movie/episode
     */
    async getBestServer(tmdbId: string, mediaType: 'movie' | 'tv', season = 1, episode = 1) {
        const { data, error } = await supabase
            .from('server_votes')
            .select('provider_id, vote_count')
            .eq('tmdb_id', tmdbId)
            .eq('media_type', mediaType)
            .eq('season', season)
            .eq('episode', episode)
            .order('vote_count', { ascending: false })
            .limit(1)
            .maybeSingle(); // Use maybeSingle() to avoid error on no results

        if (error) {
            console.error('[StatsService] Failed to fetch best server:', error);
            return null;
        }
        return data as ServerVote | null;
    },

    /**
     * Cast a vote for a working server
     */
    async castVote(tmdbId: string, mediaType: 'movie' | 'tv', providerId: string, season = 1, episode = 1) {
        // Check if already voted locally to prevent spam
        const key = `voted_${tmdbId}_${mediaType}_${season}_${episode}`;
        if (localStorage.getItem(key)) return;

        const { error } = await supabase.rpc('increment_server_vote', {
            p_tmdb_id: tmdbId,
            p_media_type: mediaType,
            p_season: season,
            p_episode: episode,
            p_provider_id: providerId
        });

        if (error) {
            console.error('[StatsService] Failed to cast vote:', error);
        } else {
            localStorage.setItem(key, 'true');
        }
    },

    /**
     * Update user stats (run this when video progress > 80% or something)
     * This uses the new RPC that updates BOTH granular history and aggregate stats
     */
    async updateWatchStats(
        userId: string,
        tmdbId: string,
        mediaType: 'movie' | 'tv',
        durationMinutes: number,
        genres: string[],
        metaData: any
    ) {
        const { error } = await supabase.rpc('update_watch_history_with_stats', {
            p_user_id: userId,
            p_tmdb_id: tmdbId,
            p_media_type: mediaType,
            p_duration: durationMinutes,
            p_genres: genres,
            p_data: metaData
        });

        if (error) {
            console.error('[StatsService] Failed to update stats:', error);
        }
    },

    /**
     * Get User Stats
     */
    async getUserStats(userId: string): Promise<UserStats | null> {
        const { data, error } = await supabase
            .from('profiles')
            .select('stats')
            .eq('id', userId)
            .maybeSingle(); // Use maybeSingle() to handle no results gracefully

        if (error) {
            console.error('[StatsService] Failed to fetch user stats:', error);
            return null;
        }

        if (!data || !data.stats) {
            console.warn('[StatsService] No stats found for user:', userId);
            return null;
        }

        return data.stats as UserStats;
    }
};
