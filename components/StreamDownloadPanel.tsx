import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Download, ExternalLink, Info } from 'lucide-react';
import { useToast } from '../lib/ToastContext';
import { buildStreamDownloadCandidates } from '../lib/streamDownloads';
import { DirectPlaybackSource, MediaType, Provider } from '../lib/playerProviders';

interface StreamDownloadPanelProps {
    providerId: Provider;
    providerName: string;
    tmdbId: string;
    mediaType: MediaType;
    season?: number;
    episode?: number;
    currentEmbedUrl?: string;
    directSources?: DirectPlaybackSource[];
}

export const StreamDownloadPanel: React.FC<StreamDownloadPanelProps> = ({
    providerId,
    providerName,
    tmdbId,
    mediaType,
    season,
    episode,
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

        let active = true;

        window.desktop.getCapturedMedia().then((items) => {
            if (active) {
                setDesktopCapturedMedia(items);
            }
        }).catch(() => {
            // Ignore bridge errors in the web build.
        });

        const unsubscribe = window.desktop.onCapturedMedia((item) => {
            setDesktopCapturedMedia((current) => {
                if (current.some((entry) => entry.url === item.url)) {
                    return current;
                }

                return [item, ...current].slice(0, 20);
            });
        });

        return () => {
            active = false;
            unsubscribe();
        };
    }, []);

    const desktopCandidates = useMemo(() => (
        desktopCapturedMedia.map((item) => ({
            id: `desktop:${item.url}`,
            label: 'Captured by desktop session',
            url: item.url,
            kind: item.url.toLowerCase().includes('.m3u8') ? 'playlist' : 'video',
            source: 'detected' as const,
            note: `Observed in Electron network session as ${item.resourceType}`,
        }))
    ), [desktopCapturedMedia]);

    const allCandidates = [...desktopCandidates, ...candidates].filter((candidate, index, list) => (
        list.findIndex((entry) => entry.url === candidate.url) === index
    ));

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
                        Derived from the active provider URL and any direct source exposed to the app.
                    </p>
                </div>
            </div>

            {allCandidates.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 bg-black/20 p-3">
                    <div className="flex items-start gap-2 text-zinc-400">
                        <Info size={14} className="mt-0.5" />
                        <p className="text-xs leading-relaxed">
                            No downloadable stream URL is visible to the app for this provider. Cross-origin iframe
                            network traffic cannot be inspected directly from the parent page.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {allCandidates.map(candidate => (
                        <div key={candidate.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="text-xs font-semibold text-white">{candidate.label}</span>
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
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
