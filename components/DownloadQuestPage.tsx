import React from 'react';
import { HardDriveDownload, LoaderCircle, Search, Trash2 } from 'lucide-react';
import { MovieCard } from './MovieCard';
import type { Movie, OfflineDownloadEntry } from '../types';

export interface OfflineDownloadGroup {
    key: string;
    movie: Movie;
    entries: OfflineDownloadEntry[];
}

interface DownloadQuestPageProps {
    onSelectGroup: (group: OfflineDownloadGroup) => void;
}

type OfflineGroupSummary = {
    status: 'downloading' | 'completed' | 'partial' | 'failed' | 'cancelled';
    completedCount: number;
    downloadingCount: number;
    failedCount: number;
    cancelledCount: number;
    progressPercent: number | null;
    label: string;
};

const buildOfflineMovie = (entry: OfflineDownloadEntry): Movie => ({
    id: entry.tmdbId,
    tmdbId: entry.tmdbId,
    title: entry.title,
    year: entry.year,
    match: 100,
    imageUrl: entry.imageUrl,
    backdropUrl: entry.backdropUrl,
    description: entry.description,
    genre: entry.genre,
    mediaType: entry.mediaType,
    season: entry.season,
    episode: entry.episode,
});

const getEntryTimestamp = (entry: OfflineDownloadEntry) => (
    new Date(entry.completedAt || entry.createdAt).getTime()
);

const groupOfflineDownloads = (entries: OfflineDownloadEntry[]): OfflineDownloadGroup[] => {
    const grouped = new Map<string, OfflineDownloadGroup>();

    entries.forEach((entry) => {
        const key = `${entry.mediaType}:${entry.tmdbId}`;
        const existing = grouped.get(key);
        if (existing) {
            existing.entries.push(entry);
            return;
        }

        grouped.set(key, {
            key,
            movie: buildOfflineMovie(entry),
            entries: [entry],
        });
    });

    return [...grouped.values()]
        .map((group) => ({
            ...group,
            entries: group.entries.slice().sort((left, right) => {
                if (group.movie.mediaType === 'tv') {
                    if ((left.season || 0) !== (right.season || 0)) {
                        return (left.season || 0) - (right.season || 0);
                    }

                    if ((left.episode || 0) !== (right.episode || 0)) {
                        return (left.episode || 0) - (right.episode || 0);
                    }
                }

                return getEntryTimestamp(right) - getEntryTimestamp(left);
            }),
        }))
        .sort((left, right) => {
            const leftTime = Math.max(...left.entries.map(getEntryTimestamp));
            const rightTime = Math.max(...right.entries.map(getEntryTimestamp));
            return rightTime - leftTime;
        });
};

const getGroupSummary = (group: OfflineDownloadGroup): OfflineGroupSummary => {
    const completedCount = group.entries.filter((entry) => entry.status === 'completed').length;
    const downloadingEntries = group.entries.filter((entry) => entry.status === 'downloading');
    const downloadingCount = downloadingEntries.length;
    const failedCount = group.entries.filter((entry) => entry.status === 'failed').length;
    const cancelledCount = group.entries.filter((entry) => entry.status === 'cancelled').length;

    const hasKnownProgress = downloadingEntries.every((entry) => (
        typeof entry.totalBytes === 'number' &&
        entry.totalBytes > 0 &&
        typeof entry.bytesReceived === 'number'
    ));

    const totalBytes = downloadingEntries.reduce((sum, entry) => sum + (entry.totalBytes || 0), 0);
    const receivedBytes = downloadingEntries.reduce((sum, entry) => sum + (entry.bytesReceived || 0), 0);
    const progressPercent = downloadingCount > 0 && hasKnownProgress && totalBytes > 0
        ? Math.max(0, Math.min(100, Math.round((receivedBytes / totalBytes) * 100)))
        : null;

    if (downloadingCount > 0) {
        return {
            status: completedCount > 0 ? 'partial' : 'downloading',
            completedCount,
            downloadingCount,
            failedCount,
            cancelledCount,
            progressPercent,
            label: progressPercent !== null
                ? `Downloading ${progressPercent}%`
                : downloadingCount > 1
                    ? `Preparing ${downloadingCount} downloads`
                    : 'Preparing download',
        };
    }

    if (completedCount === group.entries.length) {
        return {
            status: 'completed',
            completedCount,
            downloadingCount,
            failedCount,
            cancelledCount,
            progressPercent: 100,
            label: group.movie.mediaType === 'tv'
                ? `${completedCount} episode${completedCount === 1 ? '' : 's'} ready`
                : 'Offline ready',
        };
    }

    if (completedCount > 0) {
        return {
            status: 'partial',
            completedCount,
            downloadingCount,
            failedCount,
            cancelledCount,
            progressPercent: null,
            label: group.movie.mediaType === 'tv'
                ? `${completedCount} ready, ${group.entries.length - completedCount} unavailable`
                : 'Partially available',
        };
    }

    if (failedCount > 0) {
        return {
            status: 'failed',
            completedCount,
            downloadingCount,
            failedCount,
            cancelledCount,
            progressPercent: null,
            label: failedCount > 1 ? `${failedCount} failed downloads` : 'Download failed',
        };
    }

    return {
        status: 'cancelled',
        completedCount,
        downloadingCount,
        failedCount,
        cancelledCount,
        progressPercent: null,
        label: cancelledCount > 1 ? `${cancelledCount} cancelled downloads` : 'Download cancelled',
    };
};

const getSummaryBadgeClassName = (status: OfflineGroupSummary['status']) => {
    switch (status) {
        case 'downloading':
        case 'partial':
            return 'border-sky-400/20 bg-sky-400/10 text-sky-100';
        case 'completed':
            return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100';
        case 'failed':
            return 'border-red-400/20 bg-red-400/10 text-red-100';
        default:
            return 'border-white/10 bg-white/5 text-zinc-300';
    }
};

