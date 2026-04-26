import React from 'react';
import { HardDriveDownload, Search, Trash2 } from 'lucide-react';
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

const groupOfflineDownloads = (entries: OfflineDownloadEntry[]): OfflineDownloadGroup[] => {
    const grouped = new Map<string, OfflineDownloadGroup>();

    entries
        .filter((entry) => entry.status === 'completed')
        .forEach((entry) => {
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

                    return (left.episode || 0) - (right.episode || 0);
                }

                return new Date(right.completedAt || right.createdAt).getTime() - new Date(left.completedAt || left.createdAt).getTime();
            }),
        }))
        .sort((left, right) => {
            const leftTime = Math.max(...left.entries.map((entry) => new Date(entry.completedAt || entry.createdAt).getTime()));
            const rightTime = Math.max(...right.entries.map((entry) => new Date(entry.completedAt || entry.createdAt).getTime()));
            return rightTime - leftTime;
        });
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
                            Browse titles downloaded inside the desktop app and open them with offline playback.
                        </p>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-black/20 px-5 py-4 text-right">
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">Titles</div>
                        <div className="mt-1 text-2xl font-semibold text-white">{groups.length}</div>
                    </div>
                </div>

                <div className="relative mt-6 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Search downloaded titles..."
                        className="w-full rounded-full border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-white/20 focus:bg-black/30"
                    />
                </div>
            </div>

            {filteredGroups.length === 0 ? (
                <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-[32px] border border-dashed border-white/10 bg-black/10 text-center">
                    <HardDriveDownload size={28} className="text-zinc-600" />
                    <h2 className="mt-4 text-xl font-semibold text-white">Nothing downloaded yet</h2>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
                        Save direct video files from the player download menu and they will appear here as a local desktop library.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                    {filteredGroups.map((group) => (
                        <div key={group.key} className="group relative">
                            <div
                                onClick={() => onSelectGroup(group)}
                                className="cursor-pointer transition-transform duration-300 hover:scale-[1.03]"
                            >
                                <MovieCard movie={group.movie} />
                            </div>

                            <div className="mt-2 flex items-center justify-between px-2">
                                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                                    {group.movie.mediaType === 'tv'
                                        ? `${group.entries.length} downloaded episode${group.entries.length === 1 ? '' : 's'}`
                                        : 'Offline movie'}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => void handleRemoveGroup(group)}
                                    disabled={removingKey === group.key}
                                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-zinc-300 transition-colors hover:bg-red-500/10 hover:text-red-200 disabled:opacity-60"
                                >
                                    <Trash2 size={11} />
                                    Remove
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
