import { DirectPlaybackSource, MediaType, Provider } from './playerProviders';

export type DownloadCandidateKind = 'playlist' | 'video' | 'download_page';
export type DownloadCandidateSource = 'detected' | 'generated';

export interface StreamDownloadCandidate {
    id: string;
    label: string;
    url: string;
    kind: DownloadCandidateKind;
    source: DownloadCandidateSource;
    serverId?: string;
    serverLabel?: string;
    qualityLabel?: string;
    requiredHeaders?: Record<string, string>;
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
        id: `${candidate.kind}:${candidate.source}:${candidate.serverId || candidate.serverLabel || 'auto'}:${candidate.url}`,
    });
};

const deriveServerMetadata = (rawUrl: string, providerName: string) => {
    try {
        const parsed = new URL(rawUrl);
        const search = parsed.searchParams;
        const pathname = parsed.pathname.toLowerCase();
        const host = parsed.hostname.replace(/^www\./, '');

        const serverToken =
            search.get('server') ||
            search.get('server_id') ||
            search.get('serverid') ||
            search.get('source') ||
            search.get('name');

        const qualityToken =
            search.get('quality') ||
            search.get('label') ||
            search.get('res') ||
            search.get('resolution');

        let serverLabel = serverToken ? `${providerName} ${serverToken}` : host;
        if (pathname.includes('1080')) serverLabel = `${serverLabel} 1080p`;
        if (pathname.includes('720')) serverLabel = `${serverLabel} 720p`;

        return {
            serverId: serverToken || host,
            serverLabel,
            qualityLabel: qualityToken || (pathname.includes('1080') ? '1080p' : pathname.includes('720') ? '720p' : undefined),
        };
    } catch {
        return {
            serverId: providerName.toLowerCase().replace(/\s+/g, '-'),
            serverLabel: providerName,
            qualityLabel: undefined,
        };
    }
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
        const metadata = deriveServerMetadata(decodedValue, 'Detected');
        pushCandidate(candidates, dedupeUrls, {
            label: metadata.serverLabel || (kind === 'playlist' ? 'Detected HLS playlist' : 'Detected direct video'),
            url: decodedValue,
            kind,
            source: 'detected',
            serverId: metadata.serverId,
            serverLabel: metadata.serverLabel,
            qualityLabel: metadata.qualityLabel,
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
        const metadata = deriveServerMetadata(source.src, providerName);
        pushCandidate(candidates, dedupeUrls, {
            label: directSources.length > 1 ? `${metadata.serverLabel || 'Direct source'} ${index + 1}` : metadata.serverLabel || 'Direct playback source',
            url: source.src,
            kind,
            source: 'detected',
            serverId: metadata.serverId,
            serverLabel: metadata.serverLabel,
            qualityLabel: metadata.qualityLabel,
            note: `Exposed directly by ${providerName}`,
        });
        inspectUrl(source.src, candidates, dedupeUrls, ['direct-source']);
    });

    if (currentEmbedUrl) {
        inspectUrl(currentEmbedUrl, candidates, dedupeUrls, ['embed-url']);

        pushCandidate(candidates, dedupeUrls, {
            label: `${providerName} provider page`,
            url: currentEmbedUrl,
            kind: 'download_page',
            source: 'generated',
            serverId: `${providerId}-provider-page`,
            serverLabel: `${providerName} provider page`,
            note: 'Fallback entrypoint for providers that reveal stream links only after the page loads.',
        });
    }

    return candidates;
};
