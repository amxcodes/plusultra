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
    messageUnreadCount: number;
}

const mobileNavButtonClassName = (isActive: boolean) =>
    `group relative flex h-[clamp(42px,12vw,50px)] w-[clamp(42px,12vw,50px)] items-center justify-center rounded-full border transition-[background-color,border-color,color,transform] duration-200 active:scale-95 ${
        isActive
            ? 'border-white/[0.16] bg-[#2a2b30]/92 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
            : 'border-transparent bg-transparent text-zinc-500 hover:border-white/[0.08] hover:bg-white/[0.055] hover:text-zinc-100'
    }`;

export const MobileNavbar: React.FC<MobileNavbarProps> = ({ activeTab, setActiveTab, onSearchClick, onMenuClick, messageUnreadCount }) => {
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
        <nav className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] z-[60] flex w-full justify-center px-[clamp(0.75rem,4vw,1.5rem)] pointer-events-none md:hidden">
            <div className="relative flex w-full max-w-[min(330px,calc(100vw-1.5rem))] items-center justify-between rounded-full border border-white/[0.08] bg-[#0b0c0f]/92 p-1.5 shadow-[0_18px_46px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)] pointer-events-auto">

                {/* Home */}
                <button
                    onClick={() => setActiveTab(NavItem.DASHBOARD)}
                    className={mobileNavButtonClassName(activeTab === NavItem.DASHBOARD)}
                    aria-label="Dashboard"
                >
                    <LayoutGrid 
                        size={20}
                        strokeWidth={activeTab === NavItem.DASHBOARD ? 2 : 1.6}
                    />
                </button>

                {/* Search */}
                <button
                    onClick={onSearchClick}
                    className={mobileNavButtonClassName(false)}
                    aria-label="Search"
                >
                    <Search 
                        size={20}
                        strokeWidth={1.6}
                    />
                </button>

                {/* Menu */}
                <button
                    onClick={onMenuClick}
                    className={mobileNavButtonClassName(isMenuTabActive)}
                    aria-label="Menu"
                >
                    <Menu 
                        size={20}
                        strokeWidth={isMenuTabActive ? 2 : 1.6}
                    />
                    {messageUnreadCount > 0 && (
                        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-black/30 bg-white px-1 text-[9px] font-black leading-none text-black">
                            {messageUnreadCount > 9 ? '9+' : messageUnreadCount}
                        </span>
                    )}
                </button>

            </div>
        </nav>
    );
};
