type HeadersLike = Record<string, string | undefined>;

type RecommendationSecurityEnv = {
    URL?: string;
    DEPLOY_PRIME_URL?: string;
    RECOMMENDATION_BRIDGE_ALLOWED_ORIGIN?: string;
};

type RecommendationSecurityInput = {
    headers: HeadersLike;
    ip?: string;
    env: RecommendationSecurityEnv;
};

type RecommendationSecurityResult =
    | { ok: true }
    | { ok: false; status: number; error: string };

type RateLimitBucket = {
    count: number;
    resetAt: number;
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const rateLimitBuckets = new Map<string, RateLimitBucket>();

const getHeader = (headers: HeadersLike, name: string) => {
    const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
    return match?.[1];
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const normalizeOrigin = (value?: string | null) => {
    if (!value) return null;

    try {
        return trimTrailingSlash(new URL(value).origin.toLowerCase());
    } catch {
        return null;
    }
};

const deriveOriginFromReferer = (referer?: string) => normalizeOrigin(referer);

const collectAllowedOrigins = (env: RecommendationSecurityEnv) => {
    const origins = new Set<string>();

    const candidates = [
        env.RECOMMENDATION_BRIDGE_ALLOWED_ORIGIN,
        env.URL,
        env.DEPLOY_PRIME_URL,
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ];

    candidates
        .map(candidate => normalizeOrigin(candidate))
        .filter((candidate): candidate is string => Boolean(candidate))
        .forEach(candidate => origins.add(candidate));

    return origins;
};

const isAllowedFetchSite = (value?: string) => {
    if (!value) return true;
    return value === 'same-origin' || value === 'same-site' || value === 'none';
};

const getClientIdentifier = ({ headers, ip }: RecommendationSecurityInput) => {
    const forwardedFor = getHeader(headers, 'x-forwarded-for');
    const forwardedIp = forwardedFor?.split(',')[0]?.trim();
    const cfIp = getHeader(headers, 'cf-connecting-ip');
    const netlifyIp = getHeader(headers, 'x-nf-client-connection-ip');

    return forwardedIp || cfIp || netlifyIp || ip || 'unknown';
};

const checkRateLimit = (identifier: string) => {
    const now = Date.now();
    const bucket = rateLimitBuckets.get(identifier);

    if (!bucket || now >= bucket.resetAt) {
        rateLimitBuckets.set(identifier, {
            count: 1,
            resetAt: now + RATE_LIMIT_WINDOW_MS,
        });
        return true;
    }

    if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
        return false;
    }

    bucket.count += 1;
    return true;
};

export const verifyRecommendationBridgeAccess = (
    input: RecommendationSecurityInput
): RecommendationSecurityResult => {
    const secFetchSite = getHeader(input.headers, 'sec-fetch-site');
    if (!isAllowedFetchSite(secFetchSite)) {
        return { ok: false, status: 403, error: 'Cross-site requests are not allowed' };
    }

    const allowedOrigins = collectAllowedOrigins(input.env);
    const originHeader = normalizeOrigin(getHeader(input.headers, 'origin'));
    const refererOrigin = deriveOriginFromReferer(getHeader(input.headers, 'referer'));
    const requestOrigin = originHeader || refererOrigin;

    if (allowedOrigins.size > 0 && (!requestOrigin || !allowedOrigins.has(requestOrigin))) {
        return { ok: false, status: 403, error: 'Untrusted request origin' };
    }

    if (!checkRateLimit(getClientIdentifier(input))) {
        return { ok: false, status: 429, error: 'Too many recommendation requests' };
    }

    return { ok: true };
};
