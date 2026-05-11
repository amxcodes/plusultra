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
  FlaskConical,
  Menu,
  Ghost,
  Drama,
  User,
  Shield, // For Admin
  Bell, // Announcements
  Activity, // Activity Log
  BarChart2,
  Newspaper, // News Feed
  MessageSquarePlus,
  MessagesSquare,
  ListVideo,
  Download,
  ArrowUpRight,
  CheckCircle2,
  HardDriveDownload,
  RefreshCw,
  X
} from 'lucide-react';
import { SocialService } from '../lib/social';

interface NavbarProps {
  activeTab: NavItem;
  setActiveTab: (tab: NavItem) => void;
  onSearchClick: () => void;
  messageUnreadCount: number;
}

const NAV_ICONS: Record<NavItem, React.ElementType> = {
  [NavItem.DASHBOARD]: LayoutGrid,
  [NavItem.DOWNLOAD_QUEST]: HardDriveDownload,
  [NavItem.MESSAGES]: MessagesSquare,
  [NavItem.NEWS]: Newspaper, // High priority
  [NavItem.MOVIES]: Clapperboard,
  [NavItem.SERIES]: MonitorPlay,
  [NavItem.ANIME]: Ghost,
  [NavItem.ASIAN_DRAMA]: Drama,
  [NavItem.FOR_YOU]: Zap,
  [NavItem.CURATOR]: FlaskConical,
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
import { useAuth } from '../lib/AuthContext';

const navTooltipClassName = "absolute left-full ml-3 top-1/2 z-[90] -translate-y-1/2 rounded-full border border-white/[0.08] bg-[#18191d]/96 px-3 py-1.5 text-[11px] font-bold tracking-[0.02em] text-white opacity-0 shadow-[0_14px_34px_rgba(0,0,0,0.45)] whitespace-nowrap pointer-events-none transition-all duration-150 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0";
const navArrivalClassName = "absolute left-full ml-3 top-1/2 z-[95] -translate-y-1/2 rounded-full border border-white/[0.1] bg-[#202126]/96 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-100 pointer-events-none whitespace-nowrap shadow-[0_12px_28px_rgba(0,0,0,0.4)]";
const navDividerClassName = "my-1 h-px w-7 shrink-0 bg-white/[0.07]";

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onSearchClick, messageUnreadCount }) => {
  const { profile, user } = useAuth();
  const canStream = profile?.can_stream || profile?.role === 'admin';
  const [unreadCounts, setUnreadCounts] = React.useState({ announcementsCount: 0, activityCount: 0 });
  const [showDesktopUpdatePopover, setShowDesktopUpdatePopover] = React.useState(false);
  const [updateStatus, setUpdateStatus] = React.useState<string | null>(null);
  const [updatePhase, setUpdatePhase] = React.useState<string>('idle');
  const [isCheckingForUpdate, setIsCheckingForUpdate] = React.useState(false);
  const [isUpdateActionPending, setIsUpdateActionPending] = React.useState(false);
  const [currentDesktopVersion, setCurrentDesktopVersion] = React.useState<string | null>(null);
  const [latestDesktopVersion, setLatestDesktopVersion] = React.useState<string | null>(null);
  const [desktopDownloadProgress, setDesktopDownloadProgress] = React.useState<number | null>(null);
  const [showMoreNav, setShowMoreNav] = React.useState(false);
  const profileButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const updatePopoverRef = React.useRef<HTMLDivElement | null>(null);
  const moreButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const morePopoverRef = React.useRef<HTMLDivElement | null>(null);
  const isDesktop = Boolean(window.desktop?.isDesktop);

  // Fetch unread counts
  React.useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;

    const fetchUnreadCounts = async () => {
      try {
        const counts = await SocialService.getUnreadCounts(user.id);
        if (isMounted) {
          setUnreadCounts(counts);
        }
      } catch (error) {
        console.error('Failed to fetch unread counts:', error);
      }
    };

    fetchUnreadCounts();

    const unsubscribe = SocialService.subscribeToUnreadCountChanges(user.id, () => {
      void fetchUnreadCounts();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [user?.id]);

  React.useEffect(() => {
    if (!isDesktop || !window.desktop) {
      return;
    }

    const unsubscribe = window.desktop.onUpdateState((payload) => {
      setUpdatePhase(payload.status || 'idle');
      setCurrentDesktopVersion(payload.currentVersion || null);
      setLatestDesktopVersion(payload.latestVersion || null);
      setUpdateStatus(payload.message || null);
      setDesktopDownloadProgress(payload.downloadProgress ?? null);
      setIsCheckingForUpdate(payload.status === 'checking');
      if (payload.status !== 'checking' && payload.status !== 'downloading') {
        setIsUpdateActionPending(false);
      }
    });

    return () => unsubscribe();
  }, [isDesktop]);

  React.useEffect(() => {
    if (!showDesktopUpdatePopover && !showMoreNav) {
      return;
    }

    if (showDesktopUpdatePopover && isDesktop && window.desktop) {
      void window.desktop.getUpdateState().then((state) => {
        setUpdatePhase(state.status || 'idle');
        setCurrentDesktopVersion(state.currentVersion || null);
        setLatestDesktopVersion(state.latestVersion || null);
        setUpdateStatus(state.message || null);
        setDesktopDownloadProgress(state.downloadProgress ?? null);
        setIsCheckingForUpdate(state.status === 'checking');
      }).catch(() => {
        // Ignore initial state fetch failures and rely on explicit check result.
      });
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        !updatePopoverRef.current?.contains(target) &&
        !profileButtonRef.current?.contains(target) &&
        !morePopoverRef.current?.contains(target) &&
        !moreButtonRef.current?.contains(target)
      ) {
        setShowDesktopUpdatePopover(false);
        setShowMoreNav(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [isDesktop, showDesktopUpdatePopover, showMoreNav]);

  // DRY helper for adaptive button styles on short/zoomed screens.
  const getNavButtonClass = (isActive: boolean, variant: 'default' | 'activity' = 'default') => 
    `relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-[background-color,border-color,color,transform] duration-200 [@media(max-height:850px)]:h-9 [@media(max-height:850px)]:w-9 [@media(max-height:720px)]:h-8 [@media(max-height:720px)]:w-8 ${
      isActive 
        ? 'border-white/[0.16] bg-[#303137] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]' 
        : variant === 'activity'
          ? 'border-white/[0.055] bg-[linear-gradient(145deg,rgba(255,255,255,0.085),rgba(255,255,255,0.025)_58%,rgba(255,255,255,0.065))] text-zinc-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-white/[0.12] hover:bg-[#242529] hover:text-zinc-100'
          : 'border-transparent bg-transparent text-zinc-500 hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-zinc-100'
    }`;

  const getIconSize = () => {
    if (typeof window !== 'undefined') {
      if (window.innerHeight <= 720) return 13;
      if (window.innerHeight <= 850) return 14;
    }
    return 17;
  };
  const iconSize = getIconSize();
  const isDownloadingUpdate = updatePhase === 'downloading';
  const getNavArrivalLabel = (count: number, singular: string, plural: string) => {
    if (count <= 0) return null;
    const quantity = count > 9 ? '9+' : String(count);
    return `${quantity} ${count === 1 ? singular : plural}`;
  };
  const messagesArrivalLabel = activeTab === NavItem.MESSAGES
    ? null
    : getNavArrivalLabel(messageUnreadCount, 'new message', 'new messages');
  const canDownloadUpdate = updatePhase === 'available';
  const canInstallUpdate = updatePhase === 'downloaded';
  const primaryUpdateLabel = (() => {
    if (isCheckingForUpdate) return 'Checking...';
    if (isDownloadingUpdate) {
      return desktopDownloadProgress !== null
        ? `Downloading ${desktopDownloadProgress}%`
        : 'Downloading...';
    }
    if (canInstallUpdate) return 'Restart to update';
    if (canDownloadUpdate) return 'Download update';
    return 'Check for updates';
  })();
  const PrimaryUpdateIcon = canInstallUpdate
    ? CheckCircle2
    : canDownloadUpdate
      ? ArrowUpRight
      : Download;
  const handlePrimaryUpdateAction = async () => {
    if (!window.desktop || isCheckingForUpdate || isUpdateActionPending) {
      return;
    }

    setIsUpdateActionPending(true);

    try {
      if (canInstallUpdate) {
        setUpdateStatus('Restarting to install the update...');
        const result = await window.desktop.installUpdate();
        setUpdatePhase(result.status || updatePhase);
        setCurrentDesktopVersion(result.currentVersion || currentDesktopVersion);
        setLatestDesktopVersion(result.latestVersion || latestDesktopVersion);
        setDesktopDownloadProgress(result.downloadProgress ?? desktopDownloadProgress);
        setUpdateStatus(result.message || 'Restarting to install the update...');
        return;
      }

      if (canDownloadUpdate) {
        setUpdatePhase('downloading');
        setDesktopDownloadProgress(0);
        setUpdateStatus('Downloading update...');
        const result = await window.desktop.downloadUpdate();
        setUpdatePhase(result.status || updatePhase);
        setCurrentDesktopVersion(result.currentVersion || currentDesktopVersion);
        setLatestDesktopVersion(result.latestVersion || latestDesktopVersion);
        setDesktopDownloadProgress(result.downloadProgress ?? desktopDownloadProgress);
        setUpdateStatus(
          result.ok
            ? (result.message || 'Downloading update...')
            : (result.message || 'Update download failed.')
        );
        return;
      }

      setIsCheckingForUpdate(true);
      setUpdateStatus('Checking for updates...');
      const result = await window.desktop.checkForUpdates();
      setUpdatePhase(result.status || updatePhase);
      setCurrentDesktopVersion(result.currentVersion || currentDesktopVersion);
      setLatestDesktopVersion(result.latestVersion || latestDesktopVersion);
      setDesktopDownloadProgress(result.downloadProgress ?? desktopDownloadProgress);
      setUpdateStatus(
        result.ok
          ? (result.message || 'Update check started.')
          : (result.message || 'Update check failed.')
      );
    } catch (error) {
      setUpdateStatus(error instanceof Error ? error.message : 'Desktop update action failed.');
    } finally {
      setIsCheckingForUpdate(false);
      if (!canInstallUpdate) {
        setIsUpdateActionPending(false);
      }
    }
  };

  React.useEffect(() => {
    if (activeTab === NavItem.ANNOUNCEMENTS && unreadCounts.announcementsCount > 0) {
      setUnreadCounts((prev) => ({ ...prev, announcementsCount: 0 }));
    }

    if (activeTab === NavItem.ACTIVITY && unreadCounts.activityCount > 0) {
      setUnreadCounts((prev) => ({ ...prev, activityCount: 0 }));
    }
  }, [activeTab, unreadCounts.activityCount, unreadCounts.announcementsCount]);

  const isItemAvailable = (item: NavItem) => (
    (item !== NavItem.DOWNLOAD_QUEST || isDesktop) &&
    (item !== NavItem.ADMIN || profile?.role === 'admin') &&
    (item !== NavItem.REQUESTS || canStream) &&
    (item !== NavItem.STATS || canStream)
  );
  const primaryNavItems = [
    NavItem.MESSAGES,
    NavItem.MOVIES,
    NavItem.SERIES,
    NavItem.ANIME,
    NavItem.FOR_YOU,
    NavItem.PLAYLISTS,
    NavItem.STATS,
    NavItem.ACTIVITY,
  ].filter(isItemAvailable);
  const moreNavItems = [
    NavItem.NEWS,
    NavItem.ASIAN_DRAMA,
    NavItem.CURATOR,
    NavItem.REQUESTS,
    NavItem.DOWNLOAD_QUEST,
    NavItem.ANNOUNCEMENTS,
    NavItem.ADMIN,
  ].filter(isItemAvailable);
  const isMoreActive = moreNavItems.includes(activeTab);
  const moreBadgeCount = unreadCounts.announcementsCount;

  const navigateToItem = (item: NavItem) => {
    setActiveTab(item);
    setShowMoreNav(false);

    if (item === NavItem.ANNOUNCEMENTS) {
      setUnreadCounts(prev => ({ ...prev, announcementsCount: 0 }));
    }

    if (item === NavItem.ACTIVITY) {
      setUnreadCounts(prev => ({ ...prev, activityCount: 0 }));
    }
  };

  const renderRailItem = (item: NavItem) => {
    const Icon = NAV_ICONS[item];
    const isActive = activeTab === item;
    const showMessageBadge = item === NavItem.MESSAGES && Boolean(messagesArrivalLabel);
    const showActivityBadge = item === NavItem.ACTIVITY && activeTab !== NavItem.ACTIVITY && unreadCounts.activityCount > 0;

    return (
      <div key={item} className="relative group flex justify-center w-full">
        <button
          onClick={() => navigateToItem(item)}
          className={getNavButtonClass(isActive, item === NavItem.ACTIVITY ? 'activity' : 'default')}
          aria-label={item}
        >
          <Icon
            size={iconSize}
            strokeWidth={isActive ? 2 : 1.6}
          />
        </button>

        {showMessageBadge && (
          <div className={navArrivalClassName}>
            {messagesArrivalLabel}
          </div>
        )}

        {showActivityBadge && (
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-white" />
        )}

        <div className={navTooltipClassName}>
          {item}
        </div>
      </div>
    );
  };

  return (
    <nav className="fixed left-3 top-1/2 z-[60] isolate hidden min-h-[clamp(520px,78dvh,760px)] max-h-[calc(100dvh-1rem)] w-[clamp(52px,4.8vw,66px)] -translate-y-1/2 overflow-visible rounded-[30px] border border-white/[0.09] bg-[#111216]/98 py-4 shadow-[0_18px_56px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.07)] md:flex md:flex-col md:items-center [@media(max-height:760px)]:min-h-[calc(100dvh-1rem)] [@media(max-height:760px)]:py-2">

      {/* Top: Home/Logo */}
      <div className="mb-2 shrink-0 [@media(max-height:760px)]:mb-1">
        <button
          onClick={() => setActiveTab(NavItem.DASHBOARD)}
          className={getNavButtonClass(activeTab === NavItem.DASHBOARD)}
          aria-label="Dashboard"
        >
          <LayoutGrid size={iconSize} strokeWidth={activeTab === NavItem.DASHBOARD ? 2 : 1.6} />
        </button>
      </div>

      {/* Middle: core navigation. Lower-frequency routes live in the More flyout so the rail never scrolls. */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-1.5 [@media(max-height:760px)]:gap-1">

        {/* Search - Distinct */}
        <div className="relative group flex justify-center w-full">
          <button
            onClick={onSearchClick}
            className={getNavButtonClass(false)}
            aria-label="Search"
          >
            <Search size={iconSize} strokeWidth={1.6} />
          </button>

          {/* Tooltip */}
          <div className={navTooltipClassName}>
            Search
          </div>
        </div>

        {/* Divider */}
        <div className={navDividerClassName}></div>

        {primaryNavItems.map(renderRailItem)}

        <div className={navDividerClassName}></div>

        <div className="relative group flex justify-center w-full">
          <button
            ref={moreButtonRef}
            onClick={() => {
              setShowMoreNav((current) => !current);
              setShowDesktopUpdatePopover(false);
            }}
            className={getNavButtonClass(isMoreActive || showMoreNav)}
            aria-label="More navigation"
            aria-expanded={showMoreNav}
          >
            <Menu size={iconSize} strokeWidth={isMoreActive || showMoreNav ? 2 : 1.6} />
            {moreBadgeCount > 0 && (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-white" />
            )}
          </button>

          <div className={navTooltipClassName}>
            More
          </div>

          {showMoreNav && (
            <div
              ref={morePopoverRef}
              className="absolute left-full top-1/2 z-[100] ml-8 w-[330px] -translate-y-1/2 rounded-[34px] border border-white/[0.1] bg-[#111216] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.64),inset_0_1px_0_rgba(255,255,255,0.08)]"
            >
              <div className="mb-2 flex items-center justify-between px-2">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Navigation</div>
                  <div className="mt-0.5 text-sm font-bold text-white">More places</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMoreNav(false)}
                  className="rounded-full border border-white/[0.1] bg-[#242529] p-1.5 text-zinc-400 transition-colors hover:bg-[#2b2c30] hover:text-white"
                  aria-label="Close more navigation"
                >
                  <X size={13} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {moreNavItems.map((item) => {
                  const Icon = NAV_ICONS[item];
                  const isActive = activeTab === item;
                  const itemBadge =
                    item === NavItem.ANNOUNCEMENTS && unreadCounts.announcementsCount > 0
                      ? (unreadCounts.announcementsCount > 9 ? '9+' : String(unreadCounts.announcementsCount))
                      : null;

                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => navigateToItem(item)}
                      className={`flex min-h-[50px] items-center justify-between gap-2 rounded-[22px] border px-3 py-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-[background-color,border-color,color] duration-200 ${
                        isActive
                          ? 'border-white/[0.16] bg-[#2a2b30] text-white'
                          : 'border-white/[0.055] bg-[#1a1b20] text-zinc-400 hover:border-white/[0.12] hover:bg-[#242529] hover:text-white'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${isActive ? 'border-white/[0.12] bg-white/[0.08]' : 'border-white/[0.08] bg-black/15'}`}>
                          <Icon size={15} strokeWidth={isActive ? 2 : 1.6} />
                        </span>
                        <span className="truncate text-[12px] font-bold">{item}</span>
                      </span>
                      {itemBadge && (
                        <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-black leading-none text-black">
                          {itemBadge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: profile/update entry stays fixed; the rest is in More. */}
      <div className="mt-2 flex shrink-0 flex-col items-center gap-1.5 px-1.5 [@media(max-height:760px)]:mt-1 [@media(max-height:760px)]:gap-1">
        <div className={navDividerClassName}></div>

        <div className="relative group flex justify-center w-full">
          <button
            onClick={() => navigateToItem(NavItem.SETTINGS)}
            className={getNavButtonClass(activeTab === NavItem.SETTINGS)}
            aria-label="Settings"
          >
            <Settings size={iconSize} strokeWidth={activeTab === NavItem.SETTINGS ? 2 : 1.6} />
          </button>

          <div className={navTooltipClassName}>
            Settings
          </div>
        </div>

        {/* Profile */}
        <div className="relative group flex justify-center w-full mt-1 [@media(max-height:750px)]:mt-0">
          <button
            ref={profileButtonRef}
            onClick={() => {
              if (isDesktop) {
                setShowDesktopUpdatePopover((current) => !current);
                return;
              }

              setActiveTab(NavItem.PROFILE);
            }}
            className={`rounded-full border p-1 transition-[border-color,background-color] duration-200 [@media(max-height:760px)]:p-0.5 ${activeTab === NavItem.PROFILE ? 'border-white/40 bg-white/[0.06]' : 'border-transparent hover:border-white/20 hover:bg-white/[0.05]'}`}
            aria-label={isDesktop ? 'Desktop update and profile' : 'Profile'}
          >
          <div className="h-7 w-7 overflow-hidden rounded-full bg-zinc-800 [@media(max-height:760px)]:h-6 [@media(max-height:760px)]:w-6">
            <img
              src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.username || 'User'}&background=10b981&color=fff&bold=true`}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          </div>
        </button>
        
        {/* Profile Tooltip - Add tooltip to Profile since it has a smaller icon style but sits in the sequence */}
        <div className={navTooltipClassName}>
          Profile
        </div>

        {isDesktop && showDesktopUpdatePopover && (
          <div
            ref={updatePopoverRef}
            className="absolute left-[78px] bottom-0 z-[90] w-[320px] overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(39,39,42,0.97),rgba(24,24,27,0.95))] text-white shadow-[0_24px_70px_rgba(0,0,0,0.7)] backdrop-blur-xl"
          >
            <div className="absolute inset-x-0 top-0 h-16 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.09),transparent_70%)] pointer-events-none" />
            <div className="relative p-4 pt-5">
              <div className="flex items-start justify-between gap-3 pr-10">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-300">
                    Desktop Update
                  </div>
                  <div className="mt-3 text-[15px] font-semibold tracking-tight text-white">
                    Keep this desktop build current.
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                    Check GitHub releases, compare versions, and install the latest build when available.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] px-2.5 py-2 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                    Running
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {currentDesktopVersion ? `v${currentDesktopVersion}` : 'Unknown'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDesktopUpdatePopover(false)}
                className="absolute right-3 top-3 rounded-full border border-white/10 bg-black/20 p-1.5 text-zinc-400 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
                aria-label="Close update prompt"
              >
                <X size={14} />
              </button>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                    Current
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {currentDesktopVersion ? `v${currentDesktopVersion}` : 'Unknown'}
                  </div>
                </div>
                <div className="rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                    Latest
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {latestDesktopVersion ? `v${latestDesktopVersion}` : 'Not checked'}
                  </div>
                </div>
              </div>

              {updateStatus && (
                <div className="mt-3 rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.065),rgba(255,255,255,0.025))] px-3 py-3 text-[11px] leading-relaxed text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  {updateStatus}
                </div>
              )}

              {isDownloadingUpdate && (
                <div className="mt-3">
                  <div className="h-2 overflow-hidden rounded-full border border-white/5 bg-white/10">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0.92),rgba(161,161,170,0.85))] transition-[width] duration-300"
                      style={{ width: `${desktopDownloadProgress ?? 0}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                    Download progress {desktopDownloadProgress ?? 0}%
                  </div>
                </div>
              )}

              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrimaryUpdateAction}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-[18px] border border-white/15 bg-[linear-gradient(180deg,#ffffff,#d4d4d8)] px-3 py-3 text-xs font-semibold text-black shadow-[0_8px_22px_rgba(255,255,255,0.12)] transition-all hover:scale-[1.01] hover:border-white/30 hover:shadow-[0_12px_28px_rgba(255,255,255,0.18)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isCheckingForUpdate || isUpdateActionPending}
                >
                  <PrimaryUpdateIcon
                    size={14}
                    className={isDownloadingUpdate ? 'animate-spin' : ''}
                  />
                  <span>{primaryUpdateLabel}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowDesktopUpdatePopover(false);
                    setActiveTab(NavItem.PROFILE);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-3 py-3 text-xs font-semibold text-white transition-all hover:border-white/20 hover:bg-white/10"
                >
                  <User size={13} />
                  Open profile
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </nav>
  );
};
