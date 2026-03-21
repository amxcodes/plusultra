import {
    VIEW_SESSION_HEARTBEAT_SECONDS,
    VIEW_SESSION_QUALIFICATION_SECONDS,
    getSessionCountKey,
    getSessionQualificationSeconds,
} from '../../lib/sessionTracking';

describe('sessionTracking', () => {
    it('uses a stable movie key', () => {
        expect(getSessionCountKey({ tmdbId: '550', mediaType: 'movie' })).toBe('movie:550');
    });

    it('uses episode-level keys for tv sessions', () => {
        expect(getSessionCountKey({ tmdbId: '1396', mediaType: 'tv', season: 2, episode: 4 })).toBe('tv:1396:s2:e4');
    });

    it('exposes session heartbeat and qualification thresholds', () => {
        expect(VIEW_SESSION_HEARTBEAT_SECONDS).toBe(30);
        expect(VIEW_SESSION_QUALIFICATION_SECONDS.movie).toBe(1200);
        expect(VIEW_SESSION_QUALIFICATION_SECONDS.tv).toBe(600);
        expect(getSessionQualificationSeconds('movie')).toBe(1200);
        expect(getSessionQualificationSeconds('tv')).toBe(600);
    });
});
