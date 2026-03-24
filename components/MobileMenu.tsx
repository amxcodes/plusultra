import React from 'react';
import { NavItem } from '../types';
import { useAuth } from '../lib/AuthContext';
import {
    X,
    User,
    Settings,
    Shield, // Admin
    Bell, // Announcements
    Activity, // Activity Log
    BarChart2, // Stats
    ListVideo, // Playlists
    LogOut,
    ChevronRight,
    Clapperboard,
    MonitorPlay,
    Ghost,
    Zap, // For You
    Drama,
    LayoutGrid,
    Newspaper,
    MessageSquarePlus,
    Bot
} from 'lucide-react';

interface MobileMenuProps {
    isOpen: boolean;
    onClose: () => void;
    activeTab: NavItem;
    setActiveTab: (tab: NavItem) => void;
}

export const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose, activeTab, setActiveTab }) => {
    const { user, profile, signOut } = useAuth();
    const canStream = profile?.can_stream || profile?.role === 'admin';

    if (!isOpen) return null;

    const handleNav = (tab: NavItem) => {
        setActiveTab(tab);
    };

    const MenuItem = ({ icon: Icon, label, tab, badge }: { icon: any, label: string, tab: NavItem, badge?: string }) => (
        <button
            onClick={() => handleNav(tab)}
            className={`w-full flex items-center justify-between p-3.5 rounded-2xl transition-all active:scale-95 border ${activeTab === tab
                ? 'bg-white text-black border-transparent shadow-md'
                : 'bg-zinc-800/40 hover:bg-zinc-800/80 text-zinc-300 border-white/5'
                }`}
        >
            <div className="flex items-center gap-3">
                <Icon size={18} strokeWidth={activeTab === tab ? 2.5 : 2} />
                <span className="font-bold text-sm leading-none">{label}</span>
            </div>
            <div className="flex items-center gap-2">
                {badge && <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full leading-none">{badge}</span>}
                <ChevronRight size={14} className="opacity-40" />
            </div>
        </button>
    );

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 z-[65] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modular Floating Panel */}
            <div className="fixed left-1/2 -translate-x-1/2 bottom-[90px] w-full max-w-[calc(100%-2rem)] sm:max-w-[360px] max-h-[75vh] z-[70] bg-[#121316]/95 backdrop-blur-3xl rounded-[32px] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom-8 fade-in duration-300 flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between p-5 pb-4 border-b border-white/5 bg-white/5">
                    <h2 className="text-lg font-bold text-white tracking-tight">Menu</h2>
                    <button
                        onClick={onClose}
                        className="p-2 bg-zinc-800/50 hover:bg-zinc-700/50 rounded-full text-zinc-400 border border-white/10 active:bg-zinc-700/80 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-5 pb-8 space-y-6 custom-scrollbar">

                    {/* Profile Section */}
                    <div
                        onClick={() => handleNav(NavItem.PROFILE)}
                        className="flex items-center gap-4 p-4 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl border border-white/10 cursor-pointer active:scale-95 transition-transform"
                    >
                        <div className="w-12 h-12 rounded-full bg-black border-2 border-white/10 overflow-hidden flex-shrink-0">
                            <img
                                src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.username || 'User'}`}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="min-w-0">
                            <div className="text-base font-bold text-white truncate mb-0.5">{profile?.username || 'Guest'}</div>
                            <div className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider">View Profile</div>
                        </div>
                    </div>

                    {/* Main Navigation */}
                    <div className="space-y-2.5">
                        <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Browse</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <MenuItem icon={LayoutGrid} label="Home" tab={NavItem.DASHBOARD} />
                            <MenuItem icon={Zap} label="For You" tab={NavItem.FOR_YOU} />
                            <MenuItem icon={Bot} label="Curator Lab" tab={NavItem.CURATOR} />
                            <MenuItem icon={Newspaper} label="News Feed" tab={NavItem.NEWS} />
                            {canStream && <MenuItem icon={MessageSquarePlus} label="Requests" tab={NavItem.REQUESTS} />}
                        </div>
                    </div>

                    {/* Library Section */}
                    <div className="space-y-2.5">
                        <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Library</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <MenuItem icon={Clapperboard} label="Movies" tab={NavItem.MOVIES} />
                            <MenuItem icon={MonitorPlay} label="Series" tab={NavItem.SERIES} />
                            <MenuItem icon={Ghost} label="Anime" tab={NavItem.ANIME} />
                            <MenuItem icon={Drama} label="Asian Drama" tab={NavItem.ASIAN_DRAMA} />
                            <MenuItem icon={ListVideo} label="Playlists" tab={NavItem.PLAYLISTS} />
                        </div>
                    </div>

                    {/* Activity & Social */}
                    <div className="space-y-2.5">
                        <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Social</h3>
                        <div className="space-y-2">
                            <MenuItem icon={Bell} label="Announcements" tab={NavItem.ANNOUNCEMENTS} />
                            <MenuItem icon={Activity} label="Activity Log" tab={NavItem.ACTIVITY} />
                            {canStream && <MenuItem icon={BarChart2} label="Stats Dashboard" tab={NavItem.STATS} />}
                        </div>
                    </div>

                    {/* App Controls */}
                    <div className="space-y-2.5">
                        <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">App</h3>
                        <div className="space-y-2">
                            {profile?.role === 'admin' && (
                                <MenuItem icon={Shield} label="Admin Dashboard" tab={NavItem.ADMIN} />
                            )}
                            <MenuItem icon={Settings} label="Settings" tab={NavItem.SETTINGS} />

                            <button
                                onClick={signOut}
                                className="w-full flex items-center justify-center gap-3 p-3.5 rounded-2xl border border-red-500/10 bg-red-500/5 text-red-500 active:bg-red-500/10 transition-colors mt-4 mx-auto"
                            >
                                <LogOut size={16} strokeWidth={2.5} />
                                <span className="font-bold text-sm">Sign Out</span>
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </>
    );
};
