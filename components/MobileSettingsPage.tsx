import React, { useEffect, useState } from 'react';
import {
    Download, LogOut, Trash2, Trophy, Play, ShieldCheck
} from 'lucide-react';
import { MobileWrappedPage } from './MobileWrappedPage';
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

export const MobileSettingsPage: React.FC = () => {
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
        const checkWrappedStatus = async () => {
            setWrappedUnlocked(await isWrappedUnlocked());
        };
        const loadStats = async () => {
            if (!user) return;
            try { setStats(await SocialService.getUserStats(user.id)); } catch (e) { }
        };
        checkWrappedStatus();
        loadStats();
    }, [user]);

    const handleClearHistory = async () => {
        setShowClearModal(false);
        try {
            await SocialService.clearWatchHistory();
            setStatusMessage('History cleared.');
            setTimeout(() => setStatusMessage(null), 3000);
            if (user) setStats(await SocialService.getUserStats(user.id));
        } catch (e: any) { setStatusMessage('Failed.'); setTimeout(() => setStatusMessage(null), 3000); }
    };

    const handleExport = async () => {
        if (!user) return;
        try {
            const history = await SocialService.getFullWatchHistory(user.id);
            const exportData = {
                version: 2,
                source: 'Cloud',
                timestamp: new Date().toISOString(),
                userId: user.id,
                watchHistory: history
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setStatusMessage('Data export started.');
            setTimeout(() => setStatusMessage(null), 3000);
        } catch (e) {
            console.error('Export failed', e);
            setStatusMessage('Export failed.');
            setTimeout(() => setStatusMessage(null), 3000);
        }
    };

    return (
        <div className="w-full h-screen flex flex-col overflow-hidden bg-[#0f1014] animate-in fade-in duration-500 relative">
            {showWrapped && <MobileWrappedPage onClose={() => setShowWrapped(false)} />}

            {/* Sticky Header */}
            <div className="pt-6 px-4 pb-4 shrink-0 bg-[#0f1014]/90 backdrop-blur-xl z-20 border-b border-white/5">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
                    <button onClick={signOut} className="p-2 bg-zinc-900 rounded-full text-zinc-400 border border-white/5 active:bg-zinc-800">
                        <LogOut size={16} />
                    </button>
                </div>

                {/* Mobile Tab Switcher */}
                <div className="flex p-1 bg-black/40 backdrop-blur-2xl rounded-full border border-white/5">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`flex-1 py-2.5 rounded-full text-[10px] uppercase tracking-widest font-bold transition-all duration-300 ${
                            activeTab === 'overview'
                                ? 'bg-gradient-to-tr from-white/20 to-white/5 border border-white/10 text-white shadow-[0_4px_15px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)]'
                                : 'bg-transparent text-zinc-500 hover:text-zinc-300 border border-transparent'
                        }`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('data')}
                        className={`flex-1 py-2.5 rounded-full text-[10px] uppercase tracking-widest font-bold transition-all duration-300 ${
                            activeTab === 'data'
                                ? 'bg-gradient-to-tr from-white/20 to-white/5 border border-white/10 text-white shadow-[0_4px_15px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)]'
                                : 'bg-transparent text-zinc-500 hover:text-zinc-300 border border-transparent'
                        }`}
                    >
                        Privacy & Data
                    </button>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-6 pb-24">
                {activeTab === 'overview' ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <GuestSecurityCard compact />

                        <div
                            onClick={() => { if (wrappedUnlocked) setShowWrapped(true) }}
                            className={`w-full p-6 text-left rounded-[20px] border relative overflow-hidden group transition-all active:scale-95 ${
                                wrappedUnlocked ? 'bg-[#151518] border-white/10 shadow-lg' : 'bg-zinc-900/50 border-white/5 grayscale opacity-60'
                            }`}
                        >
                            <div className="relative z-10 flex flex-col items-center text-center">
                                <Trophy size={20} className={`mb-2 ${wrappedUnlocked ? 'text-yellow-500' : 'text-zinc-600'}`} />
                                <h2 className="text-xl font-bold text-white tracking-tight mb-1">{currentYear} Wrapped</h2>
                                <p className="text-[11px] text-zinc-500 font-medium mb-4">
                                    {wrappedUnlocked
                                        ? `Built from ${currentYear}'s qualified sessions.`
                                        : `Unlocks on Dec 20, ${currentYear}.`}
                                </p>
                                {wrappedUnlocked && (
                                    <div className="px-5 py-2.5 bg-white text-black text-[10px] font-bold rounded-full uppercase tracking-widest flex items-center gap-2">
                                        <Play size={10} fill="currentColor" /> Play
                                    </div>
                                )}
                            </div>
                        </div>

                        {canStream && (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-[#121214] p-5 rounded-[20px] border border-white/5">
                                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"/> History
                                    </div>
                                    <div className="text-2xl font-bold text-white tracking-tight">{stats?.historyCount || 0}</div>
                                </div>
                                <div className="bg-[#121214] p-5 rounded-[20px] border border-white/5">
                                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"/> Playlists
                                    </div>
                                    <div className="text-2xl font-bold text-white tracking-tight">{stats?.playlistsCount || 0}</div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* Privacy Note */}
                        <div className="p-5 bg-[#121214] rounded-[20px] border border-white/5 flex gap-4">
                            <ShieldCheck size={20} className="text-blue-500 shrink-0 mt-1" />
                            <div>
                                <h3 className="text-sm font-bold text-white mb-1">End-to-End Synced</h3>
                                <p className="text-[11px] text-zinc-500 leading-relaxed">
                                    Your data is secure and synced. Export your history or delete it instantly. Embedded-player telemetry is strictly obfuscated.
                                </p>
                            </div>
                        </div>

                        <button onClick={handleExport} className="w-full p-5 bg-[#121214] active:bg-[#1a1a1d] rounded-[20px] border border-white/5 flex gap-4 transition-colors">
                            <div className="p-3 bg-white/5 rounded-full text-zinc-400 shrink-0 h-fit">
                                <Download size={20} />
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-bold text-white mb-1">Export Data</div>
                                <div className="text-[11px] text-zinc-500 leading-relaxed">Download full account backup including watch history JSON.</div>
                            </div>
                        </button>

                        <button
                            onClick={() => setShowClearModal(true)}
                            className="w-full p-5 bg-[#121214] active:bg-red-500/10 rounded-[20px] border border-white/5 active:border-red-500/20 flex gap-4 transition-colors"
                        >
                            <div className="p-3 bg-white/5 text-zinc-400 rounded-full shrink-0 h-fit">
                                <Trash2 size={20} />
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-bold text-white mb-1">Clear History</div>
                                <div className="text-[11px] text-zinc-500 leading-relaxed">Permanently delete your entire watch history. Cannot be undone.</div>
                            </div>
                        </button>
                    </div>
                )}
            </div>

            {/* Clear Modal */}
            {showClearModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
                    <div className="bg-[#151518] border border-white/10 rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash2 size={24} className="text-red-500" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Clear History?</h3>
                        <p className="text-zinc-500 text-sm mb-6">This clears recent history and invalidates wrapped session stats instantly.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowClearModal(false)} className="flex-1 py-3 bg-[#1e1e21] rounded-xl text-xs font-bold uppercase tracking-widest text-zinc-300 border border-white/5">Cancel</button>
                            <button onClick={handleClearHistory} className="flex-1 py-3 bg-red-500 rounded-xl text-xs font-bold uppercase tracking-widest text-white hover:bg-red-600">Clear</button>
                        </div>
                    </div>
                </div>
            )}

            {statusMessage && (
                <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-white text-black px-5 py-2.5 rounded-full text-xs font-bold shadow-xl whitespace-nowrap z-[100] flex items-center gap-2 mb-safe">
                    <ShieldCheck size={14} />
                    {statusMessage}
                </div>
            )}
        </div>
    );
};
