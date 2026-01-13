import React, { useEffect, useState } from 'react';
import {
    Download,

    Database,
    History,
    LogOut,
    Bookmark,
    Film,
    Tv,
    ShieldCheck,
    Cpu,
    Trash2
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { SocialService } from '../lib/social';

interface UserStats {
    historyCount: number;
    playlistsCount: number;
    likedPlaylistsCount: number;
    totalPlaylistViews: number;
}

export const SettingsPage: React.FC = () => {
    const { user, signOut } = useAuth();
    const [stats, setStats] = useState<UserStats | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [showClearModal, setShowClearModal] = useState(false);

    useEffect(() => {
        if (!user) return;
        loadStats();
    }, [user]);

    const loadStats = async () => {
        if (!user) return;
        try {
            const data = await SocialService.getUserStats(user.id);
            setStats(data);
        } catch (e) {
            console.error("Failed to load stats", e);
        }
    };



    const handleExport = async () => {
        if (!user) return;
        try {
            // Fetch comprehensive data (Full History)
            const history = await SocialService.getFullWatchHistory(user.id);
            // We can add more here if needed

            const exportData = {
                version: 2,
                source: "Cloud",
                timestamp: new Date().toISOString(),
                userId: user.id,
                watchHistory: history
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup-${new Date().getTime()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setStatusMessage('Data export started.');
            setTimeout(() => setStatusMessage(null), 3000);
        } catch (e) {
            console.error("Export failed", e);
        }
    };

    // Clear History Modal
    const ClearHistoryModal = ({ isOpen, onClose, onConfirm }: { isOpen: boolean; onClose: () => void; onConfirm: () => void }) => {
        if (!isOpen) return null;

        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm fade-in-up">
                <div className="w-[360px] bg-[#0f1014] border border-white/10 rounded-2xl p-6 shadow-2xl text-center">
                    <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Trash2 size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">Clear Watch History?</h3>
                    <p className="text-zinc-500 text-sm mb-6">
                        This action cannot be undone. All your progress will be lost.
                    </p>

                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 py-2.5 text-zinc-400 font-medium hover:bg-zinc-900 rounded-xl transition-colors">
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 py-2.5 bg-red-500/10 text-red-500 border border-red-500/20 font-bold rounded-xl hover:bg-red-500 hover:text-white transition-all"
                        >
                            Yes, Clear It
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const handleClearHistory = async () => {
        setShowClearModal(false);
        try {
            await SocialService.clearWatchHistory();
            setStatusMessage('Watch history cleared successfully.');
            setTimeout(() => setStatusMessage(null), 3000);
            loadStats();
        } catch (e: any) {
            console.error(e);
            setStatusMessage(e.message || 'Failed to clear history.');
            setTimeout(() => setStatusMessage(null), 3000);
        }
    };

    return (
        <div className="w-full pl-24 pr-12 pt-6 min-h-screen animate-in fade-in duration-700">
            <ClearHistoryModal
                isOpen={showClearModal}
                onClose={() => setShowClearModal(false)}
                onConfirm={handleClearHistory}
            />
            {/* Premium Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div>
                    <div className="flex items-center gap-3 mb-2 text-zinc-500 uppercase tracking-[0.2em] text-[10px] font-bold">
                        <Cpu size={14} className="text-zinc-600" />
                        Account Control
                    </div>
                    <h1 className="text-5xl font-black text-white tracking-tighter">
                        User <span className="text-zinc-500">Settings</span>
                    </h1>
                </div>

                <div className="flex items-center gap-4 bg-zinc-900/40 border border-white/5 p-2 rounded-2xl backdrop-blur-xl">
                    <button
                        onClick={signOut}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-white/10 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition-colors"
                    >
                        <LogOut size={14} />
                        Sign Out
                    </button>
                </div>
            </div>

            {/* Grid Layout */}
            <div className="grid grid-cols-12 gap-8 pb-20">

                {/* Main Content Area */}
                <div className="col-span-12 space-y-8">

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Cloud Storage Stat */}
                        <section className="bg-gradient-to-b from-zinc-900/80 to-black border border-white/10 rounded-[32px] p-8 relative overflow-hidden group">
                            <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                                <Database size={14} /> Cloud Sync
                            </h3>

                            <div className="relative z-10">
                                <div className="flex items-baseline gap-2 mb-2">
                                    <span className="text-5xl font-black text-emerald-500">Active</span>
                                </div>
                                <p className="text-zinc-500 text-sm mb-8">
                                    Your data is securely synced to the Cloud.
                                </p>

                                {/* Activity Pulse */}
                                <div className="flex items-center gap-2">
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                    </span>
                                    <span className="text-[10px] font-black uppercase tracking-tighter text-zinc-500">
                                        System Operational
                                    </span>
                                </div>
                            </div>
                        </section>

                        {/* Usage Stats Script */}
                        <section className="bg-gradient-to-b from-zinc-900/40 to-black border border-white/5 p-8 rounded-[32px] flex flex-col justify-between">
                            <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                                <History size={14} /> Account Activity
                            </h3>

                            <div className="grid grid-cols-2 gap-12">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500">
                                            <Film size={18} />
                                        </div>
                                        <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">History</div>
                                    </div>
                                    <div className="text-4xl font-black text-white">{stats?.historyCount || 0}</div>
                                    <p className="text-xs text-zinc-600">Titles in history</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                                            <Bookmark size={18} />
                                        </div>
                                        <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Playlists</div>
                                    </div>
                                    <div className="text-4xl font-black text-white">{stats?.playlistsCount || 0}</div>
                                    <p className="text-xs text-zinc-600">Playlists created</p>
                                </div>
                            </div>
                        </section>

                        {/* Liked Playlists Card */}
                        <section className="bg-gradient-to-b from-zinc-900/40 to-black border border-white/5 p-8 rounded-[32px] flex flex-col justify-between">
                            <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                                <Film size={14} /> Engagement
                            </h3>

                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-pink-500/10 rounded-lg text-pink-500">
                                        <Film size={18} />
                                    </div>
                                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Liked</div>
                                </div>
                                <div className="text-4xl font-black text-white">{stats?.likedPlaylistsCount || 0}</div>
                                <p className="text-xs text-zinc-600">Playlists liked</p>
                            </div>
                        </section>

                        {/* Total Views Card */}
                        <section className="bg-gradient-to-b from-zinc-900/40 to-black border border-white/5 p-8 rounded-[32px] flex flex-col justify-between">
                            <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                                <Tv size={14} /> Reach
                            </h3>

                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                                        <Tv size={18} />
                                    </div>
                                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Views</div>
                                </div>
                                <div className="text-4xl font-black text-white">{stats?.totalPlaylistViews || 0}</div>
                                <p className="text-xs text-zinc-600">Total playlist views</p>
                            </div>
                        </section>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
                        {/* Data Privacy Info */}
                        <div className="bg-zinc-900/40 border border-white/5 p-6 rounded-[24px] flex items-center gap-5 md:col-span-2">
                            <div className="p-4 bg-zinc-800 rounded-2xl text-zinc-400">
                                <ShieldCheck size={24} />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Privacy & Security</div>
                                <div className="text-lg font-bold text-white tracking-tight">End-to-End Synced</div>
                                <p className="text-xs text-zinc-600 mt-1">Your data belongs to you. You can export it or clear it at any time.</p>
                            </div>
                        </div>

                        {/* Export Card */}
                        <button
                            onClick={handleExport}
                            className="group bg-zinc-900/60 hover:bg-zinc-800/80 border border-white/5 p-6 rounded-[24px] transition-all flex items-center gap-5 text-left"
                        >
                            <div className="p-4 bg-white/5 rounded-2xl text-zinc-400 group-hover:text-white group-hover:bg-white/10 transition-all">
                                <Download size={24} />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Backup</div>
                                <div className="text-lg font-bold text-white tracking-tight">Export Data</div>
                            </div>
                        </button>

                        {/* Clear History Card - Only if enabled */}
                        <button
                            onClick={() => setShowClearModal(true)}
                            className="group bg-zinc-900/60 hover:bg-red-500/10 hover:border-red-500/20 border border-white/5 p-6 rounded-[24px] transition-all flex items-center gap-5 text-left"
                        >
                            <div className="p-4 bg-white/5 rounded-2xl text-zinc-400 group-hover:text-red-500 group-hover:bg-red-500/10 transition-all">
                                <Trash2 size={24} />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest group-hover:text-red-500/50">Danger Zone</div>
                                <div className="text-lg font-bold text-white tracking-tight group-hover:text-red-500">Clear History</div>
                            </div>
                        </button>
                    </div>
                </div>
            </div >

            {statusMessage && (
                <div className="fixed bottom-12 right-12 bg-white text-black px-6 py-3 rounded-full font-bold text-sm shadow-2xl animate-in slide-in-from-bottom-8 duration-500 flex items-center gap-3">
                    <ShieldCheck size={18} />
                    {statusMessage}
                </div>
            )}
        </div >
    );
};
