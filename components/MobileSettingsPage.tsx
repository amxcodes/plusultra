
import React, { useEffect, useState } from 'react';
import {
    Download, LogOut, Trash2, Trophy, Play, ShieldCheck
} from 'lucide-react';
import { WrappedPage } from './WrappedPage';
import { useAuth } from '../lib/AuthContext';
import { SocialService } from '../lib/social';
import { isWrappedUnlocked } from '../lib/wrappedSettings';

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

    return (
        <div className="w-full min-h-screen bg-[#0f1014] pb-24 pt-6 px-4 animate-in fade-in duration-500">
            {showWrapped && <WrappedPage onClose={() => setShowWrapped(false)} />}

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-black text-white tracking-tight">Settings</h1>
                <button onClick={signOut} className="p-2 bg-zinc-900 rounded-lg text-zinc-400 border border-white/5 active:bg-zinc-800">
                    <LogOut size={18} />
                </button>
            </div>

            {/* Wrapped Card */}
            <div
                onClick={() => wrappedUnlocked && setShowWrapped(true)}
                className={`w-full p-6 rounded-2xl border mb-6 relative overflow-hidden group transition-all active:scale-95 ${wrappedUnlocked ? 'bg-zinc-900 border-white/10' : 'bg-zinc-900/50 border-white/5 grayscale opacity-60'}`}
            >
                <div className="relative z-10 flex flex-col items-center text-center">
                    <Trophy size={24} className={`mb-3 ${wrappedUnlocked ? 'text-yellow-500' : 'text-zinc-600'}`} />
                    <h2 className="text-xl font-black text-white uppercase tracking-tight mb-1">{new Date().getFullYear()} Wrapped</h2>
                    <p className="text-xs text-zinc-500 font-medium mb-4">{wrappedUnlocked ? 'Built from this year\'s qualified sessions.' : 'Unlocks Dec 20th unless forced on by admin'}</p>
                    {wrappedUnlocked && (
                        <div className="px-4 py-2 bg-white text-black text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-2">
                            <Play size={10} fill="currentColor" /> Play
                        </div>
                    )}
                </div>
            </div>

            {/* Account Stats - Only for streaming users */}
            {canStream && (
                <div className="space-y-4 mb-8">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Account</h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-zinc-900/50 p-4 rounded-xl border border-white/5">
                            <div className="text-xs text-zinc-500 font-bold uppercase mb-2">History</div>
                            <div className="text-2xl font-black text-white">{stats?.historyCount || 0}</div>
                            <div className="text-[10px] text-zinc-500">Recent entries</div>
                        </div>
                        <div className="bg-zinc-900/50 p-4 rounded-xl border border-white/5">
                            <div className="text-xs text-zinc-500 font-bold uppercase mb-2">Playlists</div>
                            <div className="text-2xl font-black text-white">{stats?.playlistsCount || 0}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Actions</h3>

                <button className="w-full p-4 bg-zinc-900/50 rounded-xl border border-white/5 flex items-center gap-4 active:bg-zinc-800 transition-colors">
                    <Download size={20} className="text-zinc-400" />
                    <div className="text-left">
                        <div className="text-sm font-bold text-white">Export Data</div>
                        <div className="text-[10px] text-zinc-500">Download your personal data</div>
                    </div>
                </button>

                <button
                    onClick={() => setShowClearModal(true)}
                    className="w-full p-4 bg-red-500/5 rounded-xl border border-red-500/10 flex items-center gap-4 active:bg-red-500/10 transition-colors"
                >
                    <Trash2 size={20} className="text-red-500" />
                    <div className="text-left">
                        <div className="text-sm font-bold text-red-500">Clear History</div>
                        <div className="text-[10px] text-zinc-500">Delete all watch history</div>
                    </div>
                </button>
            </div>

            {/* Privacy Note */}
            <div className="mt-8 p-4 bg-blue-500/5 rounded-xl border border-blue-500/10 flex gap-3">
                <ShieldCheck size={16} className="text-blue-500 mt-0.5" />
                <p className="text-[10px] text-zinc-400 leading-relaxed">
                    Your data is secure and synced. Wrapped and stats are built from recent activity plus qualified viewing sessions.
                </p>
            </div>

            {/* Clear Modal */}
            {showClearModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
                    <div className="bg-[#151518] border border-white/10 rounded-2xl p-6 w-full max-w-sm text-center">
                        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash2 size={24} className="text-red-500" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Clear History?</h3>
                        <p className="text-zinc-500 text-sm mb-6">This clears recent history and wrapped session stats.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowClearModal(false)} className="flex-1 py-3 bg-zinc-800 rounded-xl text-sm font-bold text-zinc-300">Cancel</button>
                            <button onClick={handleClearHistory} className="flex-1 py-3 bg-red-500 rounded-xl text-sm font-bold text-white">Clear</button>
                        </div>
                    </div>
                </div>
            )}

            {statusMessage && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-white text-black px-4 py-2 rounded-full text-xs font-bold shadow-xl whitespace-nowrap z-[100]">
                    {statusMessage}
                </div>
            )}
        </div>
    );
};
