import { Movie, Playlist } from '../types';
import { TmdbService } from './tmdb';
import { ProfileService } from './ProfileService';
import { PlaylistService } from './PlaylistService';
import { PlaylistEngagement } from '../lib/playlistEngagement';
import { RecommendationBridge } from './recommendationBridge';

export type CuratorMode = 'pick' | 'playlist';

export type CuratorFeedbackType =
    | 'smash'
    | 'pass'
    | 'already_watched'
    | 'more_like_this'
    | 'less_like_this';

export type CuratorMemoryItem = {
    id: number;
    mediaType: 'movie' | 'tv';
    title: string;
    genreIds: number[];
    timestamp: number;
};

export type CuratorMemory = {
    sessions: number;
    promptHistory: string[];
    smashed: CuratorMemoryItem[];
    passed: CuratorMemoryItem[];
    updatedAt: number;
};

export type CuratorRequest = {
    prompt: string;
    count: number;
    mediaType: 'movie' | 'tv' | 'mixed';
    seedQueries: string[];
    includeGenreIds: number[];
    excludeGenreIds: number[];
    includeGenreNames: string[];
    excludeGenreNames: string[];
    vibeTags: string[];
    hiddenGemBias: 'low' | 'medium' | 'high';
    animeAllowed: boolean;
    runtimeBucket?: 'short' | 'medium' | 'long';
    maxRuntimeMinutes?: number;
    keywords: string[];
    moodTags: string[];
    modifierTags: string[];
};

export type CuratorUserContext = {
    recentSearches: string[];
    recentHistory: Array<{
        tmdbId: string;
        type: 'movie' | 'tv';
        title?: string;
    }>;
    ownedPlaylists: Playlist[];
    likedPlaylists: Playlist[];
    watchedKeys: Set<string>;
    playlistKeys: Set<string>;
    preferredGenreIds: Map<number, number>;
    preferredMediaType: 'movie' | 'tv' | 'mixed';
};

export type RankedCuratorMovie = Movie & {
    curatorScore: number;
    curatorReasons: string[];
};

export type CuratorPlaylistDraft = {
    title: string;
    summary: string;
    items: RankedCuratorMovie[];
};

const CURATOR_MEMORY_LIMIT = 30;

const STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'at', 'be', 'best', 'build', 'for', 'from', 'give', 'i', 'in', 'into',
    'it', 'like', 'make', 'me', 'my', 'of', 'on', 'or', 'please', 'playlist', 'something',
    'that', 'the', 'to', 'want', 'with'
]);

const GENRE_KEYWORDS: Array<{ id: number; name: string; keywords: string[] }> = [
    { id: 28, name: 'Action', keywords: ['action', 'adrenaline', 'explosive'] },
    { id: 12, name: 'Adventure', keywords: ['adventure', 'quest', 'epic'] },
    { id: 16, name: 'Animation', keywords: ['animation', 'animated', 'anime'] },
    { id: 35, name: 'Comedy', keywords: ['comedy', 'funny', 'light', 'laugh'] },
    { id: 80, name: 'Crime', keywords: ['crime', 'gangster', 'heist', 'mafia'] },
    { id: 99, name: 'Documentary', keywords: ['documentary', 'doc'] },
    { id: 18, name: 'Drama', keywords: ['drama', 'emotional', 'serious'] },
    { id: 10751, name: 'Family', keywords: ['family', 'kids'] },
    { id: 14, name: 'Fantasy', keywords: ['fantasy', 'magic'] },
    { id: 27, name: 'Horror', keywords: ['horror', 'scary', 'creepy'] },
    { id: 9648, name: 'Mystery', keywords: ['mystery', 'mind-bending', 'mysterious'] },
    { id: 10749, name: 'Romance', keywords: ['romance', 'romantic', 'love'] },
    { id: 878, name: 'Science Fiction', keywords: ['sci-fi', 'science fiction', 'space', 'future'] },
    { id: 53, name: 'Thriller', keywords: ['thriller', 'tense', 'suspense', 'psychological'] },
];

