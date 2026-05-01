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

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onSearchClick }) => {
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
  const profileButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const updatePopoverRef = React.useRef<HTMLDivElement | null>(null);
  const isDesktop = Boolean(window.desktop?.isDesktop);

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
    // Refresh every 30 seconds
    const interval = setInterval(fetchUnreadCounts, 30000);
    return () => clearInterval(interval);
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
    if (!showDesktopUpdatePopover) {
      return;
    }

    if (isDesktop && window.desktop) {
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
        !profileButtonRef.current?.contains(target)
      ) {
        setShowDesktopUpdatePopover(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [isDesktop, showDesktopUpdatePopover]);

  // DRY helper for adaptive button styles on short screens
  const getNavButtonClass = (isActive: boolean) => 
    `p-2.5 [@media(max-height:850px)]:p-2 [@media(max-height:750px)]:p-1.5 rounded-[14px] transition-all duration-300 relative flex justify-center items-center border ${
      isActive 
        ? 'bg-gradient-to-b from-white/15 to-white/5 border-white/10 text-white shadow-[0_4px_12px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] scale-[1.02]' 
        : 'border-transparent text-zinc-500 hover:text-zinc-200 hover:bg-white/5'
    }`;

  const getIconSize = () => {
    if (typeof window !== 'undefined') {
      if (window.innerHeight <= 750) return 14;
      if (window.innerHeight <= 850) return 15;
    }
    return 16;
  };
  const iconSize = getIconSize();
  const isDownloadingUpdate = updatePhase === 'downloading';
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

  return (
    <nav className="fixed left-4 top-4 bottom-4 z-[60] w-[64px] flex flex-col items-center py-4 bg-[#0a0a0a]/80 backdrop-blur-2xl rounded-[24px] border border-white/5 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]">

      {/* Top: Home/Logo */}
      <div className="mb-2 [@media(max-height:850px)]:mb-1 [@media(max-height:750px)]:mb-0">
        <button
          onClick={() => setActiveTab(NavItem.DASHBOARD)}
          className={getNavButtonClass(activeTab === NavItem.DASHBOARD)}
        >
          <LayoutGrid size={iconSize} strokeWidth={activeTab === NavItem.DASHBOARD ? 2 : 1.5} className={activeTab === NavItem.DASHBOARD ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : ""} />
        </button>
      </div>

      {/* Middle: Navigation */}
      <div className="flex flex-col items-center gap-2 [@media(max-height:850px)]:gap-1.5 [@media(max-height:750px)]:gap-1 flex-1 w-full px-2">

        {/* Search - Distinct */}
        <div className="relative group flex justify-center w-full">
          <button
            onClick={onSearchClick}
            className={getNavButtonClass(false)}
          >
            <Search size={iconSize} strokeWidth={1.5} />
          </button>

          {/* Tooltip */}
          <div className="absolute left-[70px] top-1/2 -translate-y-1/2 px-3 py-1.5 bg-black/90 border border-white/10 rounded-lg text-xs text-white opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 pointer-events-none transition-all duration-200 z-[70] shadow-xl backdrop-blur-md">
            Search
          </div>
        </div>

        {/* Divider */}
        <div className="w-8 h-px bg-white/5 my-1"></div>

        {/* News Feed Button - Specific Placement */}
        <div className="relative group flex justify-center w-full mb-1 [@media(max-height:750px)]:mb-0">
          <button
            onClick={() => setActiveTab(NavItem.NEWS)}
            className={getNavButtonClass(activeTab === NavItem.NEWS)}
          >
            <Newspaper
              size={iconSize}
              strokeWidth={activeTab === NavItem.NEWS ? 2 : 1.5}
              className={activeTab === NavItem.NEWS ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : ""}
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
          (item !== NavItem.DOWNLOAD_QUEST || isDesktop) &&
          (item !== NavItem.ADMIN || profile?.role === 'admin') &&
          (item !== NavItem.REQUESTS || canStream)
        ).map((item) => {
          const Icon = NAV_ICONS[item];
          const isActive = activeTab === item;

          return (
            <div key={item} className="relative group flex justify-center w-full">
              <button
                onClick={() => setActiveTab(item)}
                className={getNavButtonClass(isActive)}
              >
                <Icon
                  size={iconSize}
                  strokeWidth={isActive ? 2 : 1.5}
                  className={isActive ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : ""}
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
      <div className="mt-auto flex flex-col items-center gap-2 [@media(max-height:850px)]:gap-1.5 [@media(max-height:750px)]:gap-1">

        {/* Announcements (Bell) */}
        <div className="relative w-full flex justify-center">
          <button
            onClick={() => {
              setActiveTab(NavItem.ANNOUNCEMENTS);
              setUnreadCounts(prev => ({ ...prev, announcementsCount: 0 }));
            }}
            className={getNavButtonClass(activeTab === NavItem.ANNOUNCEMENTS)}
          >
            <Bell size={iconSize} strokeWidth={activeTab === NavItem.ANNOUNCEMENTS ? 2 : 1.5} className={activeTab === NavItem.ANNOUNCEMENTS ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : ""} />
          </button>
          {unreadCounts.announcementsCount > 0 && (
            <div className="absolute top-1.5 right-[14px] [@media(max-height:750px)]:top-1 [@media(max-height:750px)]:right-3 w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse pointer-events-none" />
          )}
        </div>

        <div className="relative w-full flex justify-center">
          <button
            onClick={() => {
              setActiveTab(NavItem.ACTIVITY);
              setUnreadCounts(prev => ({ ...prev, activityCount: 0 }));
            }}
            className={getNavButtonClass(activeTab === NavItem.ACTIVITY)}
          >
            <Activity size={iconSize} strokeWidth={activeTab === NavItem.ACTIVITY ? 2 : 1.5} className={activeTab === NavItem.ACTIVITY ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : ""} />
          </button>
          {unreadCounts.activityCount > 0 && (
            <div className="absolute top-1.5 right-[14px] [@media(max-height:750px)]:top-1 [@media(max-height:750px)]:right-3 w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse pointer-events-none" />
          )}
        </div>

        <button
          onClick={() => setActiveTab(NavItem.PLAYLISTS)}
          className={getNavButtonClass(activeTab === NavItem.PLAYLISTS)}
        >
          <ListVideo size={iconSize} strokeWidth={activeTab === NavItem.PLAYLISTS ? 2 : 1.5} className={activeTab === NavItem.PLAYLISTS ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : ""} />
        </button>

        {canStream && (
          <button
            onClick={() => setActiveTab(NavItem.STATS)}
            className={getNavButtonClass(activeTab === NavItem.STATS)}
          >
            <BarChart2 size={iconSize} strokeWidth={activeTab === NavItem.STATS ? 2 : 1.5} className={activeTab === NavItem.STATS ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : ""} />
          </button>
        )}

        <button
          onClick={() => setActiveTab(NavItem.SETTINGS)}
          className={getNavButtonClass(activeTab === NavItem.SETTINGS)}
        >
          <Settings size={iconSize} strokeWidth={activeTab === NavItem.SETTINGS ? 2 : 1.5} className={activeTab === NavItem.SETTINGS ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : ""} />
        </button>

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
            className={`p-1 [@media(max-height:750px)]:p-0.5 rounded-full border-2 transition-all duration-300 ${activeTab === NavItem.PROFILE ? 'border-white' : 'border-transparent hover:border-white/50'}`}
          >
          <div className="w-7 h-7 rounded-full bg-zinc-800 overflow-hidden">
            <img
              src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.username || 'User'}&background=10b981&color=fff&bold=true`}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          </div>
        </button>
        
        {/* Profile Tooltip - Add tooltip to Profile since it has a smaller icon style but sits in the sequence */}
        <div className="absolute left-[70px] top-1/2 -translate-y-1/2 px-3 py-1.5 bg-black/90 border border-white/10 rounded-lg text-xs text-white opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 pointer-events-none transition-all duration-200 z-[70] shadow-xl backdrop-blur-md whitespace-nowrap">
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
