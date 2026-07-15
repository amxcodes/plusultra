import React from 'react';
import { Bell, CheckCircle2, Download, HardDriveDownload, Home, LoaderCircle, Search, Settings, Tv, Bookmark, Clapperboard, BarChart2, Newspaper, MessageSquarePlus, Shield, MessagesSquare, Trophy } from 'lucide-react';
import { NavItem, Profile } from '../../../types';
import { StudioButton } from '../system/StudioButton';
import { StudioDropdownContent, StudioDropdownItem, StudioDropdownRoot, StudioDropdownTrigger } from '../system/StudioControls';
import { cn } from '../../../lib/utils';
import { useActivityFeed } from '../../../hooks/useActivityFeed';
import { GlassSurface } from '../system/GlassSurface';
import { getUiPreferences, subscribeToUiPreferences, UiPreferences } from '../../../lib/uiPreferences';

interface StudioHeaderProps {
  activeTab: NavItem;
  setActiveTab: (tab: NavItem) => void;
  onSearchClick: () => void;
  messageUnreadCount: number;
  profile?: Profile | null;
  canStream?: boolean;
}

const primaryItems = [
  { item: NavItem.DASHBOARD, label: 'Home' },
  { item: NavItem.MOVIES, label: 'Movies' },
  { item: NavItem.SERIES, label: 'Series' },
  { item: NavItem.PLAYLISTS, label: 'Discover' },
  { item: NavItem.SETTINGS, label: 'Settings' },
];

const moreItems = [
  { item: NavItem.MESSAGES, icon: MessagesSquare },
  { item: NavItem.NEWS, icon: Newspaper },
  { item: NavItem.SPORTS, icon: Trophy },
  { item: NavItem.STATS, icon: BarChart2 },
  { item: NavItem.REQUESTS, icon: MessageSquarePlus },
  { item: NavItem.DOWNLOAD_QUEST, icon: HardDriveDownload },
  { item: NavItem.ANNOUNCEMENTS, icon: Bell },
  { item: NavItem.ADMIN, icon: Shield },
];

const formatActivityTime = (value?: string | null) => {
  if (!value) return '';
  const diffMinutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (diffMinutes < 1) return 'now';
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return `${Math.floor(diffHours / 24)}d`;
};

type UpdateState = {
  status: string;
  currentVersion: string;
  latestVersion: string | null;
  message: string | null;
  downloadProgress: number | null;
};

const idleUpdateState: UpdateState = { status: 'idle', currentVersion: '', latestVersion: null, message: null, downloadProgress: null };

const glassTuning = (preferences: UiPreferences) => {
  const intensity = {
    subtle: { backgroundOpacity: 0.03, saturation: 1.12, blur: 10 },
    standard: { backgroundOpacity: 0.052, saturation: 1.22, blur: 13 },
    strong: { backgroundOpacity: 0.078, saturation: 1.34, blur: 16 },
  }[preferences.glassIntensity];
  const refraction = {
    calm: { distortionScale: -12, redOffset: 0, greenOffset: 1, blueOffset: 2 },
    balanced: { distortionScale: -22, redOffset: 0, greenOffset: 2, blueOffset: 4 },
    deep: { distortionScale: -34, redOffset: 1, greenOffset: 3, blueOffset: 6 },
  }[preferences.glassRefraction];
  return { ...intensity, ...refraction };
};

