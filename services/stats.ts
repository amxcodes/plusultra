import { supabase } from '../lib/supabase';
import { VIEW_SESSION_HEARTBEAT_SECONDS } from '../lib/sessionTracking';

// Types
export interface ServerVote {
    provider_id: string;
    vote_count: number;
    attempt_count?: number;
    success_count?: number;
    failure_count?: number;
    quick_exit_count?: number;
    total_score?: number;
}

export interface UserStats {
    total_movies: number;
    total_shows: number;
    streak_days: number;
    last_watched: string | null;
    genre_counts: Record<string, number>;
}

export interface ViewSessionHeartbeatInput {
    sessionId: string;
    tmdbId: string;
    mediaType: 'movie' | 'tv';
    season?: number;
    episode?: number;
    providerId?: string;
    title?: string;
    genres?: string[];
}

export interface ProviderAttemptInput {
    attemptId: string;
    sessionId: string;
    tmdbId: string;
    mediaType: 'movie' | 'tv';
    season?: number;
    episode?: number;
    providerId: string;
}

type PrivateStatsProfile = {
    stats?: UserStats | null;
};

export const StatsService = {
    /**
     * Get the best server for a specific movie/episode
     */
    async getBestServer(tmdbId: string, mediaType: 'movie' | 'tv', season = 1, episode = 1) {
        const { data, error } = await supabase
            .rpc('get_best_provider_for_content', {
                p_tmdb_id: tmdbId,
                p_media_type: mediaType,
                p_season: season,
                p_episode: episode
            })
            .maybeSingle();

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

    async trackViewSession(input: ViewSessionHeartbeatInput) {
        const { error } = await supabase.rpc('heartbeat_view_session', {
            p_session_id: input.sessionId,
            p_tmdb_id: input.tmdbId,
            p_media_type: input.mediaType,
            p_season: input.mediaType === 'tv' ? (input.season || 1) : null,
            p_episode: input.mediaType === 'tv' ? (input.episode || 1) : null,
            p_provider_id: input.providerId || null,
            p_title: input.title || null,
            p_genres: input.genres && input.genres.length > 0 ? input.genres : null,
            p_heartbeat_seconds: VIEW_SESSION_HEARTBEAT_SECONDS
        });

        if (error) {
            console.error('[StatsService] Failed to track session heartbeat:', error);
        }
    },

    async startProviderAttempt(input: ProviderAttemptInput) {
        const { error } = await supabase.rpc('start_provider_attempt', {
            p_attempt_id: input.attemptId,
            p_session_id: input.sessionId,
            p_tmdb_id: input.tmdbId,
            p_media_type: input.mediaType,
            p_season: input.mediaType === 'tv' ? (input.season || 1) : null,
            p_episode: input.mediaType === 'tv' ? (input.episode || 1) : null,
            p_provider_id: input.providerId
        });

        if (error) {
            console.error('[StatsService] Failed to start provider attempt:', error);
        }
    },

    async markProviderAttemptReady(attemptId: string) {
        const { error } = await supabase.rpc('mark_provider_attempt_ready', {
            p_attempt_id: attemptId
        });

        if (error) {
            console.error('[StatsService] Failed to mark provider attempt ready:', error);
        }
    },

    async heartbeatProviderAttempt(attemptId: string, progressSeconds?: number, activeIncrement = 15) {
        const { error } = await supabase.rpc('heartbeat_provider_attempt', {
            p_attempt_id: attemptId,
            p_progress_seconds: typeof progressSeconds === 'number' ? Math.floor(progressSeconds) : null,
            p_active_increment: activeIncrement
        });

        if (error) {
            console.error('[StatsService] Failed to heartbeat provider attempt:', error);
        }
    },

    async finishProviderAttempt(attemptId: string, reason?: string) {
        const { error } = await supabase.rpc('finish_provider_attempt', {
            p_attempt_id: attemptId,
            p_reason: reason || null
        });

        if (error) {
            console.error('[StatsService] Failed to finish provider attempt:', error);
        }
    },

    /**
     * Get User Stats
     */
    async getUserStats(userId: string): Promise<UserStats | null> {
        const { data, error } = await supabase
            .rpc('get_private_profile', {
                p_user_id: userId
            })
            .maybeSingle(); // Use maybeSingle() to handle no results gracefully

        if (error) {
            console.error('[StatsService] Failed to fetch user stats:', error);
            return null;
        }

        const profile = data as PrivateStatsProfile | null;

        if (!profile?.stats) {
            console.warn('[StatsService] No stats found for user:', userId);
            return null;
        }

        return profile.stats;
    }
};
