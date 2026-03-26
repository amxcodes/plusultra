import React, { useEffect, useState } from 'react';
import {
    Download,
    History,
    LogOut,
    Bookmark,
    Film,
    Cpu,
    Trash2,
    Lock,
    Trophy,
    Play,
    Tv,
    ShieldCheck
} from 'lucide-react';
import { WrappedPage } from './WrappedPage';
import { useAuth } from '../lib/AuthContext';
import { SocialService } from '../lib/social';
import { isWrappedUnlocked } from '../lib/wrappedSettings';
import { GuestSecurityCard } from './GuestSecurityCard';

interface UserStats {
    historyCount: number;
    playlistsCount: number;
    likedPlaylistsCount: number;
    totalPlaylistViews: number;
}

export const SettingsPage: React.FC = () => {
    const { user, signOut, profile } = useAuth();
    const canStream = profile?.can_stream || profile?.role === 'admin';
    const [stats, setStats] = useState<UserStats | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [showClearModal, setShowClearModal] = useState(false);
    const [wrappedUnlocked, setWrappedUnlocked] = useState(false);
    const [showWrapped, setShowWrapped] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'data'>('overview');
    const currentYear = new Date().getFullYear();

    useEffect(() => {
        checkWrappedStatus();
        if (!user) return;
        loadStats();
    }, [user]);

    const checkWrappedStatus = async () => {
        setWrappedUnlocked(await isWrappedUnlocked());
    };

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
                        This action cannot be undone. Your recent history and wrapped session stats will be cleared.
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
        <div className="w-full pl-24 pr-8 pt-8 h-screen flex flex-col overflow-hidden bg-[#0f1014] animate-in fade-in duration-700">
            {showWrapped && <WrappedPage onClose={() => setShowWrapped(false)} />}

            <ClearHistoryModal
                isOpen={showClearModal}
                onClose={() => setShowClearModal(false)}
                onConfirm={handleClearHistory}
            />

            {/* Header & Tab Switcher */}
            <div className="flex items-center justify-between mb-8 shrink-0 pr-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center border border-white/5">
                        <Cpu size={20} className="text-zinc-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight">Settings</h1>
                        <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Preferences</div>
                    </div>
                </div>

                {/* Navbar-style Glass Pill Switcher */}
                <div className="flex p-1.5 bg-black/40 backdrop-blur-xl rounded-full border border-white/5 z-10 shadow-2xl relative">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-8 py-2 rounded-full text-xs uppercase tracking-widest font-bold transition-all duration-300 transform active:scale-95 ${
                            activeTab === 'overview'
                                ? 'bg-gradient-to-tr from-white/20 to-white/5 border border-white/10 text-white shadow-[0_10px_30px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] backdrop-blur-3xl relative z-10'
                                : 'bg-transparent text-zinc-500 hover:text-zinc-300 border border-transparent'
                        }`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('data')}
                        className={`px-8 py-2 rounded-full text-xs uppercase tracking-widest font-bold transition-all duration-300 transform active:scale-95 ${
                            activeTab === 'data'
                                ? 'bg-gradient-to-tr from-white/20 to-white/5 border border-white/10 text-white shadow-[0_10px_30px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] backdrop-blur-3xl relative z-10'
                                : 'bg-transparent text-zinc-500 hover:text-zinc-300 border border-transparent'
                        }`}
                    >
                        Privacy & Data
                    </button>
                </div>

                <button
                    onClick={signOut}
                    className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-white/5 rounded-full text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors"
                >
                    <LogOut size={14} />
                    Sign Out
                </button>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 pb-12">
                
                {activeTab === 'overview' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Guest Security Card is naturally compact now */}
                        <div className="lg:col-span-2">
                            <GuestSecurityCard compact />
                        </div>

                        {/* Usage Stats Script - Compact & Solid */}
                        {canStream && (
                            <section className="bg-[#121214] border border-white/5 p-6 rounded-[24px] flex flex-col justify-between hover:border-white/10 transition-colors">
                                <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <History size={14} /> Account Activity
                                </h3>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-purple-500" />
                                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">History</div>
                                        </div>
                                        <div className="text-3xl font-bold text-white tracking-tight">{stats?.historyCount || 0}</div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Playlists</div>
                                        </div>
                                        <div className="text-3xl font-bold text-white tracking-tight">{stats?.playlistsCount || 0}</div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* Engagement Stats - Compact & Solid */}
                        {canStream && (
                            <section className="bg-[#121214] border border-white/5 p-6 rounded-[24px] flex flex-col justify-between hover:border-white/10 transition-colors">
                                <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <Film size={14} /> Engagement Reach
                                </h3>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-pink-500" />
                                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Liked</div>
                                        </div>
                                        <div className="text-3xl font-bold text-white tracking-tight">{stats?.likedPlaylistsCount || 0}</div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Views</div>
                                        </div>
                                        <div className="text-3xl font-bold text-white tracking-tight">{stats?.totalPlaylistViews || 0}</div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* Wrapped Card - Compact version */}
                        <section
                            onClick={() => { if (wrappedUnlocked) setShowWrapped(true); }}
                            className={`lg:col-span-2 relative border rounded-[24px] p-6 overflow-hidden group transition-all duration-300 ${
                                wrappedUnlocked
                                    ? 'bg-[#151518] border-white/10 hover:border-white/30 cursor-pointer shadow-xl'
                                    : 'bg-[#0f1014] border-white/5 opacity-60 grayscale'
                            }`}
                        >
                            <div className="flex items-center justify-between relative z-10">
                                <div>
                                    <h3 className={`text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-2 ${wrappedUnlocked ? 'text-zinc-400' : 'text-zinc-600'}`}>
                                        {wrappedUnlocked ? <Trophy size={14} className="text-yellow-500" /> : <Lock size={14} />}
                                        {wrappedUnlocked ? 'Your Year In Review' : 'Locked'}
                                    </h3>
                                    <div className={`text-2xl font-bold tracking-tight ${wrappedUnlocked ? 'text-white' : 'text-zinc-600'}`}>
                                        {currentYear} Wrapped
                                    </div>
                                    <p className={`text-xs mt-1 font-medium ${wrappedUnlocked ? 'text-zinc-500' : 'text-zinc-700'}`}>
                                        {wrappedUnlocked
                                            ? `Your ${currentYear} Wrapped is ready from this year's qualified sessions.`
                                            : `Unlocks automatically on Dec 20, ${currentYear}, unless an admin override is enabled.`}
                                    </p>
                                </div>
                                {wrappedUnlocked ? (
                                    <div className="flex shrink-0 items-center justify-center w-12 h-12 bg-white text-black rounded-full group-hover:scale-105 transition-transform shadow-lg">
                                        <Play size={20} fill="currentColor" className="ml-1" />
                                    </div>
                                ) : (
                                    <div className="hidden md:flex items-center gap-2">
                                        <div className="h-1.5 w-24 bg-zinc-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-zinc-700 w-[70%]" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Data Privacy Info */}
                        <div className="bg-[#121214] border border-white/5 p-6 rounded-[24px] flex items-start gap-4 md:col-span-2">
                            <div className="p-3 bg-zinc-900 rounded-2xl text-blue-400 border border-white/5 shrink-0 mt-1">
                                <ShieldCheck size={20} />
                            </div>
                            <div>
                                <div className="text-lg font-bold text-white tracking-tight">End-to-End Synced</div>
                                <p className="text-sm text-zinc-500 mt-1 leading-relaxed">
                                    Your data belongs to you. You can export it or clear it at any time. Embedded-player telemetry is strictly obfuscated and only anonymized session qualities are aggregated.
                                </p>
                            </div>
                        </div>

                        {/* Export Card */}
                        <button
                            onClick={handleExport}
                            className="bg-[#121214] hover:bg-[#1a1a1d] border border-white/5 p-6 rounded-[24px] transition-all flex flex-col items-start text-left focus:outline-none"
                        >
                            <div className="p-3 bg-white/5 rounded-full text-zinc-300 mb-4">
                                <Download size={20} />
                            </div>
                            <div className="text-base font-bold text-white tracking-tight mb-1">Export Data</div>
                            <div className="text-xs text-zinc-500 font-medium">Download full account backup including watch history, interactions, and settings JSON bundle.</div>
                        </button>

                        {/* Clear History Card */}
                        <button
                            onClick={() => setShowClearModal(true)}
                            className="bg-[#121214] hover:bg-red-500/10 hover:border-red-500/20 border border-white/5 p-6 rounded-[24px] transition-all flex flex-col items-start text-left focus:outline-none group"
                        >
                            <div className="p-3 bg-white/5 group-hover:bg-red-500/20 group-hover:text-red-500 transition-colors rounded-full text-zinc-300 mb-4">
                                <Trash2 size={20} />
                            </div>
                            <div className="text-base font-bold text-white tracking-tight group-hover:text-red-500 transition-colors mb-1">Clear History</div>
                            <div className="text-xs text-zinc-500 font-medium group-hover:text-red-400/70 transition-colors">Permanently delete your watch history. This action cannot be reversed and immediately invalidates active Wrapped sessions.</div>
                        </button>
                    </div>
                )}
            </div>

            {statusMessage && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white text-black px-6 py-3 rounded-full font-bold text-sm shadow-[0_10px_40px_rgba(255,255,255,0.2)] animate-in slide-in-from-bottom-8 duration-500 flex items-center gap-3 z-[100]">
                    <ShieldCheck size={18} />
                    {statusMessage}
                </div>
            )}
        </div>
    );
};