export const StudioHeader: React.FC<StudioHeaderProps> = ({ activeTab, setActiveTab, onSearchClick, messageUnreadCount, profile, canStream }) => {
  const isDesktop = typeof window !== 'undefined' && Boolean(window.desktop?.isDesktop);
  const [preferences, setPreferences] = React.useState<UiPreferences>(() => getUiPreferences());
  const [activityTab, setActivityTab] = React.useState<'notifications' | 'followers' | 'following' | 'updates'>('notifications');
  const [updateState, setUpdateState] = React.useState<UpdateState>(idleUpdateState);
  const { feedNotifications, requestNotifications, followers, following, isLoading } = useActivityFeed();
  const activityItems = [...requestNotifications, ...feedNotifications].slice(0, 6);
  const updateAvailable = ['available', 'downloading', 'downloaded'].includes(updateState.status);
  const activityCount = requestNotifications.length + feedNotifications.filter(item => !item.is_read).length + (updateAvailable ? 1 : 0);
  const visibleMoreItems = moreItems.filter(({ item }) => (
    (item !== NavItem.ADMIN || profile?.role === 'admin') &&
    (item !== NavItem.REQUESTS || canStream) &&
    (item !== NavItem.STATS || canStream) &&
    (item !== NavItem.SPORTS || canStream) &&
    (item !== NavItem.DOWNLOAD_QUEST || isDesktop)
  ));
  React.useEffect(() => subscribeToUiPreferences(setPreferences), []);
  React.useEffect(() => {
    if (!isDesktop || !window.desktop) return;
    let active = true;
    void window.desktop.getUpdateState().then((state) => active && setUpdateState(state));
    const unsubscribe = window.desktop.onUpdateState((state) => active && setUpdateState(state));
    void window.desktop.checkForUpdates();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [isDesktop]);
  const glass = glassTuning(preferences);

  const handleUpdateAction = async () => {
    if (!window.desktop) return;
    if (updateState.status === 'downloaded') {
      await window.desktop.installUpdate();
      return;
    }
    await window.desktop.downloadUpdate();
  };

  return (
    <>
      <header className="fixed left-0 right-0 top-4 z-[70] hidden justify-center px-4 md:flex">
        <GlassSurface
          width="fit-content"
          height={52}
          borderRadius={999}
          borderWidth={0.22}
          brightness={58}
          opacity={0.72}
          backgroundOpacity={glass.backgroundOpacity}
          saturation={glass.saturation}
          blur={glass.blur}
          distortionScale={glass.distortionScale}
          redOffset={glass.redOffset}
          greenOffset={glass.greenOffset}
          blueOffset={glass.blueOffset}
          className="studio-nav-liquid studio-header-liquid"
        >
        <nav className="flex h-full items-center gap-5 px-5">
          {primaryItems.map(({ item, label }) => {
            const active = activeTab === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setActiveTab(item)}
                className={cn(
                  'flex h-10 items-center rounded-none border-0 bg-transparent px-0 text-sm font-semibold outline-none transition-colors duration-200 focus-visible:text-white',
                  active
                    ? 'text-white'
                    : 'text-white/64 hover:text-white'
                )}
              >
                {label}
              </button>
            );
          })}

          <button
            type="button"
            onClick={onSearchClick}
            aria-label="Search"
            className="h-10 rounded-none border-0 bg-transparent px-0 text-sm font-semibold text-white/64 outline-none transition-colors hover:text-white focus-visible:text-white"
          >
            Search
          </button>

          <StudioDropdownRoot modal={false}>
            <StudioDropdownTrigger asChild>
              <button
                type="button"
                aria-label="More"
                className="h-10 rounded-none border-0 bg-transparent px-0 text-sm font-semibold text-white/64 outline-none transition-colors hover:text-white focus-visible:text-white"
              >
                More
              </button>
            </StudioDropdownTrigger>
            <StudioDropdownContent collisionPadding={16}>
              {visibleMoreItems.map(({ item }) => (
                <StudioDropdownItem key={item} onClick={() => setActiveTab(item)}>
                  <span className="flex-1">{item}</span>
                  {item === NavItem.MESSAGES && messageUnreadCount > 0 && (
                    <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-black text-black">{messageUnreadCount > 9 ? '9+' : messageUnreadCount}</span>
                  )}
                </StudioDropdownItem>
              ))}
            </StudioDropdownContent>
          </StudioDropdownRoot>

          <StudioDropdownRoot modal={false}>
            <StudioDropdownTrigger asChild>
              <button
                type="button"
                aria-label="Activity"
                className="relative flex h-10 w-7 items-center justify-center rounded-none border-0 bg-transparent text-white/64 outline-none transition-colors hover:text-white focus-visible:text-white"
              >
                <Bell size={17} />
                {activityCount > 0 && <span className="absolute right-0 top-2 h-1.5 w-1.5 rounded-full bg-white" />}
              </button>
            </StudioDropdownTrigger>
            <StudioDropdownContent collisionPadding={16} className="w-[340px]">
              <div className="px-2 pb-2 pt-1">
                <div className="text-[11px] font-bold uppercase text-white/42">Activity</div>
                <div className="mt-1 text-sm font-semibold text-white">Quick panel</div>
                <div className={`mt-3 grid gap-1 rounded-full border border-white/8 bg-black/28 p-1 ${isDesktop ? 'grid-cols-4' : 'grid-cols-3'}`}>
                  {[
                    ['notifications', 'Alerts'],
                    ['followers', 'Followers'],
                    ['following', 'Following'],
                    ...(isDesktop ? [['updates', 'Updates']] : []),
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setActivityTab(value as typeof activityTab)}
                      className={`rounded-full px-2 py-1.5 text-xs font-bold transition-colors ${activityTab === value ? 'bg-white text-black' : 'text-white/50 hover:text-white'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-[320px] overflow-y-auto pr-1 studio-scrollbar">
                {isLoading ? (
                  <div className="space-y-2 p-2">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="h-14 animate-pulse rounded-[18px] bg-white/[0.055]" />
                    ))}
                  </div>
                ) : activityTab === 'updates' && isDesktop ? (
                  <div className="p-2">
                    <div className="rounded-[16px] border border-white/10 bg-white/[0.045] p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-white/78">
                          {updateState.status === 'downloading' ? <LoaderCircle size={16} className="animate-spin" /> : updateState.status === 'downloaded' ? <CheckCircle2 size={16} /> : <Download size={16} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-white">{updateAvailable ? `Plus Ultra ${updateState.latestVersion || ''}` : 'Plus Ultra is up to date'}</div>
                          <div className="mt-1 text-xs leading-5 text-white/46">{updateState.message || `Version ${updateState.currentVersion || 'current'} is installed.`}</div>
                        </div>
                      </div>
                      {updateState.status === 'downloading' && <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-white transition-[width] duration-300" style={{ width: `${updateState.downloadProgress || 8}%` }} /></div>}
                      {updateAvailable && (
                        <button type="button" onClick={() => void handleUpdateAction()} disabled={updateState.status === 'downloading' || updateState.status === 'installing'} className="mt-3 h-9 w-full rounded-full bg-white text-xs font-bold text-black transition-transform hover:scale-[1.01] disabled:cursor-wait disabled:opacity-60">
                          {updateState.status === 'downloaded' ? 'Install and relaunch' : updateState.status === 'downloading' ? 'Downloading update' : 'Download update'}
                        </button>
                      )}
                    </div>
                  </div>
                ) : activityTab === 'notifications' && activityItems.length > 0 ? (
                  activityItems.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      className="block w-full rounded-[18px] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.08]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="line-clamp-1 text-sm font-semibold text-white/88">{item.title}</div>
                          <div className="mt-0.5 line-clamp-2 text-xs leading-5 text-white/48">{item.message}</div>
                        </div>
                        <div className="shrink-0 text-[10px] font-bold uppercase text-white/34">{formatActivityTime(item.created_at)}</div>
                      </div>
                    </button>
                  ))
                ) : activityTab === 'followers' && followers.length > 0 ? (
                  followers.map(person => (
                    <button key={person.id} type="button" onClick={() => setActiveTab(NavItem.PROFILE)} className="flex w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.08]">
                      <img src={person.avatar_url || `https://ui-avatars.com/api/?name=${person.username || 'User'}&background=111827&color=fff`} alt={person.username} className="h-9 w-9 rounded-full object-cover" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white/88">{person.username}</div>
                        <div className="text-xs text-white/38">Follower</div>
                      </div>
                    </button>
                  ))
                ) : activityTab === 'following' && following.length > 0 ? (
                  following.map(person => (
                    <button key={person.id} type="button" onClick={() => setActiveTab(NavItem.PROFILE)} className="flex w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.08]">
                      <img src={person.avatar_url || `https://ui-avatars.com/api/?name=${person.username || 'User'}&background=111827&color=fff`} alt={person.username} className="h-9 w-9 rounded-full object-cover" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white/88">{person.username}</div>
                        <div className="text-xs text-white/38">Following</div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-[18px] border border-white/8 bg-white/[0.035] p-4 text-sm text-white/48">
                    Nothing here yet.
                  </div>
                )}
              </div>
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
        </GlassSurface>
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
    { item: NavItem.PLAYLISTS, icon: Bookmark, label: 'Playlists' },
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