export const DownloadQuestPage: React.FC<DownloadQuestPageProps> = ({ onSelectGroup }) => {
    const [downloads, setDownloads] = React.useState<OfflineDownloadEntry[]>([]);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [removingKey, setRemovingKey] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!window.desktop?.isDesktop) {
            return;
        }

        let active = true;
        void window.desktop.getOfflineDownloads().then((entries) => {
            if (active) {
                setDownloads(entries);
            }
        });

        const unsubscribe = window.desktop.onOfflineDownloadsChanged((entries) => {
            setDownloads(entries);
        });

        return () => {
            active = false;
            unsubscribe();
        };
    }, []);

    const groups = React.useMemo(() => groupOfflineDownloads(downloads), [downloads]);
    const filteredGroups = React.useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        if (!query) return groups;

        return groups.filter((group) => {
            const haystacks = [
                group.movie.title,
                group.movie.year ? String(group.movie.year) : '',
                group.movie.mediaType === 'tv' ? 'series' : 'movie',
            ];
            return haystacks.some((value) => value.toLowerCase().includes(query));
        });
    }, [groups, searchTerm]);

    const activeGroupCount = React.useMemo(() => (
        groups.filter((group) => group.entries.some((entry) => entry.status === 'downloading')).length
    ), [groups]);

    const handleRemoveGroup = async (group: OfflineDownloadGroup) => {
        if (!window.desktop) return;

        setRemovingKey(group.key);
        try {
            await Promise.all(group.entries.map((entry) => window.desktop?.removeOfflineDownload(entry.id)));
        } finally {
            setRemovingKey(null);
        }
    };

    return (
        <div className="min-h-screen pt-4 pb-20 pl-24 pr-8">
            <div className="mb-8 rounded-[32px] border border-white/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-8">
                <div className="flex items-start justify-between gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">
                            <HardDriveDownload size={12} />
                            Download Quest
                        </div>
                        <h1 className="mt-4 text-4xl font-bold tracking-tight text-white">Offline library</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
                            Track active downloads, revisit completed titles, and open offline-ready movies or episodes from one desktop library.
                        </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[24px] border border-white/10 bg-black/20 px-5 py-4 text-right">
                            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">Titles</div>
                            <div className="mt-1 text-2xl font-semibold text-white">{groups.length}</div>
                        </div>
                        <div className="rounded-[24px] border border-white/10 bg-black/20 px-5 py-4 text-right">
                            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">Active</div>
                            <div className="mt-1 text-2xl font-semibold text-white">{activeGroupCount}</div>
                        </div>
                    </div>
                </div>

                <div className="relative mt-6 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Search offline titles..."
                        className="w-full rounded-full border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-white/20 focus:bg-black/30"
                    />
                </div>
            </div>

            {filteredGroups.length === 0 ? (
                <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-[32px] border border-dashed border-white/10 bg-black/10 text-center">
                    <HardDriveDownload size={28} className="text-zinc-600" />
                    <h2 className="mt-4 text-xl font-semibold text-white">No offline items yet</h2>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
                        Start an offline download from the player and its progress will appear here automatically.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                    {filteredGroups.map((group) => {
                        const summary = getGroupSummary(group);
                        const hasCompletedEntries = group.entries.some((entry) => entry.status === 'completed');

                        return (
                            <div key={group.key} className="group relative">
                                <div
                                    onClick={() => onSelectGroup(group)}
                                    className="cursor-pointer transition-transform duration-300 hover:scale-[1.03]"
                                >
                                    <MovieCard movie={group.movie} />
                                </div>

                                <div className="mt-3 rounded-[22px] border border-white/10 bg-black/20 p-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${getSummaryBadgeClassName(summary.status)}`}>
                                            {(summary.status === 'downloading' || summary.status === 'partial') && (
                                                <LoaderCircle size={10} className="animate-spin" />
                                            )}
                                            {summary.label}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => void handleRemoveGroup(group)}
                                            disabled={removingKey === group.key}
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition-colors hover:bg-red-500/10 hover:text-red-200 disabled:opacity-60"
                                            title="Remove downloads"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>

                                    <div className="mt-3 space-y-2">
                                        <div className="text-[11px] font-semibold text-white">
                                            {group.movie.mediaType === 'tv'
                                                ? `${summary.completedCount} ready of ${group.entries.length} episode${group.entries.length === 1 ? '' : 's'}`
                                                : hasCompletedEntries
                                                    ? 'Offline movie ready'
                                                    : summary.status === 'downloading'
                                                        ? 'Movie download in progress'
                                                        : 'Movie not ready yet'}
                                        </div>
                                        <div className="text-[11px] leading-relaxed text-zinc-500">
                                            {summary.downloadingCount > 0
                                                ? summary.progressPercent !== null
                                                    ? `${summary.downloadingCount} active download${summary.downloadingCount === 1 ? '' : 's'}`
                                                    : 'Waiting for the stream source to settle'
                                                : summary.failedCount > 0
                                                    ? `${summary.failedCount} failed item${summary.failedCount === 1 ? '' : 's'} can be retried from the player`
                                                    : summary.cancelledCount > 0
                                                        ? `${summary.cancelledCount} cancelled item${summary.cancelledCount === 1 ? '' : 's'}`
                                                        : 'Open this title to access offline-ready playback'}
                                        </div>

                                        {summary.progressPercent !== null && (
                                            <div className="pt-1">
                                                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                                                    <div
                                                        className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-[width] duration-500"
                                                        style={{ width: `${summary.progressPercent}%` }}
                                                    />
                                                </div>
                                                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                                                    {summary.progressPercent}% downloaded
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
