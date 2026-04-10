import { Movie } from '../types';
import { isLikelyNetworkError } from '../lib/network';
import { TmdbService } from './tmdb';

const BRIDGE_ENDPOINT = import.meta.env.DEV ? '/api/recommendation-bridge' : '/.netlify/functions/recommendation-bridge';

type BridgeMediaType = 'movie' | 'tv' | 'mixed';

type OmdbSearchItem = {
    Title: string;
    Year?: string;
    Type?: 'movie' | 'series' | 'episode';
    imdbID?: string;
};

type TasteDiveResult = {
    Name?: string;
    Type?: string;
};

const normalizeCompact = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const normalizeWords = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const tokenize = (value: string) => normalizeWords(value).split(' ').filter(Boolean);

const scoreTitleMatch = (query: string, title: string) => {
    const compactQuery = normalizeCompact(query);
    const compactTitle = normalizeCompact(title);
    const normalizedQuery = normalizeWords(query);
    const normalizedTitle = normalizeWords(title);
    const queryTokens = tokenize(query);
    const titleTokens = tokenize(title);
    const titleTokenSet = new Set(titleTokens);

    let score = 0;

    if (compactTitle === compactQuery) score += 70;
    if (normalizedTitle === normalizedQuery) score += 40;
    if (compactTitle.startsWith(compactQuery)) score += 18;
    if (normalizedTitle.startsWith(normalizedQuery)) score += 12;
    if (compactTitle.includes(compactQuery)) score += 6;

    if (queryTokens.length > 0) {
        const overlap = queryTokens.filter(token => titleTokenSet.has(token)).length;
        score += (overlap / queryTokens.length) * 20;
    }

    const documentaryWords = ['documentary', 'championship', 'world', 'road to', 'biography'];
    const queryLooksDocumentary = documentaryWords.some(word => normalizedQuery.includes(word));
    const titleLooksDocumentary = documentaryWords.some(word => normalizedTitle.includes(word));

    if (!queryLooksDocumentary && titleLooksDocumentary) {
        score -= 16;
    }

    const queryLengthGap = compactTitle.length - compactQuery.length;
    if (queryLengthGap > 12 && compactTitle.includes(compactQuery) && compactTitle !== compactQuery) {
        score -= 10;
    }

    return score;
};

const scoreTmdbCandidate = (query: string, movie: Movie, preferredType: BridgeMediaType, year?: number) => {
    let score = scoreTitleMatch(query, movie.title || '');

    if (preferredType !== 'mixed') {
        score += movie.mediaType === preferredType ? 10 : -8;
    }

    if (year && movie.year) {
        const yearDistance = Math.abs(movie.year - year);
        score += yearDistance === 0 ? 8 : yearDistance <= 1 ? 4 : -2;
    }

    score += Math.min((movie.popularity || 0) / 40, 8);
    score += Math.min((movie.match || 0) / 20, 4);

    return score;
};

const mapOmdbTypeToMediaType = (type?: string): BridgeMediaType => {
    if (type === 'movie') return 'movie';
    if (type === 'series') return 'tv';
    return 'mixed';
};

const findBestTmdbMatch = (query: string, results: Movie[], preferredType: BridgeMediaType, year?: number) => {
    return [...results]
        .sort((left, right) => (
            scoreTmdbCandidate(query, right, preferredType, year) -
            scoreTmdbCandidate(query, left, preferredType, year)
        ))[0] || null;
};

const mapTasteDiveType = (type?: string): BridgeMediaType => {
    if (type === 'movie') return 'movie';
    if (type === 'show') return 'tv';
    return 'mixed';
};

const bridgeRequest = async <TBody extends Record<string, unknown>, TResponse>(body: TBody): Promise<TResponse | null> => {
    try {
        const response = await fetch(BRIDGE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'plusultra-web',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) return null;
        return await response.json() as TResponse;
    } catch (error) {
        if (!isLikelyNetworkError(error)) {
            console.error('Recommendation bridge request failed:', error);
        }
        return null;
    }
};

export const RecommendationBridge = {
    hasTasteDive() {
        return true;
    },

    hasOmdb() {
        return true;
    },

    async resolveExactSeed(query: string, preferredType: BridgeMediaType): Promise<Movie | null> {
        const tmdbSearchType = preferredType === 'mixed' ? 'multi' : preferredType;
        const omdbResponse = await bridgeRequest<
            { action: 'resolve-seed'; query: string; preferredType: BridgeMediaType },
            { item: OmdbSearchItem | null }
        >({
            action: 'resolve-seed',
            query,
            preferredType,
        });

        const omdbMatch = omdbResponse?.item || null;
        const omdbYear = omdbMatch?.Year ? parseInt(omdbMatch.Year.slice(0, 4), 10) : undefined;
        const omdbPreferredType = omdbMatch ? mapOmdbTypeToMediaType(omdbMatch.Type) : preferredType;

        const queries = [query];
        if (omdbMatch?.Title && normalizeWords(omdbMatch.Title) !== normalizeWords(query)) {
            queries.unshift(omdbMatch.Title);
        }

        const searchResults = await Promise.all(
            queries.map(searchQuery => TmdbService.search(searchQuery, { type: tmdbSearchType }))
        );

        const candidates = searchResults.flat();
        const best = findBestTmdbMatch(
            omdbMatch?.Title || query,
            candidates,
            omdbPreferredType,
            omdbYear
        );

        return best;
    },

    async getTasteDiveMatches(seed: Movie, preferredType: BridgeMediaType): Promise<Movie[]> {
        try {
            const response = await bridgeRequest<
                { action: 'similar'; seedTitle: string; preferredType: BridgeMediaType; seedMediaType?: 'movie' | 'tv' },
                { results: Array<{ name?: string; type?: string }> }
            >({
                action: 'similar',
                seedTitle: seed.title,
                preferredType,
                seedMediaType: seed.mediaType,
            });

            const results = (response?.results || [])
                .filter(result => result.name)
                .slice(0, 6);

            const resolved = await Promise.all(
                results.map(async result => {
                    const resultType = mapTasteDiveType(result.type) === 'mixed' ? preferredType : mapTasteDiveType(result.type);
                    return this.resolveExactSeed(result.name || '', resultType === 'mixed' ? preferredType : resultType);
                })
            );

            return resolved.filter((movie): movie is Movie => Boolean(movie?.id));
        } catch (error) {
            if (!isLikelyNetworkError(error)) {
                console.error('TasteDive lookup failed:', error);
            }
            return [];
        }
    },
};
