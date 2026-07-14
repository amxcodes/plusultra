import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, ExternalLink, Info, LoaderCircle, ShieldCheck } from 'lucide-react';
import { useToast } from '../lib/ToastContext';
import { buildStreamDownloadCandidates, type StreamDownloadCandidate } from '../lib/streamDownloads';
import { DirectPlaybackSource, MediaType, Provider } from '../lib/playerProviders';
import { withTrustedPopup } from '../lib/popupGuard';

interface StreamDownloadPanelProps {
    providerId: Provider;
    providerName: string;
    tmdbId: string;
    mediaType: MediaType;
    season?: number;
    episode?: number;
    desktopCaptureKey?: string | null;
    currentEmbedUrl?: string;
    directSources?: DirectPlaybackSource[];
    title?: string;
    imageUrl?: string;
    backdropUrl?: string;
    description?: string;
    year?: number;
    genre?: string[];
}

export const StreamDownloadPanel: React.FC<StreamDownloadPanelProps> = ({
    providerId,
    providerName,
    tmdbId,
    mediaType,
    season,
    episode,
    title,
    imageUrl,
    backdropUrl,
    description,
    year,
    genre = [],
    desktopCaptureKey,
    currentEmbedUrl,
    directSources = [],
}) => {
    const { success, error, info } = useToast();
    const [desktopCapturedMedia, setDesktopCapturedMedia] = useState<DesktopCapturedMedia[]>([]);
    const [documentSources, setDocumentSources] = useState<Array<{ url: string; sourceType: 'mp4' | 'webm' | 'mkv' }>>([]);
    const [verifyingCandidateId, setVerifyingCandidateId] = useState<string | null>(null);
    const candidates = buildStreamDownloadCandidates({
        providerId,
        providerName,
        tmdbId,
        mediaType,
        season,
        episode,
        currentEmbedUrl,
        directSources,
    });

    useEffect(() => {
        if (!window.desktop?.isDesktop) {
            return;
        }
        if (!desktopCaptureKey) {
            setDesktopCapturedMedia([]);
            return;
        }

        let active = true;
        setDesktopCapturedMedia([]);

        window.desktop.getCapturedMedia(desktopCaptureKey).then((items) => {
            if (active) {
                setDesktopCapturedMedia(items);
            }
        }).catch(() => {
            // Ignore bridge errors in the web build.
        });

        const unsubscribe = window.desktop.onCapturedMedia((item) => {
            if (item.captureKey !== desktopCaptureKey) {
                return;
            }

            setDesktopCapturedMedia((current) => {
                if (current.some((entry) => entry.url === item.url)) {
                    return current;
                }

                return [item, ...current].slice(0, 20);
            });
        });
        const unsubscribeReset = window.desktop.onCapturedMediaReset((payload) => {
            if (payload.captureKey === desktopCaptureKey) {
                setDesktopCapturedMedia([]);
            }
        });

        return () => {
            active = false;
            unsubscribe();
            unsubscribeReset();
        };
    }, [desktopCaptureKey]);

    useEffect(() => {
        if (!window.desktop?.isDesktop || !currentEmbedUrl) {
            setDocumentSources([]);
            return;
        }

        let active = true;
        void window.desktop.discoverDownloadSources(currentEmbedUrl).then((sources) => {
            if (active) setDocumentSources(sources);
        });
        return () => {
            active = false;
        };
    }, [currentEmbedUrl]);

    const desktopCandidates = useMemo<StreamDownloadCandidate[]>(() => (
        desktopCapturedMedia.map((item) => ({
            id: `desktop:${item.url}`,
            label: 'Captured desktop stream',
            url: item.url,
            kind: item.url.toLowerCase().includes('.m3u8') ? 'playlist' : 'video',
            source: 'detected' as const,
            serverId: 'desktop-capture',
            serverLabel: 'Desktop capture',
            requiredHeaders: item.requestHeaders,
            note: `Observed by the active desktop playback session as ${item.resourceType}`,
        }))
    ), [desktopCapturedMedia]);

    const documentCandidates = useMemo<StreamDownloadCandidate[]>(() => (
        documentSources.map((source, index) => ({
            id: `document:${source.url}`,
            label: `Provider direct file${documentSources.length > 1 ? ` ${index + 1}` : ''}`,
            url: source.url,
            kind: 'video' as const,
            source: 'detected' as const,
            serverId: 'provider-document',
            serverLabel: providerName,
            note: `Discovered in the ${providerName} provider document and awaiting verification.`,
        }))
    ), [documentSources, providerName]);

    const getCandidateRank = (candidate: StreamDownloadCandidate) => {
        const url = candidate.url.toLowerCase();

        if (candidate.kind === 'video' && candidate.source === 'detected' && candidate.label === 'Captured desktop stream') {
            return 0;
        }

        if (candidate.kind === 'video' && candidate.source === 'detected') {
            return 1;
        }

        if (candidate.kind === 'video') {
            return 2;
        }

        if (candidate.kind === 'playlist') {
            return url.includes('.m3u8') ? 3 : 4;
        }

        return 5;
    };

    const allCandidates = useMemo(() => (
        [...desktopCandidates, ...documentCandidates, ...candidates]
            .filter((candidate, index, list) => (
                list.findIndex((entry) => entry.url === candidate.url) === index
            ))
            .sort((left, right) => getCandidateRank(left) - getCandidateRank(right))
    ), [desktopCandidates, documentCandidates, candidates]);

    const canSaveOffline = (candidate: StreamDownloadCandidate) => {
        if (!window.desktop?.isDesktop) {
            return false;
        }

        return candidate.kind === 'video';
    };

    const handleOpen = (url: string) => {
        if (window.desktop?.isDesktop) {
            void window.desktop.openExternal(url);
            info('Opened download target outside the app');
            return;
        }

        withTrustedPopup(() => {
            window.open(url, '_blank', 'noopener,noreferrer');
        });
        info('Opened download target in a new tab');
    };

    const handleOfflineDownload = async (candidate: StreamDownloadCandidate) => {
        if (!window.desktop || !title || !imageUrl) {
            error('Offline download metadata is incomplete.');
            return;
        }

        setVerifyingCandidateId(candidate.id);
        try {
            const probe = await window.desktop.probePlaybackSource({
                url: candidate.url,
                requiredHeaders: candidate.requiredHeaders,
            });
            if (!probe.ok || !probe.finalUrl) {
                error(probe.message || 'This source is not a direct media file.');
                return;
            }

            const result = await window.desktop.downloadOfflineMedia({
                title,
                tmdbId: Number(tmdbId),
                mediaType,
                sourceUrl: probe.finalUrl,
                imageUrl,
                backdropUrl,
                description,
                year,
                genre,
                season,
                episode,
                providerId,
                providerName,
            });
            if (!result.ok) {
                error(result.message || 'Failed to start offline download.');
                return;
            }

            success('Verified download started');
        } catch {
            error('Could not verify this download source.');
        } finally {
            setVerifyingCandidateId(null);
        }
    };

    return (
        <div className="flex min-w-0 flex-col gap-3 rounded-[18px] border border-white/10 bg-white/[0.045] p-3">
            <div className="flex items-start gap-2">
                <div className="mt-0.5 text-white/55">
                    <ShieldCheck size={15} />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">Verified download sources</p>
                    <p className="text-[11px] leading-4 text-white/42">
                        Direct files are checked before saving. Player pages and adaptive manifests stay out of your offline library.
                    </p>
                </div>
            </div>

            {allCandidates.length === 0 ? (
                <div className="rounded-[14px] border border-dashed border-white/10 bg-black/20 p-3">
                    <div className="flex items-start gap-2 text-white/46">
                        <Info size={14} className="mt-0.5" />
                        <p className="text-xs leading-relaxed">
                            No downloadable stream URL is visible for this title yet. Start playback on the current
                            server, then reopen this menu after the stream begins loading.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex max-h-[min(42vh,360px)] flex-col gap-2 overflow-y-auto pr-1 studio-scrollbar">
                    {allCandidates.map(candidate => (
                        <div key={candidate.id} className="min-w-0 rounded-[14px] border border-white/10 bg-black/20 p-3">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="text-xs font-semibold text-white">{candidate.label}</span>
                                {canSaveOffline(candidate) && getCandidateRank(candidate) === 0 && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold bg-white/10 text-zinc-200">
                                        Recommended
                                    </span>
                                )}
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold ${candidate.source === 'detected'
                                        ? 'bg-emerald-500/15 text-emerald-300'
                                        : 'bg-amber-500/15 text-amber-300'
                                    }`}>
                                    {candidate.source}
                                </span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold bg-white/10 text-zinc-400">
                                    {candidate.kind.replace('_', ' ')}
                                </span>
                            </div>

                            <p className="truncate text-[11px] text-white/38" title={candidate.url}>{candidate.url}</p>
                            {candidate.note && (
                                <p className="text-[11px] text-zinc-600 mt-1">{candidate.note}</p>
                            )}
                            {candidate.kind === 'playlist' && (
                                <p className="text-[11px] text-zinc-600 mt-1">
                                    Playlist links usually need a stream-aware downloader. Prefer a direct video link for offline saves.
                                </p>
                            )}

                            <div className="mt-3 flex items-center gap-2">
                                {canSaveOffline(candidate) ? (
                                    <button
                                        onClick={() => void handleOfflineDownload(candidate)}
                                        disabled={verifyingCandidateId === candidate.id}
                                        className="inline-flex h-9 items-center gap-2 rounded-full border border-white/16 bg-white px-3.5 text-[11px] font-bold text-black transition-transform hover:scale-[1.02] disabled:cursor-wait disabled:opacity-60"
                                    >
                                        {verifyingCandidateId === candidate.id ? <LoaderCircle size={13} className="animate-spin" /> : <Download size={13} />}
                                        {verifyingCandidateId === candidate.id ? 'Checking source' : 'Save offline'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleOpen(candidate.url)}
                                        className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 text-[11px] font-bold text-white/88 transition-colors hover:bg-white/10"
                                    >
                                        <ExternalLink size={12} />
                                        {candidate.kind === 'download_page' ? 'Open Page' : 'Open Link'}
                                    </button>
                                )}
                                {canSaveOffline(candidate) && <span className="inline-flex items-center gap-1 text-[10px] text-white/38"><CheckCircle2 size={12} /> Direct only</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
