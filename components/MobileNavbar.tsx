import React from 'react';
import { NavItem } from '../types';
import {
    LayoutGrid, // Dashboard/Home
    Search,
    Menu // More/Hamburger
} from 'lucide-react';

interface MobileNavbarProps {
    activeTab: NavItem;
    setActiveTab: (tab: NavItem) => void;
    onSearchClick: () => void;
    onMenuClick: () => void;
}

export const MobileNavbar: React.FC<MobileNavbarProps> = ({ activeTab, setActiveTab, onSearchClick, onMenuClick }) => {
    // Determine if the menu tab is active based on the tabs housed inside the menu
    const isMenuTabActive = [
        NavItem.MOVIES,
        NavItem.SERIES,
        NavItem.ANIME,
        NavItem.ASIAN_DRAMA,
        NavItem.FOR_YOU,
        NavItem.CURATOR,
        NavItem.MESSAGES,
        NavItem.PROFILE,
        NavItem.ADMIN,
        NavItem.ANNOUNCEMENTS,
        NavItem.ACTIVITY,
        NavItem.PLAYLISTS,
        NavItem.STATS,
        NavItem.NEWS,
        NavItem.REQUESTS,
        NavItem.SETTINGS,
    ].includes(activeTab);

    return (
        <nav className="fixed bottom-6 w-full px-6 z-[60] pb-safe flex justify-center pointer-events-none">
            <div className="relative flex items-center justify-between px-6 py-2 bg-[#0a0a0a]/90 backdrop-blur-3xl border border-white/10 rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.8)] w-full max-w-[280px] pointer-events-auto">

                {/* Home */}
                <button
                    onClick={() => setActiveTab(NavItem.DASHBOARD)}
                    className="group relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 active:scale-95"
                >
                    <div className={`absolute inset-0 rounded-full transition-all duration-300 border ${activeTab === NavItem.DASHBOARD ? 'bg-gradient-to-b from-white/15 to-white/5 border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)]' : 'bg-transparent border-transparent group-hover:bg-white/5'}`} />
                    <LayoutGrid 
                        size={22} 
                        className={`relative z-10 transition-colors duration-300 ${activeTab === NavItem.DASHBOARD ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'text-zinc-400 group-hover:text-zinc-200'}`} 
                        strokeWidth={1.5} 
                    />
                </button>

                {/* Search */}
                <button
                    onClick={onSearchClick}
                    className="group relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 active:scale-95"
                >
                    <div className="absolute inset-0 rounded-full transition-colors duration-200 bg-transparent group-hover:bg-white/5 border border-transparent" />
                    <Search 
                        size={22} 
                        strokeWidth={1.5} 
                        className="relative z-10 text-zinc-400 group-hover:text-white transition-colors duration-200" 
                    />
                </button>

                {/* Menu */}
                <button
                    onClick={onMenuClick}
                    className="group relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 active:scale-95"
                >
                    <div className={`absolute inset-0 rounded-full transition-all duration-300 border ${isMenuTabActive ? 'bg-gradient-to-b from-white/15 to-white/5 border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)]' : 'bg-transparent border-transparent group-hover:bg-white/5'}`} />
                    <Menu 
                        size={22} 
                        className={`relative z-10 transition-colors duration-300 ${isMenuTabActive ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'text-zinc-400 group-hover:text-zinc-200'}`} 
                        strokeWidth={1.5} 
                    />
                </button>

            </div>
        </nav>
    );
};