const VIBE_TAGS = [
    'late-night',
    'comfort',
    'hidden-gems',
    'mind-bending',
    'feel-good',
    'dark',
    'high-energy',
    'emotional',
    'dreamy',
    'nostalgic',
    'cozy',
    'melancholic',
    'romantic',
    'rainy',
    'aesthetic',
];

const MOOD_KEYWORDS: Array<{ tag: string; keywords: string[]; genreBoosts?: number[] }> = [
    { tag: 'emotional', keywords: ['feel something', 'emotional', 'heartbreak', 'cry', 'tearjerker', 'healing'], genreBoosts: [18, 10749] },
    { tag: 'dreamy', keywords: ['dreamy', 'ethereal', 'floaty'], genreBoosts: [14, 18] },
    { tag: 'nostalgic', keywords: ['nostalgic', 'throwback', 'childhood'], genreBoosts: [10751, 35, 12] },
    { tag: 'cozy', keywords: ['cozy', 'warm', 'soft'], genreBoosts: [35, 10751, 10749] },
    { tag: 'melancholic', keywords: ['melancholic', 'lonely', 'sad'], genreBoosts: [18, 10749] },
    { tag: 'romantic', keywords: ['romantic', 'love', 'date night'], genreBoosts: [10749, 35] },
    { tag: 'rainy', keywords: ['rainy', 'moody'], genreBoosts: [18, 9648] },
    { tag: 'aesthetic', keywords: ['aesthetic', 'vibe', 'vibes', 'beautiful', 'stylish'], genreBoosts: [18, 14, 10749] },
];

const MODIFIER_KEYWORDS: Array<{
    tag: string;
    keywords: string[];
    genreBoosts?: number[];
    keywordBoosts?: string[];
    runtimeMax?: number;
}> = [
    {
        tag: 'darker',
        keywords: ['darker', 'grittier', 'bleaker', 'more dark', 'more intense'],
        genreBoosts: [53, 80, 9648, 18, 27],
        keywordBoosts: ['dark', 'gritty', 'bleak', 'moody'],
    },
    {
        tag: 'emotional',
        keywords: ['more emotional', 'more heartfelt', 'more moving', 'deeper', 'more soulful'],
        genreBoosts: [18, 10749, 10751],
        keywordBoosts: ['emotional', 'heartfelt', 'moving', 'soulful'],
    },
    {
        tag: 'shorter',
        keywords: ['shorter', 'quicker', 'quick watch', 'faster'],
        runtimeMax: 110,
        keywordBoosts: ['tight', 'fast', 'quick'],
    },
    {
        tag: 'funny',
        keywords: ['funnier', 'lighter', 'less heavy'],
        genreBoosts: [35, 12, 10751],
        keywordBoosts: ['funny', 'light', 'charming'],
    },
];

const getStorageKey = (userId: string) => `curator_lab_memory_v1_${userId}`;

const toCandidateKey = (movie: Pick<Movie, 'id' | 'mediaType'>) => `${movie.mediaType || 'movie'}:${movie.id}`;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const dedupeMovies = (movies: Movie[]): Movie[] => {
    const map = new Map<string, Movie>();
    movies.forEach(movie => {
        if (!movie.id) return;
        const key = toCandidateKey(movie);
        if (!map.has(key)) {
            map.set(key, movie);
        }
    });
    return Array.from(map.values());
};

const normalizeMemoryItem = (movie: Movie): CuratorMemoryItem => ({
    id: movie.id,
    mediaType: movie.mediaType || 'movie',
    title: movie.title,
    genreIds: movie.genreIds || [],
    timestamp: Date.now(),
});

const overlapCount = (left: number[] = [], right: number[] = []) => {
    if (left.length === 0 || right.length === 0) return 0;
    const rightSet = new Set(right);
    return left.filter(id => rightSet.has(id)).length;
};

const keywordMatchScore = (candidate: Movie, keywords: string[]) => {
    if (keywords.length === 0) return 0;
    const haystack = `${candidate.title} ${candidate.description || ''}`.toLowerCase();
    return keywords.reduce((score, keyword) => score + (haystack.includes(keyword) ? 1 : 0), 0);
};

