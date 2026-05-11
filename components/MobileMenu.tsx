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
    MessagesSquare,
    Bot
} from 'lucide-react';

interface MobileMenuProps {
    isOpen: boolean;
    onClose: () => void;
    activeTab: NavItem;
    setActiveTab: (tab: NavItem) => void;
    messageUnreadCount: number;
}

export const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose, activeTab, setActiveTab, messageUnreadCount }) => {
    const { user, profile, signOut } = useAuth();
    const canStream = profile?.can_stream || profile?.role === 'admin';

    if (!isOpen) return null;

    const handleNav = (tab: NavItem) => {
        setActiveTab(tab);
    };

    const MenuItem = ({ icon: Icon, label, tab, badge }: { icon: any, label: string, tab: NavItem, badge?: string }) => (
        <button
            onClick={() => handleNav(tab)}
            className={`flex w-full items-center justify-between rounded-[18px] border p-3 transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.98] ${activeTab === tab
                ? 'border-white/[0.16] bg-[#2a2b30]/92 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                : 'border-transparent bg-white/[0.035] text-zinc-400 hover:border-white/[0.08] hover:bg-white/[0.065] hover:text-white'
                }`}
        >
            <div className="flex items-center gap-3">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full border ${activeTab === tab ? 'border-white/[0.1] bg-white/[0.06]' : 'border-white/[0.05] bg-black/10'}`}>
                    <Icon size={16} strokeWidth={activeTab === tab ? 2 : 1.6} />
                </span>
                <span className="font-bold text-[13px] leading-none">{label}</span>
            </div>
            <div className="flex items-center gap-2">
                {badge && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black leading-none text-black">{badge}</span>}
                <ChevronRight size={14} strokeWidth={1.5} className="opacity-40" />
            </div>
        </button>
    );

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 z-[65] bg-black/55 animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modular Floating Panel */}
            <div className="fixed bottom-[calc(max(1rem,env(safe-area-inset-bottom))+68px)] left-1/2 z-[70] flex max-h-[min(76vh,620px)] w-full max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-col overflow-hidden rounded-[30px] border border-white/[0.08] bg-[#0b0c0f]/96 shadow-[0_22px_64px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.06)] animate-in slide-in-from-bottom-8 fade-in duration-300 sm:max-w-[380px]">

                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/[0.06] bg-transparent p-4">
                    <h2 className="text-[15px] font-black uppercase tracking-[0.2em] text-white">Menu</h2>
                    <button
                        onClick={onClose}
                        className="rounded-full border border-white/[0.08] bg-white/[0.04] p-2 text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-white"
                    >
                        <X size={18} strokeWidth={1.5} />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto p-4 pb-5">

                    {/* Profile Section */}
                    <div
                        onClick={() => handleNav(NavItem.PROFILE)}
                        className="flex cursor-pointer items-center gap-4 rounded-[22px] border border-white/[0.08] bg-white/[0.04] p-3.5 transition-[background-color,border-color,transform] duration-200 active:scale-[0.99] hover:border-white/[0.14] hover:bg-white/[0.065]"
                    >
                        <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-full border border-white/15 bg-black">
                            <img
                                src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.username || 'User'}`}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="min-w-0">
                            <div className="mb-0.5 truncate text-[15px] font-bold tracking-wide text-white">{profile?.username || 'Guest'}</div>
                            <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">View Profile</div>
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
                            <MenuItem icon={MessagesSquare} label="Messages" tab={NavItem.MESSAGES} badge={messageUnreadCount > 0 ? (messageUnreadCount > 9 ? '9+' : String(messageUnreadCount)) : undefined} />
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
                                className="w-full flex items-center justify-center gap-3 p-3.5 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all duration-300 mt-4 mx-auto"
                            >
                                <LogOut size={16} strokeWidth={1.5} />
                                <span className="font-bold text-[13px] tracking-wide">Sign Out</span>
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </>
    );
};
