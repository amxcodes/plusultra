import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Download, ExternalLink, Info } from 'lucide-react';
import { useToast } from '../lib/ToastContext';
import { buildStreamDownloadCandidates, type StreamDownloadCandidate } from '../lib/streamDownloads';
import { DirectPlaybackSource, MediaType, Provider } from '../lib/playerProviders';

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

    const desktopCandidates = useMemo<StreamDownloadCandidate[]>(() => (
        desktopCapturedMedia.map((item) => ({
            id: `desktop:${item.url}`,
            label: 'Captured desktop stream',
            url: item.url,
            kind: item.url.toLowerCase().includes('.m3u8') ? 'playlist' : 'video',
            source: 'detected' as const,
            note: `Observed in Electron network session as ${item.resourceType}`,
        }))
    ), [desktopCapturedMedia]);

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
        [...desktopCandidates, ...candidates]
            .filter((candidate, index, list) => (
                list.findIndex((entry) => entry.url === candidate.url) === index
            ))
            .sort((left, right) => getCandidateRank(left) - getCandidateRank(right))
    ), [desktopCandidates, candidates]);

    const canSaveOffline = (candidate: StreamDownloadCandidate) => {
        if (!window.desktop?.isDesktop) {
            return false;
        }

        return candidate.kind === 'video';
    };

    const handleCopy = async (url: string) => {
        try {
            await navigator.clipboard.writeText(url);
            success('Download link copied');
        } catch {
            error('Failed to copy download link');
        }
    };

    const handleOpen = (url: string) => {
        if (window.desktop?.isDesktop) {
            void window.desktop.openExternal(url);
            info('Opened download target outside the app');
            return;
        }

        window.open(url, '_blank', 'noopener,noreferrer');
        info('Opened download target in a new tab');
    };

    return (
        <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex flex-col gap-3">
            <div className="flex items-start gap-2">
                <div className="mt-0.5 text-zinc-400">
                    <Download size={14} />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">Auto-detected stream links</p>
                    <p className="text-[11px] text-zinc-500">
                        Derived from the active provider URL, direct sources, and current desktop playback session.
                    </p>
                </div>
            </div>

            {allCandidates.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 bg-black/20 p-3">
                    <div className="flex items-start gap-2 text-zinc-400">
                        <Info size={14} className="mt-0.5" />
                        <p className="text-xs leading-relaxed">
                            No downloadable stream URL is visible for this title yet. Start playback on the current
                            server, then reopen this menu after the stream begins loading.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {allCandidates.map(candidate => (
                        <div key={candidate.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
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

                            <p className="text-[11px] text-zinc-500 break-all">{candidate.url}</p>
                            {candidate.note && (
                                <p className="text-[11px] text-zinc-600 mt-1">{candidate.note}</p>
                            )}
                            {candidate.kind === 'playlist' && (
                                <p className="text-[11px] text-zinc-600 mt-1">
                                    Playlist links usually need a stream-aware downloader. Prefer a direct video link for offline saves.
                                </p>
                            )}

                            <div className="mt-3 flex gap-2">
                                <button
                                    onClick={() => handleOpen(candidate.url)}
                                    className="flex-1 flex items-center justify-center gap-2 bg-white text-black hover:bg-zinc-200 py-2 rounded-lg text-xs font-bold transition-colors"
                                >
                                    <ExternalLink size={12} />
                                    {candidate.kind === 'download_page' ? 'Open Page' : 'Open Link'}
                                </button>
                                <button
                                    onClick={() => void handleCopy(candidate.url)}
                                    className="px-3 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white py-2 rounded-lg text-xs font-bold transition-colors"
                                >
                                    <Copy size={12} />
                                    Copy
                                </button>
                                {canSaveOffline(candidate) && (
                                    <button
                                        onClick={() => {
                                            if (!window.desktop || !title || !imageUrl) {
                                                error('Offline download metadata is incomplete.');
                                                return;
                                            }

                                            void window.desktop.downloadOfflineMedia({
                                                title,
                                                tmdbId: Number(tmdbId),
                                                mediaType,
                                                sourceUrl: candidate.url,
                                                imageUrl,
                                                backdropUrl,
                                                description,
                                                year,
                                                genre,
                                                season,
                                                episode,
                                                providerId,
                                                providerName,
                                            }).then((result) => {
                                                if (!result.ok) {
                                                    error(result.message || 'Failed to start offline download.');
                                                    return;
                                                }

                                                success('Offline download started');
                                            }).catch(() => {
                                                error('Failed to start offline download.');
                                            });
                                        }}
                                        className="px-3 flex items-center justify-center gap-2 bg-emerald-500/15 hover:bg-emerald-500/20 text-emerald-100 py-2 rounded-lg text-xs font-bold transition-colors"
                                    >
                                        <Download size={12} />
                                        Save Offline
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
