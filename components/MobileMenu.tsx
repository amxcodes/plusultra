
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
    MessageSquarePlus
} from 'lucide-react';

interface MobileMenuProps {
    isOpen: boolean;
    onClose: () => void;
    activeTab: NavItem;
    setActiveTab: (tab: NavItem) => void;
}

export const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose, activeTab, setActiveTab }) => {
    const { user, profile, signOut } = useAuth();

    if (!isOpen) return null;

    const handleNav = (tab: NavItem) => {
        setActiveTab(tab);
        onClose();
    };

    const MenuItem = ({ icon: Icon, label, tab, badge }: { icon: any, label: string, tab: NavItem, badge?: string }) => (
        <button
            onClick={() => handleNav(tab)}
            className={`w-full flex items-center justify-between p-4 rounded-xl transition-all active:scale-95 border ${activeTab === tab
                ? 'bg-white text-black border-transparent shadow-lg'
                : 'bg-zinc-900/50 text-zinc-300 border-white/5'
                }`}
        >
            <div className="flex items-center gap-4">
                <Icon size={18} strokeWidth={activeTab === tab ? 2.5 : 2} />
                <span className="font-bold text-sm">{label}</span>
            </div>
            <div className="flex items-center gap-2">
                {badge && <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">{badge}</span>}
                <ChevronRight size={14} className="opacity-50" />
            </div>
        </button>
    );

    return (
        <div className="fixed inset-0 z-[70] bg-[#0f1014] animate-in slide-in-from-bottom duration-300 flex flex-col custom-scrollbar">

            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-2">
                <h2 className="text-2xl font-black text-white tracking-tight">Menu</h2>
                <button
                    onClick={onClose}
                    className="p-2 bg-zinc-900 rounded-full text-zinc-400 border border-white/10 active:bg-zinc-800"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 pb-32 space-y-8 custom-scrollbar">

                {/* Profile Section */}
                <div
                    onClick={() => handleNav(NavItem.PROFILE)}
                    className="flex items-center gap-4 p-4 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl border border-white/10 cursor-pointer active:scale-95 transition-transform"
                >
                    <div className="w-14 h-14 rounded-full bg-black border-2 border-white/10 overflow-hidden">
                        <img
                            src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.username || 'User'}`}
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div>
                        <div className="text-lg font-bold text-white leading-none mb-1">{profile?.username || 'Guest'}</div>
                        <div className="text-xs text-zinc-500 font-medium">View Profile</div>
                    </div>
                </div>

                {/* Main Navigation */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Browse</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <MenuItem icon={LayoutGrid} label="Home" tab={NavItem.DASHBOARD} />
                        <MenuItem icon={Zap} label="For You" tab={NavItem.FOR_YOU} />
                        <MenuItem icon={Newspaper} label="News Feed" tab={NavItem.NEWS} />
                        <MenuItem icon={MessageSquarePlus} label="Requests" tab={NavItem.REQUESTS} />
                    </div>
                </div>

                {/* Library Section */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Library</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <MenuItem icon={Clapperboard} label="Movies" tab={NavItem.MOVIES} />
                        <MenuItem icon={MonitorPlay} label="Series" tab={NavItem.SERIES} />
                        <MenuItem icon={Ghost} label="Anime" tab={NavItem.ANIME} />
                        <MenuItem icon={Drama} label="Asian Drama" tab={NavItem.ASIAN_DRAMA} />
                        <MenuItem icon={ListVideo} label="Playlists" tab={NavItem.PLAYLISTS} />
                    </div>
                </div>

                {/* Activity & Social */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Social</h3>
                    <div className="space-y-3">
                        <MenuItem icon={Bell} label="Announcements" tab={NavItem.ANNOUNCEMENTS} />
                        <MenuItem icon={Activity} label="Activity Log" tab={NavItem.ACTIVITY} />
                        <MenuItem icon={BarChart2} label="Stats Dashboard" tab={NavItem.STATS} />
                    </div>
                </div>

                {/* App Controls */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">App</h3>
                    <div className="space-y-3">
                        {profile?.role === 'admin' && (
                            <MenuItem icon={Shield} label="Admin Dashboard" tab={NavItem.ADMIN} />
                        )}
                        <MenuItem icon={Settings} label="Settings" tab={NavItem.SETTINGS} />

                        <button
                            onClick={signOut}
                            className="w-full flex items-center gap-4 p-4 rounded-xl border border-red-500/10 bg-red-500/5 text-red-500 active:bg-red-500/10 transition-colors"
                        >
                            <LogOut size={18} />
                            <span className="font-bold text-sm">Sign Out</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
