type BridgeRequestBody =
    | { action: 'resolve-seed'; query: string; preferredType?: 'movie' | 'tv' | 'mixed' }
    | { action: 'similar'; seedTitle: string; preferredType?: 'movie' | 'tv' | 'mixed'; seedMediaType?: 'movie' | 'tv' };

type EnvLike = {
    TASTEDIVE_API_KEY?: string;
    OMDB_API_KEY?: string;
};

const json = (status: number, body: unknown) => ({
    status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});

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

const mapTasteDiveType = (type?: string) => {
    if (type === 'movie') return 'movie';
    if (type === 'show') return 'tv';
    return 'mixed';
};

const isBridgeRequestBody = (value: unknown): value is BridgeRequestBody => {
    if (!value || typeof value !== 'object') return false;

    const candidate = value as Record<string, unknown>;
    const preferredType = candidate.preferredType;
    const seedMediaType = candidate.seedMediaType;

    const hasValidPreferredType =
        preferredType === undefined || preferredType === 'movie' || preferredType === 'tv' || preferredType === 'mixed';
    const hasValidSeedMediaType =
        seedMediaType === undefined || seedMediaType === 'movie' || seedMediaType === 'tv';

    if (!hasValidPreferredType || !hasValidSeedMediaType) {
        return false;
    }

    if (candidate.action === 'resolve-seed') {
        return typeof candidate.query === 'string' && candidate.query.trim().length > 0 && candidate.query.length <= 160;
    }

    if (candidate.action === 'similar') {
        return typeof candidate.seedTitle === 'string'
            && candidate.seedTitle.trim().length > 0
            && candidate.seedTitle.length <= 160;
    }

    return false;
};

export async function handleRecommendationBridge(requestBody: unknown, env: EnvLike) {
    if (!isBridgeRequestBody(requestBody)) {
        return json(400, { error: 'Invalid recommendation request' });
    }

    if (requestBody.action === 'resolve-seed') {
        if (!env.OMDB_API_KEY) {
            return json(200, { item: null });
        }

        const typeParam =
            requestBody.preferredType === 'tv'
                ? 'series'
                : requestBody.preferredType === 'movie'
                    ? 'movie'
                    : '';

        const params = new URLSearchParams({
            apikey: env.OMDB_API_KEY,
            s: requestBody.query,
            ...(typeParam ? { type: typeParam } : {}),
        });

        const response = await fetch(`https://www.omdbapi.com/?${params.toString()}`);
        const data = await response.json();
        const items = Array.isArray(data?.Search) ? data.Search : [];

        const best = [...items]
            .sort((left: any, right: any) => scoreTitleMatch(requestBody.query, right.Title || '') - scoreTitleMatch(requestBody.query, left.Title || ''))[0] || null;

        return json(200, { item: best });
    }

    if (!env.TASTEDIVE_API_KEY) {
        return json(200, { results: [] });
    }

    const preferredType = requestBody.preferredType || requestBody.seedMediaType || 'movie';
    const type =
        preferredType === 'tv'
            ? 'show'
            : preferredType === 'movie'
                ? 'movie'
                : requestBody.seedMediaType === 'tv'
                    ? 'show'
                    : 'movie';

    const params = new URLSearchParams({
        q: `${type}:${requestBody.seedTitle}`,
        type,
        limit: '8',
        info: '0',
        k: env.TASTEDIVE_API_KEY,
    });

    const response = await fetch(`https://tastedive.com/api/similar?${params.toString()}`);
    const data = await response.json();
    const results = ((data?.Similar?.Results || []) as Array<{ Name?: string; Type?: string }>)
        .filter(result => result.Name)
        .slice(0, 6)
        .map(result => ({
            name: result.Name,
            type: mapTasteDiveType(result.Type),
        }));

    return json(200, { results });
}