const tokenizePrompt = (prompt: string) => (
    prompt
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map(token => token.trim())
        .filter(token => token.length > 2 && !STOP_WORDS.has(token))
);

const extractSeedQueries = (prompt: string): string[] => {
    const normalized = prompt.trim().replace(/\s+/g, ' ');
    const patterns = [
        /(?:movies?|shows?|series|playlist)\s+like\s+(.+)/i,
        /similar\s+to\s+(.+)/i,
        /based\s+on\s+(.+)/i,
        /in\s+the\s+vibe\s+of\s+(.+)/i,
    ];

    for (const pattern of patterns) {
        const match = normalized.match(pattern);
        if (!match?.[1]) continue;

        const extracted = match[1]
            .split(/\s*(?:,|\/|&)\s*/i)[0]
            .split(/\b(?:but|except|without|instead of|rather than|under|over|shorter|longer|darker|lighter|warmer|cooler|funnier|scarier|less\s+\w+|more\s+\w+)\b/i)[0]
            .replace(/^["']|["']$/g, '')
            .trim();

        if (extracted.length >= 2) {
            return extracted
                .split(/\s*(?:,|\/|&|\band\b)\s*/i)
                .map(part => part.trim())
                .filter(Boolean)
                .slice(0, 3);
        }
    }

    return [];
};

const buildDraftTitle = (request: CuratorRequest) => {
    if (request.seedQueries.length > 0) {
        return `${request.seedQueries[0]} and Beyond`;
    }

    const vibe = request.vibeTags[0]?.replace('-', ' ');
    const genre = request.includeGenreNames[0];
    const mediaLabel =
        request.mediaType === 'movie'
            ? 'Movies'
            : request.mediaType === 'tv'
                ? 'Series'
                : 'Mix';

    if (vibe && genre) return `${vibe} ${genre} ${mediaLabel}`;
    if (genre) return `${genre} ${mediaLabel} Picks`;
    if (vibe) return `${vibe} ${mediaLabel}`;
    return 'Curated Picks';
};

const buildDraftSummary = (request: CuratorRequest, itemCount: number) => {
    if (request.seedQueries.length > 0) {
        const modifierNote = request.modifierTags.length > 0
            ? `, bent toward a ${request.modifierTags.join(' / ')} spin`
            : '';
        return `A ${itemCount}-title set anchored to ${request.seedQueries[0]}${modifierNote} and nearby picks that fit the same lane.`;
    }

    const filters = [
        request.mediaType !== 'mixed' ? request.mediaType : 'mixed picks',
        ...request.includeGenreNames.slice(0, 2),
        ...request.vibeTags.slice(0, 2).map(tag => tag.replace('-', ' ')),
        request.hiddenGemBias === 'high' ? 'hidden gems' : null,
        request.runtimeBucket === 'short' ? 'lighter time commitment' : null,
    ].filter(Boolean);

    return `A ${itemCount}-title set tuned around ${filters.join(', ') || 'your recent taste'}.`;
};

const collectMoodTags = (combinedText: string) => {
    const moodTags = new Set<string>();
    const genreBoosts = new Set<number>();

    MOOD_KEYWORDS.forEach(mood => {
        if (mood.keywords.some(keyword => combinedText.includes(keyword))) {
            moodTags.add(mood.tag);
            (mood.genreBoosts || []).forEach(genreId => genreBoosts.add(genreId));
        }
    });

    return {
        moodTags: Array.from(moodTags),
        moodGenreBoosts: Array.from(genreBoosts),
    };
};

const collectModifierSignals = (combinedText: string) => {
    const modifierTags = new Set<string>();
    const genreBoosts = new Set<number>();
    const keywordBoosts = new Set<string>();
    let runtimeMax: number | undefined;

    MODIFIER_KEYWORDS.forEach(modifier => {
        if (modifier.keywords.some(keyword => combinedText.includes(keyword))) {
            modifierTags.add(modifier.tag);
            (modifier.genreBoosts || []).forEach(genreId => genreBoosts.add(genreId));
            (modifier.keywordBoosts || []).forEach(keyword => keywordBoosts.add(keyword));
            if (modifier.runtimeMax) {
                runtimeMax = runtimeMax ? Math.min(runtimeMax, modifier.runtimeMax) : modifier.runtimeMax;
            }
        }
    });

    return {
        modifierTags: Array.from(modifierTags),
        modifierGenreBoosts: Array.from(genreBoosts),
        modifierKeywordBoosts: Array.from(keywordBoosts),
        modifierRuntimeMax: runtimeMax,
    };
};

const stableVariantJitter = (id: number, variant: number) => {
    if (variant <= 0) return 0;
    const raw = Math.sin((id + 17) * (variant + 3) * 12.9898) * 43758.5453;
    return (raw - Math.floor(raw)) * 1.35;
};

export const CuratorService = {
    getMemory(userId: string): CuratorMemory {
        if (typeof window === 'undefined') {
            return { sessions: 0, promptHistory: [], smashed: [], passed: [], updatedAt: Date.now() };
        }

        try {
            const raw = localStorage.getItem(getStorageKey(userId));
            if (!raw) {
                return { sessions: 0, promptHistory: [], smashed: [], passed: [], updatedAt: Date.now() };
            }

            const parsed = JSON.parse(raw) as CuratorMemory;
            return {
                sessions: parsed.sessions || 0,
                promptHistory: parsed.promptHistory || [],
                smashed: parsed.smashed || [],
                passed: parsed.passed || [],
                updatedAt: parsed.updatedAt || Date.now(),
            };
        } catch {
            return { sessions: 0, promptHistory: [], smashed: [], passed: [], updatedAt: Date.now() };
        }
    },

    saveMemory(userId: string, memory: CuratorMemory) {
        if (typeof window === 'undefined') return;
        localStorage.setItem(getStorageKey(userId), JSON.stringify(memory));
    },

    appendPrompt(memory: CuratorMemory, prompt: string): CuratorMemory {
        if (!prompt.trim()) return memory;

        const deduped = [prompt.trim(), ...memory.promptHistory.filter(entry => entry !== prompt.trim())].slice(0, 10);
        return {
            ...memory,
            sessions: memory.sessions + 1,
            promptHistory: deduped,
            updatedAt: Date.now(),
        };
    },

    recordFeedback(memory: CuratorMemory, movie: Movie, feedback: CuratorFeedbackType): CuratorMemory {
        const item = normalizeMemoryItem(movie);
        const filterOut = (entries: CuratorMemoryItem[]) =>
            entries.filter(entry => !(entry.id === item.id && entry.mediaType === item.mediaType));

        let next = {
            ...memory,
            smashed: filterOut(memory.smashed),
            passed: filterOut(memory.passed),
            updatedAt: Date.now(),
        };

        if (feedback === 'smash' || feedback === 'more_like_this') {
            next.smashed = [item, ...next.smashed].slice(0, CURATOR_MEMORY_LIMIT);
        } else {
            next.passed = [item, ...next.passed].slice(0, CURATOR_MEMORY_LIMIT);
        }

        return next;
    },

    parsePrompt(prompt: string, selectedChips: string[] = [], count = 8): CuratorRequest {
        const loweredPrompt = prompt.toLowerCase();
        const tokens = tokenizePrompt(prompt);
        const chipText = selectedChips.join(' ').toLowerCase();
        const combinedText = `${loweredPrompt} ${chipText}`.trim();
        const { moodTags, moodGenreBoosts } = collectMoodTags(combinedText);
        const { modifierTags, modifierGenreBoosts, modifierKeywordBoosts, modifierRuntimeMax } = collectModifierSignals(combinedText);

        const includeGenreIds: number[] = [];
        const includeGenreNames: string[] = [];

        GENRE_KEYWORDS.forEach(genre => {
            if (genre.keywords.some(keyword => combinedText.includes(keyword))) {
                includeGenreIds.push(genre.id);
                includeGenreNames.push(genre.name);
            }
        });

        moodGenreBoosts.forEach(genreId => {
            if (!includeGenreIds.includes(genreId)) {
                includeGenreIds.push(genreId);
                const genreName = GENRE_KEYWORDS.find(genre => genre.id === genreId)?.name;
                if (genreName) includeGenreNames.push(genreName);
            }
        });
        modifierGenreBoosts.forEach(genreId => {
            if (!includeGenreIds.includes(genreId)) {
                includeGenreIds.push(genreId);
                const genreName = GENRE_KEYWORDS.find(genre => genre.id === genreId)?.name;
                if (genreName) includeGenreNames.push(genreName);
            }
        });

        const excludeGenreIds: number[] = [];
        const excludeGenreNames: string[] = [];

        if (combinedText.includes('no anime')) {
            excludeGenreIds.push(16);
            excludeGenreNames.push('Animation');
        }

        if (combinedText.includes('no romance')) {
            excludeGenreIds.push(10749);
            excludeGenreNames.push('Romance');
        }

        let mediaType: CuratorRequest['mediaType'] = 'mixed';
        if (combinedText.includes('movie')) mediaType = 'movie';
        if (combinedText.includes('series') || combinedText.includes('show') || combinedText.includes('episode')) mediaType = 'tv';

        let hiddenGemBias: CuratorRequest['hiddenGemBias'] = 'medium';
        if (combinedText.includes('hidden gem') || combinedText.includes('underrated') || combinedText.includes('niche')) {
            hiddenGemBias = 'high';
        } else if (combinedText.includes('popular') || combinedText.includes('mainstream')) {
            hiddenGemBias = 'low';
        }

        const vibeTags = VIBE_TAGS.filter(tag => combinedText.includes(tag.replace('-', ' ')));
        moodTags.forEach(tag => {
            if (!vibeTags.includes(tag)) vibeTags.push(tag);
        });

        let runtimeBucket: CuratorRequest['runtimeBucket'];
        let maxRuntimeMinutes: number | undefined;
        if (combinedText.includes('under 1 hour') || combinedText.includes('under 60 min') || combinedText.includes('under 60 minutes')) {
            runtimeBucket = 'short';
            maxRuntimeMinutes = 60;
        } else if (combinedText.includes('under 90 min') || combinedText.includes('under 90 mins') || combinedText.includes('under 90 minutes')) {
            runtimeBucket = 'short';
            maxRuntimeMinutes = 90;
        } else if (combinedText.includes('under 2 hour') || combinedText.includes('short')) {
            runtimeBucket = 'short';
            maxRuntimeMinutes = 120;
        }
        if (combinedText.includes('long')) runtimeBucket = 'long';
        if (modifierRuntimeMax) {
            maxRuntimeMinutes = maxRuntimeMinutes ? Math.min(maxRuntimeMinutes, modifierRuntimeMax) : modifierRuntimeMax;
            runtimeBucket = 'short';
        }

        const explicitCount = combinedText.match(/\b(\d{1,2})\b/)?.[1];
        const finalCount = clamp(explicitCount ? parseInt(explicitCount, 10) : count, 4, 15);

        return {
            prompt,
            count: finalCount,
            mediaType,
            seedQueries: extractSeedQueries(prompt),
            includeGenreIds,
            excludeGenreIds,
            includeGenreNames,
            excludeGenreNames,
            vibeTags,
            hiddenGemBias,
            animeAllowed: !combinedText.includes('no anime'),
            runtimeBucket,
            maxRuntimeMinutes,
            keywords: tokens.concat(modifierKeywordBoosts).slice(0, 12),
            moodTags,
            modifierTags,
        };
    },

    async loadUserContext(userId: string): Promise<CuratorUserContext> {
        const [profile, history, ownedPlaylists, likedPlaylists] = await Promise.all([
            ProfileService.getPrivateProfile(userId),
            ProfileService.getUserWatchHistory(userId),
            PlaylistService.getPlaylists(userId),
            PlaylistEngagement.getLikedPlaylists(),
        ]);

        const watchedKeys = new Set<string>();
        const recentHistory = (history || [])
            .slice(0, 6)
            .map((item: any): CuratorUserContext['recentHistory'][number] => {
                const mediaType: 'movie' | 'tv' = item.type === 'tv' ? 'tv' : 'movie';
                if (item.tmdbId) {
                    watchedKeys.add(`${mediaType}:${parseInt(item.tmdbId, 10)}`);
                }
                return {
                    tmdbId: item.tmdbId,
                    type: mediaType,
                    title: item.title,
                };
            })
            .filter(item => item.tmdbId);

        const allPlaylistItems = [...ownedPlaylists, ...likedPlaylists].flatMap(playlist =>
            (playlist.items || []).map(item => item.metadata || {})
        );

        const playlistKeys = new Set<string>();
        const preferredGenreIds = new Map<number, number>();

        allPlaylistItems.forEach((item: any) => {
            if (item.tmdb_id && item.media_type) {
                playlistKeys.add(`${item.media_type}:${parseInt(item.tmdb_id, 10)}`);
            }

            const genreIds: number[] = Array.isArray(item.genre_ids) ? item.genre_ids : [];
            genreIds.forEach((genreId: number) => {
                preferredGenreIds.set(genreId, (preferredGenreIds.get(genreId) || 0) + 1);
            });
        });

        const recentSearches = profile?.recent_searches || [];
        const movieLean = recentHistory.filter(item => item.type === 'movie').length;
        const tvLean = recentHistory.filter(item => item.type === 'tv').length;

        return {
            recentSearches,
            recentHistory,
            ownedPlaylists,
            likedPlaylists,
            watchedKeys,
            playlistKeys,
            preferredGenreIds,
            preferredMediaType: movieLean === tvLean ? 'mixed' : movieLean > tvLean ? 'movie' : 'tv',
        };
    },

    async resolvePromptSeeds(request: CuratorRequest): Promise<Movie[]> {
        if (request.seedQueries.length === 0) return [];

        const seeds = await Promise.all(
            request.seedQueries.map(query =>
                RecommendationBridge.resolveExactSeed(query, request.mediaType)
            )
        );

        return seeds
            .filter((movie): movie is Movie => Boolean(movie?.id));
    },

    async buildCandidatePool(
        request: CuratorRequest,
        context: CuratorUserContext,
        memory: CuratorMemory,
        promptSeeds: Movie[] = []
    ): Promise<Movie[]> {
        const recentSeeds = context.recentHistory.slice(0, 2);
        const recentSearches = context.recentSearches.slice(0, 2);
        const promptSearch = request.prompt.trim();
        const hasExplicitSeed = promptSeeds.length > 0;

        const tasks: Array<Promise<Movie[]>> = [];

        if (!hasExplicitSeed) {
            if (request.mediaType === 'movie') {
                tasks.push(TmdbService.getNowPlaying(), TmdbService.getUpcoming());
            } else if (request.mediaType === 'tv') {
                tasks.push(TmdbService.getAiringToday(), TmdbService.getOnTheAir());
            } else {
                tasks.push(TmdbService.getTrending(), TmdbService.getTopRated());
            }
        }

        if (request.includeGenreIds.length > 0) {
            const discoverTypes = request.mediaType === 'mixed'
                ? ['movie', 'tv'] as const
                : [request.mediaType] as const;

            discoverTypes.forEach(type => {
                tasks.push(TmdbService.discover({
                    mediaType: type,
                    includeGenreIds: request.includeGenreIds,
                    excludeGenreIds: request.excludeGenreIds,
                    sortBy: request.hiddenGemBias === 'high' ? 'vote_average.desc' : 'popularity.desc',
                    maxRuntimeMinutes: request.maxRuntimeMinutes,
                }));
            });
        }

        if (!hasExplicitSeed && promptSearch.length >= 3) {
            tasks.push(TmdbService.search(promptSearch, {
                type: request.mediaType === 'mixed' ? 'multi' : request.mediaType,
            }));
        }

        if (!hasExplicitSeed) {
            recentSearches.forEach(search => {
                tasks.push(TmdbService.search(search, {
                    type: request.mediaType === 'mixed' ? 'multi' : request.mediaType,
                }));
            });

            recentSeeds.forEach(seed => {
                tasks.push(TmdbService.getRecommendations(seed.tmdbId, seed.type));
                tasks.push(TmdbService.getSimilar(seed.tmdbId, seed.type));
            });

            memory.smashed.slice(0, 2).forEach(seed => {
                tasks.push(TmdbService.getRecommendations(seed.id.toString(), seed.mediaType));
            });
        }

        promptSeeds.forEach(seed => {
            tasks.push(TmdbService.getRecommendations(seed.id.toString(), seed.mediaType || 'movie'));
            tasks.push(TmdbService.getSimilar(seed.id.toString(), seed.mediaType || 'movie'));
        });

        const externalSeedResults = hasExplicitSeed
            ? await Promise.all(
                promptSeeds.map(seed => RecommendationBridge.getTasteDiveMatches(seed, request.mediaType))
            )
            : [];

        const settled = await Promise.allSettled(tasks);
        const merged = settled
            .flatMap(result => (result.status === 'fulfilled' ? result.value : []))
            .concat(externalSeedResults.flat())
            .filter(movie => movie.id && movie.title);

        return dedupeMovies(merged).filter(movie => {
            const key = toCandidateKey(movie);
            return !context.playlistKeys.has(key);
        });
    },

    rankCandidates(
        candidates: Movie[],
        request: CuratorRequest,
        context: CuratorUserContext,
        memory: CuratorMemory,
        promptSeeds: Movie[] = []
    ): RankedCuratorMovie[] {
        const smashedGenreIds = memory.smashed.flatMap(item => item.genreIds);
        const passedGenreIds = memory.passed.flatMap(item => item.genreIds);
        const smashedKeys = new Set(memory.smashed.map(item => `${item.mediaType}:${item.id}`));
        const passedKeys = new Set(memory.passed.map(item => `${item.mediaType}:${item.id}`));
        const promptSeedKeys = new Set(promptSeeds.map(seed => toCandidateKey(seed)));
        const promptSeedGenreIds = promptSeeds.flatMap(seed => seed.genreIds || []);
        const promptSeedKeywords = promptSeeds.flatMap(seed => tokenizePrompt(seed.title || ''));
        const hasExplicitSeed = request.seedQueries.length > 0;

        return candidates
            .filter(movie => {
                const key = toCandidateKey(movie);
                return !smashedKeys.has(key) && !passedKeys.has(key) && !promptSeedKeys.has(key);
            })
            .map(movie => {
                let score = 0;
                const reasons: string[] = [];
                const genreIds = movie.genreIds || [];
                const key = toCandidateKey(movie);

                const promptGenreOverlap = overlapCount(genreIds, request.includeGenreIds);
                if (promptGenreOverlap > 0) {
                    score += promptGenreOverlap * 2.2;
                    reasons.push(`matches your ${request.includeGenreNames.slice(0, 2).join(' / ')} ask`);
                }

                const preferredGenreScore = genreIds.reduce(
                    (sum, genreId) => sum + (context.preferredGenreIds.get(genreId) || 0),
                    0
                );
                if (preferredGenreScore > 0) {
                    score += Math.min(preferredGenreScore / 3, 4) * (hasExplicitSeed ? 0.45 : 1);
                    reasons.push('aligns with genres from your playlists');
                }

                const promptSeedOverlap = overlapCount(genreIds, promptSeedGenreIds);
                if (promptSeedOverlap > 0) {
                    score += promptSeedOverlap * 3.2;
                    reasons.push('close to the title or vibe you asked for');
                }

                const moodOverlap = overlapCount(
                    genreIds,
                    request.moodTags.flatMap(tag => MOOD_KEYWORDS.find(mood => mood.tag === tag)?.genreBoosts || [])
                );
                if (moodOverlap > 0) {
                    score += moodOverlap * 1.9;
                    reasons.push('fits the mood or aesthetic you asked for');
                }

                const modifierOverlap = overlapCount(
                    genreIds,
                    request.modifierTags.flatMap(tag => MODIFIER_KEYWORDS.find(modifier => modifier.tag === tag)?.genreBoosts || [])
                );
                if (modifierOverlap > 0) {
                    score += modifierOverlap * 2.2;
                    reasons.push('leans into the twist you added to the seed');
                }

                const smashedOverlap = overlapCount(genreIds, smashedGenreIds);
                if (smashedOverlap > 0) {
                    score += smashedOverlap * 1.8;
                    reasons.push('feels close to titles you smashed');
                }

                const passedOverlap = overlapCount(genreIds, passedGenreIds);
                if (passedOverlap > 0) {
                    score -= passedOverlap * 1.9;
                }

                if (request.mediaType !== 'mixed') {
                    if (movie.mediaType === request.mediaType) {
                        score += 1.5;
                    } else {
                        score -= 2.5;
                    }
                } else if (context.preferredMediaType !== 'mixed' && movie.mediaType === context.preferredMediaType) {
                    score += 0.8;
                }

                if (!request.animeAllowed && genreIds.includes(16)) {
                    score -= 4;
                }

                if (request.excludeGenreIds.some(genreId => genreIds.includes(genreId))) {
                    score -= 5;
                }

                const keywordHits = keywordMatchScore(
                    movie,
                    request.keywords.concat(promptSeedKeywords, context.recentSearches.map(search => search.toLowerCase()))
                );
                if (keywordHits > 0) {
                    score += Math.min(keywordHits, 4) * (hasExplicitSeed ? 1.8 : 1.1);
                    reasons.push(hasExplicitSeed ? 'echoes the title you referenced' : 'echoes your recent searches or prompt');
                }

                if (context.watchedKeys.has(key)) {
                    score -= 2.8;
                } else {
                    score += 1.2;
                    reasons.push('not already in your recent watch flow');
                }

                const popularity = movie.popularity || 0;
                if (request.hiddenGemBias === 'high') {
                    score += popularity < 80 ? 1.4 : -0.6;
                    if (popularity < 80) reasons.push('leans more hidden than mainstream');
                } else if (request.hiddenGemBias === 'low') {
                    score += popularity > 120 ? 1.2 : 0;
                }

                if (request.maxRuntimeMinutes) {
                    score += request.maxRuntimeMinutes <= 60 ? 0.8 : 0.4;
                    if (request.modifierTags.includes('shorter')) {
                        reasons.push('keeps the time commitment tighter');
                    }
                }

                score += clamp(movie.match / 25, 0, 4);

                return {
                    ...movie,
                    curatorScore: score,
                    curatorReasons: reasons.slice(0, 3),
                };
            })
            .sort((a, b) => b.curatorScore - a.curatorScore);
    },

    async generatePlaylistDraft(
        prompt: string,
        selectedChips: string[],
        context: CuratorUserContext,
        memory: CuratorMemory,
        variant = 0
    ): Promise<CuratorPlaylistDraft> {
        const request = this.parsePrompt(prompt, selectedChips);
        const promptSeeds = await this.resolvePromptSeeds(request);
        const candidates = await this.buildCandidatePool(request, context, memory, promptSeeds);
        const ranked = this.rankCandidates(candidates, request, context, memory, promptSeeds)
            .map(candidate => ({
                ...candidate,
                curatorScore: candidate.curatorScore + stableVariantJitter(candidate.id, variant),
            }))
            .sort((a, b) => b.curatorScore - a.curatorScore);

        const usedGenreIds = new Map<number, number>();
        const items: RankedCuratorMovie[] = [];

        for (const candidate of ranked) {
            const genreIds = candidate.genreIds || [];
            const repeatedGenres = genreIds.filter(id => (usedGenreIds.get(id) || 0) >= 3).length;
            if (repeatedGenres >= 2) continue;

            items.push(candidate);
            genreIds.forEach(id => usedGenreIds.set(id, (usedGenreIds.get(id) || 0) + 1));

            if (items.length >= request.count) break;
        }

        return {
            title: buildDraftTitle(request),
            summary: buildDraftSummary(request, items.length),
            items,
        };
    },

    async saveGeneratedPlaylist(
        userId: string,
        draft: CuratorPlaylistDraft,
        isPublic: boolean
    ) {
        const playlist = await PlaylistService.createPlaylist(
            userId,
            draft.title,
            draft.summary,
            isPublic
        );

        await Promise.all(
            draft.items.map(item => PlaylistService.addToPlaylist(playlist.id, item))
        );

        return playlist;
    },
};
