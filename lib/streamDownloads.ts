import { DirectPlaybackSource, MediaType, Provider } from './playerProviders';

export type DownloadCandidateKind = 'playlist' | 'video' | 'download_page';
export type DownloadCandidateSource = 'detected' | 'generated';

export interface StreamDownloadCandidate {
    id: string;
    label: string;
    url: string;
    kind: DownloadCandidateKind;
    source: DownloadCandidateSource;
    note?: string;
}

interface BuildStreamDownloadCandidatesOptions {
    providerId: Provider;
    providerName: string;
    tmdbId: string;
    mediaType: MediaType;
    season?: number;
    episode?: number;
    currentEmbedUrl?: string;
    directSources?: DirectPlaybackSource[];
}

const MAX_DECODE_DEPTH = 4;
const EMBED_PARAM_KEYS = new Set([
    'm3u8-proxy',
    'url',
    'src',
    'source',
    'file',
    'playlist',
    'stream',
    'video',
    'hls',
    'manifest',
]);

const decodeRecursively = (value: string) => {
    let current = value;

    for (let index = 0; index < MAX_DECODE_DEPTH; index += 1) {
        try {
            const decoded = decodeURIComponent(current);
            if (decoded === current) {
                return current;
            }
            current = decoded;
        } catch {
            return current;
        }
    }

    return current;
};

const isLikelyMediaUrl = (value: string) => {
    try {
        const url = new URL(value);
        const pathname = url.pathname.toLowerCase();
        return (
            pathname.endsWith('.m3u8') ||
            pathname.endsWith('.mp4') ||
            pathname.endsWith('.mkv') ||
            pathname.endsWith('.webm') ||
            pathname.endsWith('.m4v') ||
            pathname.endsWith('.mpd')
        );
    } catch {
        return false;
    }
};

const pushCandidate = (
    candidates: StreamDownloadCandidate[],
    dedupeUrls: Set<string>,
    candidate: Omit<StreamDownloadCandidate, 'id'>
) => {
    if (!candidate.url || dedupeUrls.has(candidate.url)) return;
    dedupeUrls.add(candidate.url);

    candidates.push({
        ...candidate,
        id: `${candidate.kind}:${candidate.source}:${candidate.url}`,
    });
};

const inspectUrl = (
    value: string,
    candidates: StreamDownloadCandidate[],
    dedupeUrls: Set<string>,
    path: string[] = []
) => {
    const decodedValue = decodeRecursively(value);
    if (isLikelyMediaUrl(decodedValue)) {
        const kind = decodedValue.toLowerCase().includes('.m3u8') ? 'playlist' : 'video';
        pushCandidate(candidates, dedupeUrls, {
            label: kind === 'playlist' ? 'Detected HLS playlist' : 'Detected direct video',
            url: decodedValue,
            kind,
            source: 'detected',
            note: path.length > 0 ? `Found inside ${path.join(' -> ')}` : 'Found in the active playback URL',
        });
    }

    let parsed: URL;
    try {
        parsed = new URL(decodedValue);
    } catch {
        return;
    }

    parsed.searchParams.forEach((paramValue, key) => {
        const decodedParam = decodeRecursively(paramValue);
        if (!EMBED_PARAM_KEYS.has(key) && !decodedParam.startsWith('http')) {
            return;
        }

        inspectUrl(decodedParam, candidates, dedupeUrls, [...path, key]);
    });
};

export const buildStreamDownloadCandidates = ({
    providerId,
    providerName,
    tmdbId,
    mediaType,
    season,
    episode,
    currentEmbedUrl,
    directSources = [],
}: BuildStreamDownloadCandidatesOptions): StreamDownloadCandidate[] => {
    const candidates: StreamDownloadCandidate[] = [];
    const dedupeUrls = new Set<string>();

    directSources.forEach((source, index) => {
        if (!source?.src) return;
        const kind = source.src.toLowerCase().includes('.m3u8') ? 'playlist' : 'video';
        pushCandidate(candidates, dedupeUrls, {
            label: directSources.length > 1 ? `Direct source ${index + 1}` : 'Direct playback source',
            url: source.src,
            kind,
            source: 'detected',
            note: `Exposed directly by ${providerName}`,
        });
        inspectUrl(source.src, candidates, dedupeUrls, ['direct-source']);
    });

    if (currentEmbedUrl) {
        inspectUrl(currentEmbedUrl, candidates, dedupeUrls, ['embed-url']);
    }

    if (providerId === 'rive') {
        const providerDownloadUrl = mediaType === 'movie'
            ? `https://rivestream.org/download?type=movie&id=${tmdbId}`
            : `https://rivestream.org/download?type=tv&id=${tmdbId}&season=${season || 1}&episode=${episode || 1}`;

        pushCandidate(candidates, dedupeUrls, {
            label: 'Rive download page',
            url: providerDownloadUrl,
            kind: 'download_page',
            source: 'generated',
            note: 'Provider-specific fallback generated from TMDB context',
        });
    }

    return candidates;
};
