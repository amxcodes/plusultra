import React, { useRef, useState, useEffect } from 'react';
import {
    Download,
    Upload,
    Trash2,
    HardDrive,
    AlertTriangle,
    Database,
    Clock,
    Bookmark,
    Film,
    Tv,
    ShieldCheck,
    Cpu,
    History
} from 'lucide-react';

const STORAGE_KEYS = {
    MY_LIST: 'my-list',
    WATCH_HISTORY: 'watch-history',
};

interface StorageStats {
    used: number;
    total: number;
    percentage: number;
    historyCount: number;
    listCount: number;
    movieCount: number;
    tvCount: number;
}

export const SettingsPage: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
    const [importStatus, setImportStatus] = useState<string | null>(null);

    useEffect(() => {
        const calculateStorage = () => {
            let used = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    used += localStorage.getItem(key)?.length || 0;
                }
            }
            const total = 5 * 1024 * 1024;

            const myList = JSON.parse(localStorage.getItem(STORAGE_KEYS.MY_LIST) || '[]');
            const historyRecord = JSON.parse(localStorage.getItem(STORAGE_KEYS.WATCH_HISTORY) || '{}');

            // Convert Record to array of values
            const history = Object.values(historyRecord) as any[];

            const movieCount = history.filter((h: any) => h.type === 'movie').length;
            const tvCount = history.filter((h: any) => h.type === 'tv').length;

            setStorageStats({
                used,
                total,
                percentage: (used / total) * 100,
                historyCount: history.length,
                listCount: myList.length,
                movieCount,
                tvCount,
            });
        };
        calculateStorage();
    }, []);

    const handleExport = () => {
        const myList = localStorage.getItem(STORAGE_KEYS.MY_LIST) || '[]';
        const watchHistory = localStorage.getItem(STORAGE_KEYS.WATCH_HISTORY) || '[]';

        const exportData = {
            version: 1,
            name: "PlusUltra Backup",
            timestamp: new Date().toISOString(),
            myList: JSON.parse(myList),
            watchHistory: JSON.parse(watchHistory),
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-${new Date().getTime()}.plusultra`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);

                if (!data.version || (!data.myList && !data.watchHistory)) {
                    setImportStatus('Invalid PlusUltra backup file.');
                    return;
                }

                if (data.myList) localStorage.setItem(STORAGE_KEYS.MY_LIST, JSON.stringify(data.myList));
                if (data.watchHistory) localStorage.setItem(STORAGE_KEYS.WATCH_HISTORY, JSON.stringify(data.watchHistory));

                setImportStatus('Data RESTORED successfully. Syncing...');
                setTimeout(() => window.location.reload(), 1200);
            } catch (err) {
                setImportStatus('Error reading file. Check format.');
            }
        };
        reader.readAsText(file);
    };

    const handleClearData = () => {
        if (confirm('Wipe all local data? This is irreversible.')) {
            localStorage.clear();
            window.location.reload();
        }
    };

    return (
        <div className="w-full pl-24 pr-12 pt-6 min-h-screen animate-in fade-in duration-700">
            {/* Premium Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div>
                    <div className="flex items-center gap-3 mb-2 text-zinc-500 uppercase tracking-[0.2em] text-[10px] font-bold">
                        <Cpu size={14} className="text-zinc-600" />
                        System Configuration
                    </div>
                    <h1 className="text-5xl font-black text-white tracking-tighter">
                        User <span className="text-zinc-500">Settings</span>
                    </h1>
                </div>

                <div className="flex items-center gap-4 bg-zinc-900/40 border border-white/5 p-2 rounded-2xl backdrop-blur-xl">
                    <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-medium text-white">
                        <ShieldCheck size={14} className="text-green-500" />
                        Local Encrypted
                    </div>
                    <button
                        onClick={handleClearData}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-red-500/10 rounded-xl text-xs font-medium text-red-500 transition-colors"
                    >
                        <Trash2 size={14} />
                        Wipe Data
                    </button>
                </div>
            </div>

            {/* Grid Layout */}
            <div className="grid grid-cols-12 gap-8 pb-20">

                {/* Main Content Area */}
                <div className="col-span-12 space-y-8">

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Storage Visualizer */}
                        <section className="bg-gradient-to-b from-zinc-900/80 to-black border border-white/10 rounded-[32px] p-8 relative overflow-hidden group">
                            <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                                <Database size={14} /> Storage Usage
                            </h3>

                            {storageStats && (
                                <div className="relative z-10">
                                    <div className="flex items-baseline gap-2 mb-2">
                                        <span className="text-5xl font-black text-white">{(storageStats.used / 1024).toFixed(1)}</span>
                                        <span className="text-xl font-bold text-zinc-600 uppercase">KB</span>
                                    </div>
                                    <p className="text-zinc-500 text-sm mb-8">
                                        of {(storageStats.total / 1024 / 1024).toFixed(0)}MB system quota allocated
                                    </p>

                                    {/* Segmented Progress Bar */}
                                    <div className="grid grid-cols-10 gap-1.5 h-3 mb-4">
                                        {[...Array(10)].map((_, i) => (
                                            <div
                                                key={i}
                                                className={`rounded-full transition-all duration-1000 ${(storageStats.percentage / 10) > i
                                                    ? storageStats.percentage > 85 ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]' : 'bg-white shadow-[0_0_12px_rgba(255,255,255,0.3)]'
                                                    : 'bg-zinc-800'
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tighter text-zinc-500">
                                        <span>Capacity: {storageStats.percentage.toFixed(2)}%</span>
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* Redesigned Distribution Card */}
                        <section className="lg:col-span-2 bg-gradient-to-b from-zinc-900/40 to-black border border-white/5 p-8 rounded-[32px] flex flex-col justify-between">
                            <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                                <History size={14} /> Data Distribution
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div className="space-y-6">
                                    <div className="flex justify-between items-end">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                                                <Film size={18} />
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Movies</div>
                                                <div className="text-3xl font-black text-white">{storageStats?.movieCount || 0}</div>
                                            </div>
                                        </div>
                                        <div className="text-xs font-black text-amber-500 pb-1">
                                            {storageStats ? ((storageStats.movieCount / (storageStats.historyCount || 1)) * 100).toFixed(0) : 0}%
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-10 gap-1.5 h-2 mt-4">
                                        {[...Array(10)].map((_, i) => {
                                            const moviePercent = storageStats ? (storageStats.movieCount / (storageStats.historyCount || 1)) * 100 : 0;
                                            return (
                                                <div
                                                    key={i}
                                                    className={`rounded-full transition-all duration-1000 ${(moviePercent / 10) > i
                                                        ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                                                        : 'bg-zinc-800/50'
                                                        }`}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="flex justify-between items-end">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
                                                <Tv size={18} />
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Series</div>
                                                <div className="text-3xl font-black text-white">{storageStats?.tvCount || 0}</div>
                                            </div>
                                        </div>
                                        <div className="text-xs font-black text-green-500 pb-1">
                                            {storageStats ? ((storageStats.tvCount / (storageStats.historyCount || 1)) * 100).toFixed(0) : 0}%
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-10 gap-1.5 h-2 mt-4">
                                        {[...Array(10)].map((_, i) => {
                                            const tvPercent = storageStats ? (storageStats.tvCount / (storageStats.historyCount || 1)) * 100 : 0;
                                            return (
                                                <div
                                                    key={i}
                                                    className={`rounded-full transition-all duration-1000 ${(tvPercent / 10) > i
                                                        ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]'
                                                        : 'bg-zinc-800/50'
                                                        }`}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
                        {/* Quick Info: Saved Items */}
                        <div className="bg-zinc-900/40 border border-white/5 p-6 rounded-[24px] flex items-center gap-5">
                            <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-400">
                                <Bookmark size={24} />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Saved Items</div>
                                <div className="text-3xl font-black text-white">{storageStats?.listCount || 0}</div>
                            </div>
                        </div>

                        {/* Smaller Export Card */}
                        <button
                            onClick={handleExport}
                            className="group bg-zinc-900/60 hover:bg-zinc-800/80 border border-white/5 p-6 rounded-[24px] transition-all flex items-center gap-5 text-left"
                        >
                            <div className="p-4 bg-white/5 rounded-2xl text-zinc-400 group-hover:text-white group-hover:bg-white/10 transition-all">
                                <Download size={24} />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Backup</div>
                                <div className="text-lg font-bold text-white tracking-tight">Export .plusultra</div>
                            </div>
                        </button>

                        {/* Smaller Import Card */}
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="group bg-zinc-900/60 hover:bg-zinc-800/80 border border-white/5 p-6 rounded-[24px] transition-all flex items-center gap-5 text-left"
                        >
                            <div className="p-4 bg-white/5 rounded-2xl text-zinc-400 group-hover:text-white group-hover:bg-white/10 transition-all">
                                <Upload size={24} />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Restore</div>
                                <div className="text-lg font-bold text-white tracking-tight">Import Backup</div>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".plusultra"
                                onChange={handleImport}
                                className="hidden"
                            />
                        </button>
                    </div>

                </div>
            </div>

            {importStatus && (
                <div className="fixed bottom-12 right-12 bg-white text-black px-6 py-3 rounded-full font-bold text-sm shadow-2xl animate-in slide-in-from-bottom-8 duration-500 flex items-center gap-3">
                    <ShieldCheck size={18} />
                    {importStatus}
                </div>
            )}
        </div>
    );
};
