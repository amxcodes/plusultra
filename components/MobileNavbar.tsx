
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
    return (
        <nav className="fixed bottom-0 left-0 right-0 z-[60] pb-safe">
            {/* Gradient Blur Background */}
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black via-black/90 to-transparent pointer-events-none" />

            {/* Navbar Container */}
            <div className="relative px-8 pb-4 pt-2 flex justify-between items-end">

                {/* Home */}
                <button
                    onClick={() => setActiveTab(NavItem.DASHBOARD)}
                    className={`group relative flex flex-col items-center justify-center w-14 h-14 transition-all duration-300 ${activeTab === NavItem.DASHBOARD ? '-translate-y-1' : ''}`}
                >
                    <div className={`p-3 rounded-2xl transition-all duration-300 ${activeTab === NavItem.DASHBOARD
                            ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)] rotate-3'
                            : 'text-zinc-500 hover:text-zinc-300 bg-white/5 border border-white/5'
                        }`}>
                        <LayoutGrid size={20} className={activeTab === NavItem.DASHBOARD ? 'fill-black' : ''} strokeWidth={2.5} />
                    </div>
                </button>

                {/* Pop-out Search - Centerpiece */}
                <div className="relative -top-4 group">
                    <div className="absolute inset-0 bg-white/20 blur-xl rounded-full scale-110 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <button
                        onClick={onSearchClick}
                        className="relative flex items-center justify-center w-16 h-16 bg-white text-black rounded-full shadow-[0_10px_30px_rgba(255,255,255,0.2)] border-[6px] border-[#0f1014] transition-all duration-300 active:scale-95 z-10"
                    >
                        <Search size={26} strokeWidth={3} />
                    </button>
                    {/* Artistic Line deco */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent -z-10" />
                </div>

                {/* Menu */}
                <button
                    onClick={onMenuClick}
                    className={`group relative flex flex-col items-center justify-center w-14 h-14 transition-all duration-300 ${[NavItem.SETTINGS, NavItem.PROFILE, NavItem.ADMIN, NavItem.STATS, NavItem.NEWS, NavItem.FOR_YOU].includes(activeTab)
                            ? '-translate-y-1'
                            : ''
                        }`}
                >
                    <div className={`p-3 rounded-2xl transition-all duration-300 ${[NavItem.SETTINGS, NavItem.PROFILE, NavItem.ADMIN, NavItem.STATS, NavItem.NEWS, NavItem.FOR_YOU].includes(activeTab)
                            ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)] -rotate-3'
                            : 'text-zinc-500 hover:text-zinc-300 bg-white/5 border border-white/5'
                        }`}>
                        <Menu size={20} strokeWidth={2.5} />
                    </div>
                </button>

            </div>
        </nav>
    );
};
