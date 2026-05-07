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

const getSummaryAccentClassName = (status: OfflineGroupSummary['status']) => {
    switch (status) {
        case 'downloading':
        case 'partial':
            return 'from-sky-400 to-cyan-300';
        case 'completed':
            return 'from-emerald-400 to-lime-300';
        case 'failed':
            return 'from-red-400 to-orange-300';
        default:
            return 'from-zinc-500 to-zinc-400';
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

    const completedGroupCount = React.useMemo(() => (
        groups.filter((group) => group.entries.every((entry) => entry.status === 'completed')).length
    ), [groups]);

    const failedGroupCount = React.useMemo(() => (
        groups.filter((group) => group.entries.some((entry) => entry.status === 'failed')).length
    ), [groups]);

    return (
        <div className="min-h-screen w-full bg-[#0f1014] pl-24 pr-8 pt-8 text-zinc-100 animate-in fade-in duration-700">
            <div className="rounded-[34px] border border-[#242424] bg-[#141519] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.28)]">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_420px]">
                    <div className="rounded-[28px] border border-[#242424] bg-[#101114] px-6 py-6">
                        <div className="text-[10px] font-mono uppercase tracking-[0.28em] text-[#8d8578]">Offline library</div>
                        <div className="mt-4 flex items-end justify-between gap-6">
                            <div>
                                <h1 className="text-4xl font-black tracking-[-0.05em] text-white md:text-5xl">
                                    Download Quest
                                </h1>
                                <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                                    Monitor active transfers, reopen offline-ready titles, and keep the desktop library under one dense control surface.
                                </p>
                            </div>
                            <div className="hidden shrink-0 rounded-full border border-[#e36457] bg-[#2b1715] px-4 py-2 text-[10px] font-mono uppercase tracking-[0.24em] text-[#ffd4cf] xl:block">
                                {activeGroupCount} active groups
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-[22px] border border-[#2b2d33] bg-[#18191f] px-4 py-4">
                            <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-[#8d8578]">Titles</div>
                            <div className="mt-3 text-4xl font-black tracking-[-0.05em] text-white">{groups.length}</div>
                            <div className="mt-1 text-[11px] text-zinc-500">Tracked in library</div>
                        </div>
                        <div className="rounded-[22px] border border-[#2b2d33] bg-[#18191f] px-4 py-4">
                            <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-[#8d8578]">In motion</div>
                            <div className="mt-3 text-4xl font-black tracking-[-0.05em] text-white">{activeGroupCount}</div>
                            <div className="mt-1 text-[11px] text-zinc-500">Still transferring</div>
                        </div>
                        <div className="rounded-[22px] border border-[#2b2d33] bg-[#18191f] px-4 py-4">
                            <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-[#8d8578]">Ready</div>
                            <div className="mt-3 text-4xl font-black tracking-[-0.05em] text-white">{completedGroupCount}</div>
                            <div className="mt-1 text-[11px] text-zinc-500">Fully offline-ready</div>
                        </div>
                        <div className="rounded-[22px] border border-[#47211d] bg-[#1d1312] px-4 py-4">
                            <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-[#f0a39a]">Faults</div>
                            <div className="mt-3 text-4xl font-black tracking-[-0.05em] text-white">{failedGroupCount}</div>
                            <div className="mt-1 text-[11px] text-[#c7877f]">Need attention</div>
                        </div>
                    </div>
                </div>

                <div className="mt-4 rounded-[26px] border border-[#242424] bg-[#101114] p-4">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_270px]">
                        <div>
                            <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-[#8d8578]">Library search</div>
                            <div className="relative mt-3">
                                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    placeholder="Search offline titles..."
                                    className="h-[48px] w-full rounded-[18px] border border-[#2f3138] bg-[#18191f] py-3 pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-[#575c75]"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
                            <div className="rounded-[18px] border border-[#2f3138] bg-[#18191f] px-4 py-3">
                                <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#8d8578]">Completed</div>
                                <div className="mt-2 text-sm font-semibold text-white">{downloads.filter((entry) => entry.status === 'completed').length} files</div>
                            </div>
                            <div className="rounded-[18px] border border-[#2f3138] bg-[#18191f] px-4 py-3">
                                <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#8d8578]">Scope</div>
                                <div className="mt-2 text-sm font-semibold text-white">{filteredGroups.length} visible groups</div>
                            </div>
                        </div>
                    </div>
                </div>

            {filteredGroups.length === 0 ? (
                <div className="mt-6 flex min-h-[40vh] flex-col items-center justify-center rounded-[28px] border border-dashed border-[#2f3138] bg-[#101114] text-center">
                    <HardDriveDownload size={28} className="text-zinc-600" />
                    <h2 className="mt-4 text-xl font-semibold text-white">No offline items yet</h2>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
                        Start an offline download from the player and its progress will appear here automatically.
                    </p>
                </div>
            ) : (
                <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 pb-20 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                    {filteredGroups.map((group) => {
                        const summary = getGroupSummary(group);
                        const hasCompletedEntries = group.entries.some((entry) => entry.status === 'completed');

                        return (
                            <div key={group.key} className="group relative">
                                <div
                                    onClick={() => onSelectGroup(group)}
                                    className="cursor-pointer transition-transform duration-300 hover:scale-[1.02]"
                                >
                                    <MovieCard movie={group.movie} />
                                </div>

                                <div className="mt-3 rounded-[22px] border border-[#242424] bg-[#111317] px-3.5 py-3 shadow-[0_12px_28px_rgba(0,0,0,0.22)] transition-all duration-300 group-hover:border-[#343434]">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] ${getSummaryBadgeClassName(summary.status)}`}>
                                            {(summary.status === 'downloading' || summary.status === 'partial') && (
                                                <LoaderCircle size={10} className="animate-spin" />
                                            )}
                                            {summary.label}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => void handleRemoveGroup(group)}
                                            disabled={removingKey === group.key}
                                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#2b2d33] bg-[#1a1c22] text-zinc-400 transition-colors hover:border-[#4a1e1a] hover:bg-[#231514] hover:text-[#f0a39a] disabled:opacity-60"
                                            title="Remove downloads"
                                        >
                                            <Trash2 size={11} />
                                        </button>
                                    </div>

                                    <div className="mt-3 flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="text-[11px] font-semibold text-white tracking-tight">
                                                {group.movie.mediaType === 'tv'
                                                    ? `${summary.completedCount}/${group.entries.length} episodes ready`
                                                    : hasCompletedEntries
                                                        ? 'Offline movie ready'
                                                        : summary.status === 'downloading'
                                                            ? 'Download in progress'
                                                            : 'Offline file unavailable'}
                                            </div>
                                            <div className="mt-1 text-[10px] leading-relaxed text-zinc-500">
                                                {summary.downloadingCount > 0
                                                    ? summary.progressPercent !== null
                                                        ? `${summary.downloadingCount} active download${summary.downloadingCount === 1 ? '' : 's'}`
                                                        : 'Waiting for stable file response'
                                                    : summary.failedCount > 0
                                                        ? `${summary.failedCount} failed item${summary.failedCount === 1 ? '' : 's'}`
                                                        : summary.cancelledCount > 0
                                                            ? `${summary.cancelledCount} cancelled item${summary.cancelledCount === 1 ? '' : 's'}`
                                                            : group.movie.mediaType === 'tv'
                                                                ? 'Open this show to browse downloaded episodes'
                                                                : 'Open this title to start offline playback'}
                                            </div>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#8d8578]">
                                                {group.movie.mediaType === 'tv' ? 'Series' : 'Movie'}
                                            </div>
                                            <div className="mt-1 text-sm font-medium text-zinc-300">
                                                {group.movie.year || 'Offline'}
                                            </div>
                                        </div>
                                    </div>

                                    {summary.progressPercent !== null && (
                                        <div className="mt-3">
                                            <div className="h-[4px] overflow-hidden rounded-full bg-[#21242c]">
                                                <div
                                                    className={`h-full rounded-full bg-gradient-to-r ${getSummaryAccentClassName(summary.status)} transition-[width] duration-500`}
                                                    style={{ width: `${summary.progressPercent}%` }}
                                                />
                                            </div>
                                            <div className="mt-1 flex items-center justify-between text-[9px] font-mono uppercase tracking-[0.2em] text-[#8d8578]">
                                                <span>Transfer</span>
                                                <span>{summary.progressPercent}%</span>
                                            </div>
                                        </div>
                                    )}

                                    {summary.progressPercent === null && (
                                        <div className="mt-3 h-[4px] overflow-hidden rounded-full bg-[#21242c]">
                                            <div
                                                className={`h-full w-1/3 rounded-full bg-gradient-to-r ${getSummaryAccentClassName(summary.status)} opacity-70`}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            </div>
        </div>
    );
};
