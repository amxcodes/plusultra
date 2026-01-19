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
  Drama,
  User,
  Shield, // For Admin
  Bell, // Announcements
  Activity, // Activity Log
  Heart,
  BarChart2,
  Newspaper, // News Feed
  MessageSquare,
  MessageSquarePlus
} from 'lucide-react';
import { SocialService } from '../lib/social';

interface NavbarProps {
  activeTab: NavItem;
  setActiveTab: (tab: NavItem) => void;
  onSearchClick: () => void;
}

const NAV_ICONS: Record<NavItem, React.ElementType> = {
  [NavItem.DASHBOARD]: LayoutGrid,
  [NavItem.NEWS]: Newspaper, // High priority
  [NavItem.MOVIES]: Clapperboard,
  [NavItem.SERIES]: MonitorPlay,
  [NavItem.ANIME]: Ghost,
  [NavItem.ASIAN_DRAMA]: Drama,
  [NavItem.FOR_YOU]: Zap,
  [NavItem.MY_LIST]: Bookmark,
  [NavItem.SETTINGS]: Settings,
  [NavItem.PROFILE]: User,
  [NavItem.ADMIN]: Shield,
  [NavItem.ANNOUNCEMENTS]: Bell,
  [NavItem.ACTIVITY]: Activity,
  [NavItem.PLAYLISTS]: ListVideo,
  [NavItem.STATS]: BarChart2,
  [NavItem.REQUESTS]: MessageSquarePlus
};
import { ListVideo } from 'lucide-react';


