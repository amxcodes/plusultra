export interface WrappedProgressSnapshot {
    tmdbId: string;
    type: 'movie' | 'tv';
    season?: number;
    episode?: number;
    time: number;
    duration: number;
}

const FALLBACK_THRESHOLDS_SECONDS = {
    movie: 45 * 60,
    tv: 20 * 60,
} as const;

export const getWrappedTitleKey = (progress: Pick<WrappedProgressSnapshot, 'tmdbId' | 'type'>): string => {
    return `${progress.type}:${progress.tmdbId}`;
};

export const getWrappedUnitKey = (progress: Pick<WrappedProgressSnapshot, 'tmdbId' | 'type' | 'season' | 'episode'>): string => {
    if (progress.type === 'tv' && progress.season != null && progress.episode != null) {
        return `${progress.type}:${progress.tmdbId}:s${progress.season}:e${progress.episode}`;
    }

    return getWrappedTitleKey(progress);
};

export const getWrappedCompletionThresholdSeconds = (
    progress: Pick<WrappedProgressSnapshot, 'type' | 'duration'>
): number => {
    if (progress.duration > 0) {
        return Math.max(1, Math.ceil(progress.duration * 0.8));
    }

    return FALLBACK_THRESHOLDS_SECONDS[progress.type];
};

export const qualifiesForWrappedCompletion = (
    progress: Pick<WrappedProgressSnapshot, 'type' | 'time' | 'duration'>
): boolean => {
    return progress.time >= getWrappedCompletionThresholdSeconds(progress);
};

export const buildWrappedProgressPayload = <T extends WrappedProgressSnapshot>(progress: T) => {
    return {
        ...progress,
        wrappedTitleKey: getWrappedTitleKey(progress),
        wrappedUnitKey: getWrappedUnitKey(progress),
        wrappedQualified: qualifiesForWrappedCompletion(progress),
    };
};
