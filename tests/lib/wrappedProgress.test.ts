import {
    buildWrappedProgressPayload,
    getWrappedCompletionThresholdSeconds,
    getWrappedTitleKey,
    getWrappedUnitKey,
    qualifiesForWrappedCompletion,
} from '../../lib/wrappedProgress';

describe('wrappedProgress', () => {
    it('uses title-level keys for movies', () => {
        expect(getWrappedTitleKey({ tmdbId: '550', type: 'movie' })).toBe('movie:550');
        expect(getWrappedUnitKey({ tmdbId: '550', type: 'movie' })).toBe('movie:550');
    });

    it('uses episode-level keys for tv episodes', () => {
        expect(getWrappedUnitKey({ tmdbId: '1396', type: 'tv', season: 1, episode: 3 })).toBe('tv:1396:s1:e3');
    });

    it('qualifies progress by real duration when available', () => {
        expect(getWrappedCompletionThresholdSeconds({ type: 'movie', duration: 5000 })).toBe(4000);
        expect(qualifiesForWrappedCompletion({ type: 'movie', duration: 5000, time: 3999 })).toBe(false);
        expect(qualifiesForWrappedCompletion({ type: 'movie', duration: 5000, time: 4000 })).toBe(true);
    });

    it('falls back to conservative thresholds when duration is unknown', () => {
        expect(getWrappedCompletionThresholdSeconds({ type: 'movie', duration: 0 })).toBe(2700);
        expect(getWrappedCompletionThresholdSeconds({ type: 'tv', duration: 0 })).toBe(1200);
        expect(qualifiesForWrappedCompletion({ type: 'tv', duration: 0, time: 1199 })).toBe(false);
        expect(qualifiesForWrappedCompletion({ type: 'tv', duration: 0, time: 1200 })).toBe(true);
    });

    it('builds wrapped metadata onto the synced payload', () => {
        expect(
            buildWrappedProgressPayload({
                tmdbId: '1396',
                type: 'tv',
                season: 2,
                episode: 4,
                time: 1250,
                duration: 0,
            })
        ).toMatchObject({
            wrappedTitleKey: 'tv:1396',
            wrappedUnitKey: 'tv:1396:s2:e4',
            wrappedQualified: true,
        });
    });
});