import { useAuth } from '../lib/AuthContext';

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onSearchClick }) => {
  const { profile, user } = useAuth();
  const canStream = profile?.can_stream || profile?.role === 'admin';
  const [unreadCounts, setUnreadCounts] = React.useState({ announcementsCount: 0, activityCount: 0 });

  // Fetch unread counts
  React.useEffect(() => {
    if (!user?.id) return;
    const fetchUnreadCounts = async () => {
      try {
        const counts = await SocialService.getUnreadCounts(user.id);
        setUnreadCounts(counts);
      } catch (error) {
        console.error('Failed to fetch unread counts:', error);
      }
    };
    fetchUnreadCounts();
    // Refresh every 30 seconds
    const interval = setInterval(fetchUnreadCounts, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  return (
    <nav className="fixed left-4 top-4 bottom-4 z-[60] w-[64px] flex flex-col items-center py-4 bg-[#0a0a0a]/60 backdrop-blur-2xl rounded-[24px] border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">

      {/* Top: Home/Logo */}
      <div className="mb-2">
        <button
          onClick={() => setActiveTab(NavItem.DASHBOARD)}
          className={`p-2 rounded-2xl transition-all duration-300 ${activeTab === NavItem.DASHBOARD ? 'bg-white text-black shadow-lg shadow-white/10' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
        >
          <LayoutGrid size={16} strokeWidth={activeTab === NavItem.DASHBOARD ? 2.5 : 2} />
        </button>
      </div>

      {/* Middle: Navigation */}
      <div className="flex flex-col items-center gap-2 flex-1 w-full px-2">

        {/* Search - Distinct */}
        <div className="relative group flex justify-center w-full">
          <button
            onClick={onSearchClick}
            className="text-zinc-400 hover:text-white hover:bg-white/5 p-2 rounded-2xl transition-all duration-300"
          >
            <Search size={16} strokeWidth={2} />
          </button>

          {/* Tooltip */}
          <div className="absolute left-[70px] top-1/2 -translate-y-1/2 px-3 py-1.5 bg-black/90 border border-white/10 rounded-lg text-xs text-white opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 pointer-events-none transition-all duration-200 z-[70] shadow-xl backdrop-blur-md">
            Search
          </div>
        </div>

        {/* Divider */}
        <div className="w-8 h-px bg-white/5 my-1"></div>

        {/* News Feed Button - Specific Placement */}
        <div className="relative group flex justify-center w-full mb-1">
          <button
            onClick={() => setActiveTab(NavItem.NEWS)}
            className={`p-2 rounded-2xl transition-all duration-300 relative ${activeTab === NavItem.NEWS
              ? 'bg-white text-black shadow-lg shadow-white/10 scale-105'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
          >
            <Newspaper
              size={16}
              strokeWidth={activeTab === NavItem.NEWS ? 2.5 : 2}
            />
          </button>

          <div className="absolute left-[70px] top-1/2 -translate-y-1/2 px-3 py-1.5 bg-black/90 border border-white/10 rounded-lg text-xs text-white opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 pointer-events-none transition-all duration-200 z-[70] shadow-xl backdrop-blur-md whitespace-nowrap">
            News Feed
          </div>
        </div>

        {Object.values(NavItem).filter(item =>
          item !== NavItem.DASHBOARD &&
          item !== NavItem.SETTINGS &&
          item !== NavItem.PROFILE &&
          item !== NavItem.MY_LIST &&
          item !== NavItem.ANNOUNCEMENTS &&
          item !== NavItem.ACTIVITY &&
          item !== NavItem.PLAYLISTS &&
          item !== NavItem.STATS &&
          item !== NavItem.NEWS && // Exclude News from generic loop if we want to place it specifically, OR format if we want it in loop. Let's keep it in loop for now, but user "latest" might be different?
          (item !== NavItem.ADMIN || profile?.role === 'admin') &&
          (item !== NavItem.REQUESTS || canStream)
        ).map((item) => {
          const Icon = NAV_ICONS[item];
          const isActive = activeTab === item;

          return (
            <div key={item} className="relative group flex justify-center w-full">
              <button
                onClick={() => setActiveTab(item)}
                className={`p-2 rounded-2xl transition-all duration-300 relative ${isActive
                  ? 'bg-white text-black shadow-lg shadow-white/10 scale-105'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                <Icon
                  size={16}
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

      {/* Bottom: Settings & Profile */}
      <div className="mt-auto flex flex-col items-center gap-2">

        {/* Announcements (Bell) */}
        <div className="relative">
          <button
            onClick={() => {
              setActiveTab(NavItem.ANNOUNCEMENTS);
              setUnreadCounts(prev => ({ ...prev, announcementsCount: 0 }));
            }}
            className={`p-2 rounded-2xl transition-all duration-300 ${activeTab === NavItem.ANNOUNCEMENTS ? 'bg-white text-black shadow-lg shadow-white/10' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
          >
            <Bell size={16} strokeWidth={activeTab === NavItem.ANNOUNCEMENTS ? 2.5 : 2} />
          </button>
          {unreadCounts.announcementsCount > 0 && (
            <div className="absolute top-2 right-2.5 w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse" />
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => {
              setActiveTab(NavItem.ACTIVITY);
              setUnreadCounts(prev => ({ ...prev, activityCount: 0 }));
            }}
            className={`p-2 rounded-2xl transition-all duration-300 ${activeTab === NavItem.ACTIVITY ? 'bg-white text-black shadow-lg shadow-white/10' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
          >
            <Activity size={16} strokeWidth={activeTab === NavItem.ACTIVITY ? 2.5 : 2} />
          </button>
          {unreadCounts.activityCount > 0 && (
            <div className="absolute top-2 right-2.5 w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse" />
          )}
        </div>

        <button
          onClick={() => setActiveTab(NavItem.PLAYLISTS)}
          className={`p-2 rounded-2xl transition-all duration-300 ${activeTab === NavItem.PLAYLISTS ? 'bg-white text-black shadow-lg shadow-white/10' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
        >
          <ListVideo size={16} strokeWidth={activeTab === NavItem.PLAYLISTS ? 2.5 : 2} />
        </button>

        {canStream && (
          <button
            onClick={() => setActiveTab(NavItem.STATS)}
            className={`p-2 rounded-2xl transition-all duration-300 ${activeTab === NavItem.STATS ? 'bg-white text-black shadow-lg shadow-white/10' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
          >
            <BarChart2 size={16} strokeWidth={activeTab === NavItem.STATS ? 2.5 : 2} />
          </button>
        )}

        <button
          onClick={() => setActiveTab(NavItem.SETTINGS)}
          className={`p-2 rounded-2xl transition-all duration-300 ${activeTab === NavItem.SETTINGS ? 'bg-white text-black shadow-lg shadow-white/10' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
        >
          <Settings size={16} strokeWidth={activeTab === NavItem.SETTINGS ? 2.5 : 2} />
        </button>

        {/* Profile */}
        <button
          onClick={() => setActiveTab(NavItem.PROFILE)}
          className={`p-1 rounded-full border-2 transition-all duration-300 ${activeTab === NavItem.PROFILE ? 'border-white' : 'border-transparent hover:border-white/50'}`}
        >
          <div className="w-7 h-7 rounded-full bg-zinc-800 overflow-hidden">
            <img
              src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.username || 'User'}&background=10b981&color=fff&bold=true`}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          </div>
        </button>
      </div>
    </nav>
  );
};