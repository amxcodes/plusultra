import React from 'react';
import { Bell, Clapperboard, Home, Menu, Search, Settings, Tv, Bookmark, ListVideo, BarChart2, Newspaper, Activity, MessageSquarePlus, Shield, MessagesSquare } from 'lucide-react';
import { NavItem, Profile } from '../../../types';
import { StudioButton } from '../system/StudioButton';
import { StudioDropdownContent, StudioDropdownItem, StudioDropdownRoot, StudioDropdownTrigger } from '../system/StudioControls';
import { cn } from '../../../lib/utils';

interface StudioHeaderProps {
  activeTab: NavItem;
  setActiveTab: (tab: NavItem) => void;
  onSearchClick: () => void;
  messageUnreadCount: number;
  profile?: Profile | null;
  canStream?: boolean;
}

const primaryItems = [
  { item: NavItem.DASHBOARD, label: 'Home', icon: Home },
  { item: NavItem.MOVIES, label: 'Movies', icon: Clapperboard },
  { item: NavItem.SERIES, label: 'Series', icon: Tv },
  { item: NavItem.MY_LIST, label: 'My List', icon: Bookmark },
  { item: NavItem.PLAYLISTS, label: 'Playlists', icon: ListVideo },
];

const moreItems = [
  { item: NavItem.MESSAGES, icon: MessagesSquare },
  { item: NavItem.NEWS, icon: Newspaper },
  { item: NavItem.STATS, icon: BarChart2 },
  { item: NavItem.ACTIVITY, icon: Activity },
  { item: NavItem.REQUESTS, icon: MessageSquarePlus },
  { item: NavItem.ANNOUNCEMENTS, icon: Bell },
  { item: NavItem.ADMIN, icon: Shield },
];

export const StudioHeader: React.FC<StudioHeaderProps> = ({ activeTab, setActiveTab, onSearchClick, messageUnreadCount, profile, canStream }) => {
  const isDesktop = typeof window !== 'undefined' && Boolean(window.desktop?.isDesktop);
  const visibleMoreItems = moreItems.filter(({ item }) => (
    (item !== NavItem.ADMIN || profile?.role === 'admin') &&
    (item !== NavItem.REQUESTS || canStream) &&
    (item !== NavItem.STATS || canStream) &&
    (item !== NavItem.DOWNLOAD_QUEST || isDesktop)
  ));

  return (
    <>
      <header className="fixed left-0 right-0 top-4 z-[70] hidden justify-center px-4 md:flex">
        <nav className="studio-glass flex h-14 items-center gap-1 rounded-full px-2">
          <button
            className="mr-1 rounded-full px-4 text-sm font-black tracking-tight text-white"
            onClick={() => setActiveTab(NavItem.DASHBOARD)}
          >
            Plus Ultra
          </button>

          {primaryItems.map(({ item, label, icon: Icon }) => {
            const active = activeTab === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setActiveTab(item)}
                className={cn(
                  'flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold transition-[background-color,border-color,color,box-shadow] duration-200',
                  active
                    ? 'border border-white/80 bg-white text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_8px_22px_rgba(255,255,255,0.12)]'
                    : 'border border-transparent text-white/62 hover:border-white/10 hover:bg-white/[0.08] hover:text-white'
                )}
              >
                <Icon size={15} />
                {label}
              </button>
            );
          })}

          <StudioButton size="icon" variant="ghost" onClick={onSearchClick} aria-label="Search">
            <Search size={17} />
          </StudioButton>

          <StudioDropdownRoot>
            <StudioDropdownTrigger asChild>
              <StudioButton size="icon" variant="ghost" aria-label="More">
                <Menu size={17} />
              </StudioButton>
            </StudioDropdownTrigger>
            <StudioDropdownContent>
              {visibleMoreItems.map(({ item, icon: Icon }) => (
                <StudioDropdownItem key={item} onClick={() => setActiveTab(item)}>
                  <Icon size={15} />
                  <span className="flex-1">{item}</span>
                  {item === NavItem.MESSAGES && messageUnreadCount > 0 && (
                    <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-black text-black">{messageUnreadCount > 9 ? '9+' : messageUnreadCount}</span>
                  )}
                </StudioDropdownItem>
              ))}
            </StudioDropdownContent>
          </StudioDropdownRoot>

          <button
            type="button"
            onClick={() => setActiveTab(NavItem.PROFILE)}
            className="ml-1 h-9 w-9 overflow-hidden rounded-full border border-white/14 bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors hover:border-white/24 hover:bg-white/[0.12]"
            aria-label="Profile"
          >
            <img
              src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.username || 'User'}&background=111827&color=fff&bold=true`}
              alt="Profile"
              className="h-full w-full object-cover"
            />
          </button>
        </nav>
      </header>

      <header className="fixed left-0 right-0 top-3 z-[70] flex justify-center px-3 md:hidden">
        <div className="studio-glass flex h-12 w-full max-w-md items-center justify-between rounded-full px-2">
          <button className="px-3 text-sm font-black text-white" onClick={() => setActiveTab(NavItem.DASHBOARD)}>
            Plus Ultra
          </button>
          <div className="flex items-center gap-1">
            <StudioButton size="icon" variant="ghost" onClick={onSearchClick} aria-label="Search">
              <Search size={17} />
            </StudioButton>
            <StudioButton size="icon" variant="ghost" onClick={() => setActiveTab(NavItem.SETTINGS)} aria-label="Settings">
              <Settings size={17} />
            </StudioButton>
          </div>
        </div>
      </header>
    </>
  );
};

export const StudioBottomDock: React.FC<Pick<StudioHeaderProps, 'activeTab' | 'setActiveTab' | 'messageUnreadCount'>> = ({ activeTab, setActiveTab, messageUnreadCount }) => {
  const dockItems = [
    { item: NavItem.DASHBOARD, icon: Home, label: 'Home' },
    { item: NavItem.MOVIES, icon: Clapperboard, label: 'Movies' },
    { item: NavItem.SERIES, icon: Tv, label: 'Series' },
    { item: NavItem.MESSAGES, icon: MessagesSquare, label: 'Messages' },
    { item: NavItem.MY_LIST, icon: Bookmark, label: 'List' },
  ];

  return (
    <nav className="fixed bottom-4 left-0 right-0 z-[70] flex justify-center px-4 md:hidden">
      <div className="studio-glass flex h-14 items-center gap-1 rounded-full px-2">
        {dockItems.map(({ item, icon: Icon, label }) => {
          const active = activeTab === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => setActiveTab(item)}
              className={cn(
                'relative flex h-10 w-10 items-center justify-center rounded-full border transition-[background-color,border-color,color,box-shadow]',
                active
                  ? 'border-white/80 bg-white text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_8px_22px_rgba(255,255,255,0.12)]'
                  : 'border-transparent text-white/62 hover:border-white/10 hover:bg-white/[0.08] hover:text-white'
              )}
              aria-label={label}
            >
              <Icon size={18} />
              {item === NavItem.MESSAGES && messageUnreadCount > 0 && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--studio-accent)]" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
