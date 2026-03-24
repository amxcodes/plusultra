import { CuratorService } from '../../services/CuratorService';
import { Movie } from '../../types';

const sampleMovie = (overrides: Partial<Movie> = {}): Movie => ({
    id: 101,
    title: 'Night Spiral',
    match: 82,
    imageUrl: 'https://example.com/poster.jpg',
    mediaType: 'movie',
    genreIds: [53, 9648],
    ...overrides,
});

describe('CuratorService', () => {
    it('parses prompt constraints into a structured request', () => {
        const request = CuratorService.parsePrompt(
            'Build me 6 dark sci-fi movies under 2 hours, no anime, hidden gems',
            ['late night']
        );

        expect(request.count).toBe(6);
        expect(request.mediaType).toBe('movie');
        expect(request.includeGenreIds).toContain(878);
        expect(request.vibeTags).toContain('late-night');
        expect(request.hiddenGemBias).toBe('high');
        expect(request.excludeGenreIds).toContain(16);
        expect(request.runtimeBucket).toBe('short');
        expect(request.maxRuntimeMinutes).toBe(120);
        expect(request.animeAllowed).toBe(false);
        expect(request.seedQueries).toEqual([]);
    });

    it('parses very short runtime requests', () => {
        const request = CuratorService.parsePrompt('movies under 1 hour');

        expect(request.mediaType).toBe('movie');
        expect(request.runtimeBucket).toBe('short');
        expect(request.maxRuntimeMinutes).toBe(60);
    });

    it('captures mood and aesthetic language', () => {
        const request = CuratorService.parsePrompt('movies i can vibe to when i feel emotional and want something aesthetic');

        expect(request.moodTags).toContain('emotional');
        expect(request.moodTags).toContain('aesthetic');
        expect(request.includeGenreIds.length).toBeGreaterThan(0);
    });

    it('extracts explicit seed titles from similarity prompts', () => {
        const request = CuratorService.parsePrompt('Movies like Iron Man but darker and less childish');

        expect(request.seedQueries).toEqual(['Iron Man']);
    });

    it('extracts explicit seed titles from based-on prompts', () => {
        const request = CuratorService.parsePrompt('Build a playlist based on Interstellar, but warmer and less slow');

        expect(request.seedQueries).toEqual(['Interstellar']);
    });

    it('does not chop titles that contain the word with', () => {
        const request = CuratorService.parsePrompt('Movies like Cloudy with a Chance of Meatballs');

        expect(request.seedQueries).toEqual(['Cloudy with a Chance of Meatballs']);
    });

    it('captures transform modifiers on seeded prompts', () => {
        const request = CuratorService.parsePrompt('Movies like Interstellar but darker and shorter');

        expect(request.seedQueries).toEqual(['Interstellar']);
        expect(request.modifierTags).toContain('darker');
        expect(request.modifierTags).toContain('shorter');
        expect(request.maxRuntimeMinutes).toBe(110);
    });

    it('records smash feedback into curator memory', () => {
        const next = CuratorService.recordFeedback(
            {
                sessions: 2,
                promptHistory: ['late-night thrillers'],
                smashed: [],
                passed: [],
                updatedAt: Date.now(),
            },
            sampleMovie(),
            'smash'
        );

        expect(next.smashed).toHaveLength(1);
        expect(next.smashed[0].title).toBe('Night Spiral');
        expect(next.passed).toHaveLength(0);
    });

    it('moves a title out of smashed memory when passed later', () => {
        const movie = sampleMovie({ id: 202, title: 'Glass Circuit', mediaType: 'tv', genreIds: [18, 9648] });

        const next = CuratorService.recordFeedback(
            {
                sessions: 4,
                promptHistory: ['smart mystery shows'],
                smashed: [
                    {
                        id: movie.id,
                        mediaType: 'tv',
                        title: movie.title,
                        genreIds: movie.genreIds || [],
                        timestamp: Date.now() - 1000,
                    },
                ],
                passed: [],
                updatedAt: Date.now(),
            },
            movie,
            'pass'
        );

        expect(next.smashed).toHaveLength(0);
        expect(next.passed).toHaveLength(1);
        expect(next.passed[0].mediaType).toBe('tv');
    });
});
