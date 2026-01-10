import React from 'react';
import { NavItem } from '../types';
import {
  Search,
  LayoutGrid, // Dashboard/Home
  Clapperboard, // Movies
  MonitorPlay, // Series
  Zap, // Latest (replaced Sparkles)
  Bookmark, // My List
  Settings,
  Bot, // AI/Bot placeholder if needed in future
  Menu,
  Ghost,
  Drama
} from 'lucide-react';

interface NavbarProps {
  activeTab: NavItem;
  setActiveTab: (tab: NavItem) => void;
  onSearchClick: () => void;
}

const NAV_ICONS: Record<NavItem, React.ElementType> = {
  [NavItem.DASHBOARD]: LayoutGrid,
  [NavItem.MOVIES]: Clapperboard,
  [NavItem.SERIES]: MonitorPlay,
  [NavItem.ANIME]: Ghost,
  [NavItem.ASIAN_DRAMA]: Drama,
  [NavItem.LATEST]: Zap,
  [NavItem.MY_LIST]: Bookmark,
  [NavItem.SETTINGS]: Settings,
};

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onSearchClick }) => {
  return (
    <nav className="fixed left-4 top-4 bottom-4 z-[60] w-[64px] flex flex-col items-center py-6 bg-[#0a0a0a]/60 backdrop-blur-2xl rounded-[24px] border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">

      {/* Top: Home/Logo */}
      <div className="mb-8">
        <button
          onClick={() => setActiveTab(NavItem.DASHBOARD)}
          className={`p-3 rounded-2xl transition-all duration-300 ${activeTab === NavItem.DASHBOARD ? 'bg-white text-black shadow-lg shadow-white/10' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
        >
          <LayoutGrid size={20} strokeWidth={activeTab === NavItem.DASHBOARD ? 2.5 : 2} />
        </button>
      </div>

      {/* Middle: Navigation */}
      <div className="flex flex-col items-center gap-4 flex-1 w-full px-2">

        {/* Search - Distinct */}
        <div className="relative group flex justify-center w-full">
          <button
            onClick={onSearchClick}
            className="text-zinc-400 hover:text-white hover:bg-white/5 p-3 rounded-2xl transition-all duration-300"
          >
            <Search size={20} strokeWidth={2} />
          </button>

          {/* Tooltip */}
          <div className="absolute left-[70px] top-1/2 -translate-y-1/2 px-3 py-1.5 bg-black/90 border border-white/10 rounded-lg text-xs text-white opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 pointer-events-none transition-all duration-200 z-[70] shadow-xl backdrop-blur-md">
            Search
          </div>
        </div>

        {/* Divider */}
        <div className="w-8 h-px bg-white/5 my-2"></div>

        {Object.values(NavItem).filter(item => item !== NavItem.DASHBOARD && item !== NavItem.SETTINGS).map((item) => {
          const Icon = NAV_ICONS[item];
          const isActive = activeTab === item;

          return (
            <div key={item} className="relative group flex justify-center w-full">
              <button
                onClick={() => setActiveTab(item)}
                className={`p-3 rounded-2xl transition-all duration-300 relative ${isActive
                  ? 'bg-white text-black shadow-lg shadow-white/10 scale-105'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </button>

              {/* Tooltip */}
              <div className="absolute left-[70px] top-1/2 -translate-y-1/2 px-3 py-1.5 bg-black/90 border border-white/10 rounded-lg text-xs text-white opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 pointer-events-none transition-all duration-200 z-[70] shadow-xl backdrop-blur-md whitespace-nowrap">
                {item}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom: Settings */}
      <div className="mt-auto flex flex-col items-center gap-6">
        <button
          onClick={() => setActiveTab(NavItem.SETTINGS)}
          className={`p-3 rounded-2xl transition-all duration-300 ${activeTab === NavItem.SETTINGS ? 'bg-white text-black shadow-lg shadow-white/10' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
        >
          <Settings size={20} strokeWidth={activeTab === NavItem.SETTINGS ? 2.5 : 2} />
        </button>
      </div>
    </nav>
  );
};