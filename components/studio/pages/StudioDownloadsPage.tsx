import React from 'react';
import { CheckCircle2, Download, FolderOpen, LoaderCircle, Search, Trash2, TriangleAlert } from 'lucide-react';
import type { OfflineDownloadGroup } from '../../DownloadQuestPage';
import { groupOfflineDownloads } from '../../DownloadQuestPage';
import type { OfflineDownloadEntry } from '../../../types';

interface StudioDownloadsPageProps {
  onSelectGroup: (group: OfflineDownloadGroup) => void;
}

const progressFor = (entries: OfflineDownloadEntry[]) => {
  const active = entries.filter((entry) => entry.status === 'downloading');
  const total = active.reduce((sum, entry) => sum + (entry.totalBytes || 0), 0);
  const received = active.reduce((sum, entry) => sum + (entry.bytesReceived || 0), 0);
  return total > 0 ? Math.min(100, Math.round((received / total) * 100)) : null;
};

const statusFor = (entries: OfflineDownloadEntry[]) => {
  if (entries.some((entry) => entry.status === 'downloading')) return 'downloading' as const;
  if (entries.every((entry) => entry.status === 'completed')) return 'ready' as const;
  if (entries.some((entry) => entry.status === 'failed')) return 'failed' as const;
  return 'stopped' as const;
};

const bytes = (value?: number) => {
  if (!value) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
};

export const StudioDownloadsPage: React.FC<StudioDownloadsPageProps> = ({ onSelectGroup }) => {
  const [downloads, setDownloads] = React.useState<OfflineDownloadEntry[]>([]);
  const [query, setQuery] = React.useState('');
  const [removing, setRemoving] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!window.desktop?.isDesktop) return;
    let active = true;
    void window.desktop.getOfflineDownloads().then((entries) => active && setDownloads(entries));
    return window.desktop.onOfflineDownloadsChanged((entries) => setDownloads(entries));
  }, []);

  const groups = React.useMemo(() => groupOfflineDownloads(downloads), [downloads]);
  const visibleGroups = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? groups.filter((group) => group.movie.title.toLowerCase().includes(term)) : groups;
  }, [groups, query]);
  const activeCount = groups.filter((group) => statusFor(group.entries) === 'downloading').length;
  const readyCount = groups.filter((group) => statusFor(group.entries) === 'ready').length;

  const removeGroup = async (group: OfflineDownloadGroup) => {
    if (!window.desktop) return;
    setRemoving(group.key);
    try {
      await Promise.all(group.entries.map((entry) => window.desktop?.removeOfflineDownload(entry.id)));
    } finally {
      setRemoving(null);
    }
  };

  return (
    <section className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-28 md:px-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/38">Desktop library</div>
            <h1 className="mt-2 text-3xl font-semibold text-white md:text-4xl">Downloads</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/48">Verified direct files only. Player pages and stream manifests are filtered before they reach your library.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[14px] border border-white/10 bg-white/[0.035] px-4 py-3"><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/38">Active</div><div className="mt-1 text-xl font-semibold text-white">{activeCount}</div></div>
            <div className="rounded-[14px] border border-white/10 bg-white/[0.035] px-4 py-3"><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/38">Ready</div><div className="mt-1 text-xl font-semibold text-white">{readyCount}</div></div>
          </div>
        </div>

        <div className="relative">
          <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/38" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search saved titles" className="h-12 w-full rounded-[16px] border border-white/10 bg-white/[0.035] pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/24 focus:bg-white/[0.055]" />
        </div>

        {visibleGroups.length === 0 ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[20px] border border-dashed border-white/12 bg-white/[0.025] text-center">
            <Download size={26} className="text-white/30" />
            <h2 className="mt-4 text-lg font-semibold text-white">No verified downloads yet</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-white/42">Use the download control in a player once a direct file source is available.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.025]">
            {visibleGroups.map((group, index) => {
              const status = statusFor(group.entries);
              const progress = progressFor(group.entries);
              const failed = group.entries.find((entry) => entry.status === 'failed');
              const primary = group.entries[0];
              return (
                <div key={group.key} className={`group flex gap-3 p-3 transition-colors hover:bg-white/[0.04] ${index ? 'border-t border-white/[0.07]' : ''}`}>
                  <button type="button" onClick={() => onSelectGroup(group)} className="h-20 w-14 shrink-0 overflow-hidden rounded-[10px] bg-white/[0.06]">
                    {group.movie.imageUrl ? <img src={group.movie.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" /> : <FolderOpen className="m-auto text-white/35" size={18} />}
                  </button>
                  <button type="button" onClick={() => onSelectGroup(group)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-white">{group.movie.title}</span><span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-white/36">{group.movie.mediaType === 'tv' ? `${group.entries.length} episodes` : 'Movie'}</span></div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-white/46">
                      {status === 'downloading' ? <LoaderCircle size={13} className="animate-spin text-white/66" /> : status === 'ready' ? <CheckCircle2 size={13} className="text-emerald-300" /> : <TriangleAlert size={13} className="text-amber-200" />}
                      <span>{status === 'downloading' ? progress === null ? 'Preparing direct file' : `Downloading ${progress}%` : status === 'ready' ? `${bytes(primary.fileSize)} ready offline` : failed?.message || 'Download needs attention'}</span>
                    </div>
                    {status === 'downloading' && <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-white/80 transition-[width] duration-300" style={{ width: `${progress || 8}%` }} /></div>}
                  </button>
                  <button type="button" onClick={() => void removeGroup(group)} disabled={removing === group.key} aria-label={`Remove ${group.movie.title}`} className="self-center rounded-full p-2 text-white/36 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"><Trash2 size={16} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
