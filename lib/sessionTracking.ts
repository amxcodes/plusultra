export type SessionMediaType = 'movie' | 'tv';

export const VIEW_SESSION_HEARTBEAT_SECONDS = 30;

export const VIEW_SESSION_QUALIFICATION_SECONDS: Record<SessionMediaType, number> = {
    movie: 20 * 60,
    tv: 10 * 60,
};

export interface SessionTrackingInput {
    tmdbId: string;
    mediaType: SessionMediaType;
    season?: number;
    episode?: number;
}

export const getSessionCountKey = ({
    tmdbId,
    mediaType,
    season = 1,
    episode = 1,
}: SessionTrackingInput): string => {
    if (mediaType === 'tv') {
        return `tv:${tmdbId}:s${season}:e${episode}`;
    }

    return `movie:${tmdbId}`;
};

export const getSessionQualificationSeconds = (mediaType: SessionMediaType): number => {
    return VIEW_SESSION_QUALIFICATION_SECONDS[mediaType];
};
