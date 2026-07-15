import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle2,
  Clock,
  Database,
  Film,
  Globe,
  Heart,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { SocialService } from '../../../lib/social';
import { CommunityService, MovieRequest } from '../../../lib/community';
import { useAuth } from '../../../lib/AuthContext';
import { useToast } from '../../../lib/ToastContext';
import { useConfirm } from '../../../lib/ConfirmContext';
import { WRAPPED_SETTING_KEY } from '../../../lib/wrappedSettings';
import { TmdbService } from '../../../services/tmdb';
import { HealthService, HealthStatus } from '../../../services/health';
import type { AdminAnalyticsEvent, AdminAnalyticsSummary, AdminPresenceUser, AdminProviderAnalytics, AdminViewSession } from '../../../services/AdminService';
import { getDefaultProviderRecords, PlayerProviderRecord } from '../../../lib/playerProviders';
import type { Movie, Profile } from '../../../types';
import type { WatchProgress } from '../../useWatchHistory';
import { GuestAccessAdminPanel } from '../../GuestAccessAdminPanel';
import { ProviderFormModal } from '../../ProviderFormModal';
import { StudioButton } from '../system/StudioButton';
import { StudioSurface } from '../system/StudioSurface';
import { StudioSwitch, StudioTabsContent, StudioTabsList, StudioTabsRoot, StudioTabsTrigger } from '../system/StudioControls';

type AdminTab =
  | 'overview'
  | 'users'
  | 'guests'
  | 'providers'
  | 'content'
  | 'announcements'
  | 'settings'
  | 'requests'
  | 'sessions'
  | 'analytics'
  | 'presence'
  | 'health';

type AppSettings = Record<string, string | undefined | null>;

const ADMIN_TABS: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
  { id: 'overview', label: 'Overview', icon: <Activity size={15} /> },
  { id: 'users', label: 'Users', icon: <Users size={15} /> },
  { id: 'guests', label: 'Guests', icon: <Globe size={15} /> },
  { id: 'providers', label: 'Providers', icon: <Server size={15} /> },
  { id: 'content', label: 'Content', icon: <Film size={15} /> },
  { id: 'announcements', label: 'Alerts', icon: <Megaphone size={15} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={15} /> },
  { id: 'requests', label: 'Requests', icon: <Heart size={15} /> },
  { id: 'sessions', label: 'Sessions', icon: <Clock size={15} /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={15} /> },
  { id: 'presence', label: 'Presence', icon: <Wifi size={15} /> },
  { id: 'health', label: 'Health', icon: <Database size={15} /> },
];

const inputClass =
  'h-11 w-full rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm font-medium text-white outline-none transition focus:border-white/25 focus:bg-white/[0.09] focus:ring-2 focus:ring-white/10 placeholder:text-white/35';

const textareaClass =
  'min-h-[110px] w-full resize-none rounded-[24px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white outline-none transition focus:border-white/25 focus:bg-white/[0.09] focus:ring-2 focus:ring-white/10 placeholder:text-white/35';

const selectClass =
  'h-10 rounded-full border border-white/10 bg-[#111216] px-3 text-sm font-semibold text-white outline-none focus:ring-2 focus:ring-white/10';

const tabContentClass = 'animate-in fade-in slide-in-from-bottom-2 duration-200';

const stopScrollCapture = (event: React.WheelEvent<HTMLElement>) => {
  event.stopPropagation();
};

const nativeScrollProps = {
  'data-studio-native-scroll': 'true',
  onWheel: stopScrollCapture,
} as const;

const formatDate = (value?: string | null) => {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
};

const formatDuration = (seconds = 0) => {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))}s`;
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes % 60}m`;
};

const normalize = (value: unknown) => String(value ?? '').toLowerCase();

const getMovieTitle = (movie: any) => movie?.title || movie?.name || movie?.metadata?.title || movie?.metadata?.name || 'Untitled';

const getPoster = (path?: string | null) => {
  if (!path) return '';
  return path.startsWith('http') ? path : `https://image.tmdb.org/t/p/w342${path}`;
};

const StatusPill: React.FC<{ children: React.ReactNode; tone?: 'good' | 'warn' | 'bad' | 'neutral' }> = ({
  children,
  tone = 'neutral',
}) => {
  const tones = {
    good: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200',
    warn: 'border-amber-300/20 bg-amber-400/10 text-amber-200',
    bad: 'border-red-300/20 bg-red-400/10 text-red-200',
    neutral: 'border-white/10 bg-white/[0.07] text-white/65',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${tones[tone]}`}>
      {children}
    </span>
  );
};

const SectionHeader: React.FC<{
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}> = ({ eyebrow, title, children }) => (
  <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3.5 md:flex-row md:items-center md:justify-between">
    <div>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/32">{eyebrow}</div>
      <h2 className="mt-0.5 text-xl font-black tracking-tight text-white md:text-2xl">{title}</h2>
    </div>
    {children}
  </div>
);

const EmptyState: React.FC<{ label: string }> = ({ label }) => (
  <div className="rounded-[28px] border border-dashed border-white/10 p-8 text-center text-sm font-medium text-white/45">{label}</div>
);

const LoadErrorList: React.FC<{ errors: Record<string, string> }> = ({ errors }) => {
  const entries = Object.entries(errors);
  if (!entries.length) return null;
  return (
    <StudioSurface glass className="border-amber-300/20 bg-amber-400/8 p-4">
      <div className="flex items-start gap-3 text-sm text-amber-100">
        <AlertTriangle className="mt-0.5 shrink-0" size={17} />
        <div>
          <div className="font-black">Some admin sections could not refresh.</div>
          <div className="mt-1 text-amber-100/70">{entries.map(([key]) => key).join(', ')}</div>
        </div>
      </div>
    </StudioSurface>
  );
};

interface StudioAdminDashboardProps {
  onNavigate: (page: string, params?: any) => void;
}

export const StudioAdminDashboard: React.FC<StudioAdminDashboardProps> = () => {
  const { isAdmin, user } = useAuth();
  const { success, error } = useToast();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({});

  const [stats, setStats] = useState({ totalUsers: 0, totalPlaylists: 0, activeAnnouncements: 0 });
  const [users, setUsers] = useState<Profile[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [featuredMovies, setFeaturedMovies] = useState<any[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({});
  const [requests, setRequests] = useState<MovieRequest[]>([]);
  const [viewSessions, setViewSessions] = useState<AdminViewSession[]>([]);
  const [analyticsSummary, setAnalyticsSummary] = useState<AdminAnalyticsSummary | null>(null);
  const [analyticsEvents, setAnalyticsEvents] = useState<AdminAnalyticsEvent[]>([]);
  const [presenceUsers, setPresenceUsers] = useState<AdminPresenceUser[]>([]);
  const [healthChecks, setHealthChecks] = useState<HealthStatus[]>([]);
  const [inspectedUser, setInspectedUser] = useState<Profile | null>(null);
  const [inspectedStats, setInspectedStats] = useState<any | null>(null);
  const [inspectedHistory, setInspectedHistory] = useState<WatchProgress[]>([]);
  const [inspectorLoading, setInspectorLoading] = useState(false);

  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'moderator' | 'user'>('all');
  const [playlistSearch, setPlaylistSearch] = useState('');
  const [sessionSearch, setSessionSearch] = useState('');
  const [onlyPendingSessions, setOnlyPendingSessions] = useState(false);
  const [analyticsSearch, setAnalyticsSearch] = useState('');
  const [analyticsCategory, setAnalyticsCategory] = useState('all');
  const [presenceSearch, setPresenceSearch] = useState('');
  const [onlineOnlyPresence, setOnlineOnlyPresence] = useState(false);
  const [movieSearchQuery, setMovieSearchQuery] = useState('');
  const [movieSearchResults, setMovieSearchResults] = useState<Movie[]>([]);
  const [isSearchingMovies, setIsSearchingMovies] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', type: 'info' as 'info' | 'warning' | 'success' });

  const loadAllData = async (quiet = false) => {
    if (!quiet) setLoading(true);
    setRefreshing(true);
    const jobs = [
      ['Stats', SocialService.getAdminStats()],
      ['Users', SocialService.getAllUsers(150)],
      ['Announcements', SocialService.getAnnouncements()],
      ['Playlists', SocialService.getAllPlaylists(150)],
      ['Featured', SocialService.getFeaturedMovies()],
      ['Settings', SocialService.getAppSettings()],
      ['Requests', CommunityService.getRequests('all')],
      ['Sessions', SocialService.getRecentViewSessions({ limit: 100, onlyUnqualified: onlyPendingSessions })],
      ['AnalyticsSummary', SocialService.getAnalyticsSummary(7)],
      ['AnalyticsEvents', SocialService.getAnalyticsEvents({ limit: 120 })],
      ['Presence', SocialService.getPlatformPresence({ limit: 150, search: presenceSearch.trim() || null, onlineOnly: onlineOnlyPresence })],
    ] as const;

    const results = await Promise.allSettled(jobs.map(([, job]) => job));
    const nextErrors: Record<string, string> = {};

    results.forEach((result, index) => {
      const key = jobs[index][0];
      if (result.status === 'rejected') {
        nextErrors[key] = result.reason?.message || 'Unknown error';
        console.error(`[StudioAdmin] Failed to load ${key}:`, result.reason);
        return;
      }

      switch (key) {
        case 'Stats':
          setStats(result.value as typeof stats);
          break;
        case 'Users':
          setUsers(result.value as Profile[]);
          break;
        case 'Announcements':
          setAnnouncements(result.value as any[]);
          break;
        case 'Playlists':
          setPlaylists(result.value as any[]);
          break;
        case 'Featured':
          setFeaturedMovies(result.value as any[]);
          break;
        case 'Settings':
          setAppSettings(result.value as AppSettings);
          break;
        case 'Requests':
          setRequests(result.value as MovieRequest[]);
          break;
        case 'Sessions':
          setViewSessions(result.value as AdminViewSession[]);
          break;
        case 'AnalyticsSummary':
          setAnalyticsSummary(result.value as AdminAnalyticsSummary);
          break;
        case 'AnalyticsEvents':
          setAnalyticsEvents(result.value as AdminAnalyticsEvent[]);
          break;
        case 'Presence':
          setPresenceUsers(result.value as AdminPresenceUser[]);
          break;
      }
    });

    setLoadErrors(nextErrors);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadAllData();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || activeTab !== 'sessions') return;
    SocialService.getRecentViewSessions({ limit: 100, onlyUnqualified: onlyPendingSessions })
      .then(setViewSessions)
      .catch((e) => {
        console.error(e);
        error('Failed to load recent sessions');
      });
  }, [activeTab, onlyPendingSessions, isAdmin]);

  const refreshAnalytics = async (search = analyticsSearch, category = analyticsCategory) => {
    const eventCategory = category === 'all' ? null : category;
    const [summary, events] = await Promise.all([
      SocialService.getAnalyticsSummary(7),
      SocialService.getAnalyticsEvents({
        limit: 150,
        category: eventCategory,
        search: search.trim() || null
      })
    ]);
    setAnalyticsSummary(summary);
    setAnalyticsEvents(events);
  };

  useEffect(() => {
    if (!isAdmin || activeTab !== 'analytics') return;
    refreshAnalytics(analyticsSearch, analyticsCategory).catch((e) => {
      console.error(e);
      error('Failed to load analytics events');
    });
  }, [activeTab, analyticsCategory, isAdmin]);

  useEffect(() => {
    if (!isAdmin || activeTab !== 'presence') return;
    SocialService.getPlatformPresence({ limit: 150, search: presenceSearch.trim() || null, onlineOnly: onlineOnlyPresence })
      .then(setPresenceUsers)
      .catch((e) => {
        console.error(e);
        error('Failed to load platform presence');
      });
  }, [activeTab, onlineOnlyPresence, isAdmin]);

  const filteredUsers = useMemo(
    () =>
      users.filter((profile) => {
        const matchesSearch = normalize(profile.username).includes(normalize(userSearch)) || normalize(profile.id).includes(normalize(userSearch));
        const matchesRole = roleFilter === 'all' || profile.role === roleFilter;
        return matchesSearch && matchesRole;
      }),
    [users, userSearch, roleFilter]
  );

  const filteredPlaylists = useMemo(
    () =>
      playlists.filter(
        (playlist) =>
          normalize(playlist.name).includes(normalize(playlistSearch)) ||
          normalize(playlist.profiles?.username).includes(normalize(playlistSearch))
      ),
    [playlists, playlistSearch]
  );

  const filteredSessions = useMemo(
    () =>
      viewSessions.filter((session) =>
        [session.username, session.title, session.tmdb_id, session.provider_id, session.session_id]
          .map(normalize)
          .join(' ')
          .includes(normalize(sessionSearch))
      ),
    [viewSessions, sessionSearch]
  );

  const onlineCount = presenceUsers.filter((profile) => profile.is_online).length;
  const streamBlockedCount = users.filter((profile) => profile.can_stream === false).length;
  const overallHealth = healthChecks.length ? HealthService.getOverallStatus(healthChecks) : 'degraded';

  const saveSetting = async (key: string, value: string) => {
    try {
      await SocialService.updateAppSetting(key, value);
      setAppSettings((prev) => ({ ...prev, [key]: value }));
      success('Setting saved');
    } catch (e) {
      console.error(e);
      error('Failed to save setting');
    }
  };

  const updateUserRole = async (profile: Profile, role: 'admin' | 'moderator' | 'user') => {
    try {
      await SocialService.updateUserRole(profile.id, role);
      setUsers((prev) => prev.map((item) => (item.id === profile.id ? { ...item, role } : item)));
      success('Role updated');
    } catch (e) {
      console.error(e);
      error('Failed to update role');
    }
  };

  const updateUserStreaming = async (profile: Profile, canStream: boolean) => {
    try {
      await SocialService.updateStreamingPermission(profile.id, canStream);
      setUsers((prev) => prev.map((item) => (item.id === profile.id ? { ...item, can_stream: canStream } : item)));
    } catch (e) {
      console.error(e);
      error('Failed to update streaming permission');
    }
  };

  const deleteUser = async (profile: Profile) => {
    const ok = await confirm({
      title: 'Delete user',
      message: `Delete ${profile.username || 'this user'} and their profile data?`,
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await SocialService.deleteUserProfile(profile.id);
      setUsers((prev) => prev.filter((item) => item.id !== profile.id));
      success('User deleted');
    } catch (e) {
      console.error(e);
      error('Failed to delete user');
    }
  };

  const inspectUser = async (profile: Profile) => {
    setInspectedUser(profile);
    setInspectedStats(null);
    setInspectedHistory([]);
    setInspectorLoading(true);
    try {
      const [privateProfile, stats, history] = await Promise.all([
        SocialService.getPrivateProfile(profile.id),
        SocialService.getUserStats(profile.id),
        SocialService.getUserWatchHistory(profile.id),
      ]);
      setInspectedUser(privateProfile || profile);
      setInspectedStats(stats);
      setInspectedHistory(history as WatchProgress[]);
    } catch (e) {
      console.error(e);
      error('Failed to load user profile');
    } finally {
      setInspectorLoading(false);
    }
  };

  const createAnnouncement = async () => {
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) return;
    try {
      const row = await SocialService.createAnnouncement(newAnnouncement.title.trim(), newAnnouncement.content.trim(), newAnnouncement.type);
      setAnnouncements((prev) => [row, ...prev]);
      setNewAnnouncement({ title: '', content: '', type: 'info' });
      success('Announcement published');
    } catch (e) {
      console.error(e);
      error('Failed to publish announcement');
    }
  };

  const toggleAnnouncement = async (announcement: any) => {
    try {
      await SocialService.toggleAnnouncement(announcement.id, !announcement.is_active);
      setAnnouncements((prev) => prev.map((item) => (item.id === announcement.id ? { ...item, is_active: !item.is_active } : item)));
    } catch (e) {
      console.error(e);
      error('Failed to update announcement');
    }
  };

  const deleteAnnouncement = async (announcement: any) => {
    const ok = await confirm({
      title: 'Delete announcement',
      message: `Delete "${announcement.title}"?`,
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await SocialService.deleteAnnouncement(announcement.id);
      setAnnouncements((prev) => prev.filter((item) => item.id !== announcement.id));
    } catch (e) {
      console.error(e);
      error('Failed to delete announcement');
    }
  };

  const searchMovies = async () => {
    if (!movieSearchQuery.trim()) return;
    setIsSearchingMovies(true);
    try {
      setMovieSearchResults(await TmdbService.search(movieSearchQuery.trim()));
    } catch (e) {
      console.error(e);
      error('Search failed');
    } finally {
      setIsSearchingMovies(false);
    }
  };

  const addFeaturedMovie = async (movie: Movie) => {
    try {
      await SocialService.addFeaturedMovie(movie);
      setMovieSearchResults([]);
      setMovieSearchQuery('');
      setFeaturedMovies((await SocialService.getFeaturedMovies()) as any[]);
      success('Featured item added');
    } catch (e) {
      console.error(e);
      error('Failed to add featured item');
    }
  };

  const removeFeaturedMovie = async (id: string) => {
    try {
      await SocialService.removeFeaturedMovie(id);
      setFeaturedMovies((prev) => prev.filter((item) => item.id !== id));
    } catch (e) {
      console.error(e);
      error('Failed to remove featured item');
    }
  };

  const toggleFeaturedPlaylist = async (playlist: any) => {
    try {
      await SocialService.toggleFeaturedPlaylist(playlist.id, !playlist.is_featured);
      setPlaylists((prev) => prev.map((item) => (item.id === playlist.id ? { ...item, is_featured: !item.is_featured } : item)));
    } catch (e) {
      console.error(e);
      error('Failed to update playlist');
    }
  };

  const updateRequestStatus = async (request: MovieRequest) => {
    const status = request.status === 'pending' ? 'fulfilled' : 'pending';
    try {
      await CommunityService.updateRequestStatus(request.id, status);
      setRequests((prev) => prev.map((item) => (item.id === request.id ? { ...item, status } : item)));
    } catch (e) {
      console.error(e);
      error('Failed to update request');
    }
  };

  const runHealthCheck = async () => {
    setHealthLoading(true);
    try {
      setHealthChecks(await HealthService.checkAll());
    } catch (e) {
      console.error(e);
      error('Health check failed');
    } finally {
      setHealthLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <main className="min-h-screen px-4 pb-24 pt-28 text-white">
        <StudioSurface glass elevated className="mx-auto max-w-xl p-8 text-center">
          <ShieldCheck className="mx-auto text-white/45" size={34} />
          <h1 className="mt-4 text-3xl font-black">Admin access required</h1>
          <p className="mt-2 text-sm text-white/55">This Studio control surface is available to administrators only.</p>
        </StudioSurface>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 pb-20 pt-24 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1580px] space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/32">Platform control</div>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-black tracking-tight md:text-3xl">Admin</h1>
              <StatusPill tone={overallHealth === 'healthy' ? 'good' : overallHealth === 'down' ? 'bad' : 'warn'}>{overallHealth}</StatusPill>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CompactMetric label="Users" value={stats.totalUsers} />
            <CompactMetric label="Blocked" value={streamBlockedCount} tone="warn" />
            <CompactMetric label="Alerts" value={stats.activeAnnouncements} tone="warn" />
            <CompactMetric label="Online" value={onlineCount} tone="good" />
            <StudioButton onClick={() => loadAllData(true)} disabled={refreshing} size="sm" variant="ghost">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </StudioButton>
          </div>
        </div>

        <div className="studio-nav-liquid sticky top-20 z-20 overflow-hidden rounded-[28px] border border-white/10 p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
            <StudioTabsRoot value={activeTab} onValueChange={(value) => setActiveTab(value as AdminTab)}>
              <StudioTabsList className="flex w-full flex-nowrap justify-start gap-1 overflow-x-auto rounded-[22px] border-0 bg-transparent p-0 studio-scrollbar">
                {ADMIN_TABS.map((tab) => (
                  <StudioTabsTrigger key={tab.id} value={tab.id} className="h-8 shrink-0 px-3 text-[11px]">
                    {tab.label}
                  </StudioTabsTrigger>
                ))}
              </StudioTabsList>
            </StudioTabsRoot>
        </div>

        <LoadErrorList errors={loadErrors} />

        {loading ? (
          <div className="grid gap-3 md:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <StudioSurface key={item} glass className="h-32 animate-pulse bg-white/[0.03]" />
            ))}
          </div>
        ) : (
          <StudioTabsRoot value={activeTab} onValueChange={(value) => setActiveTab(value as AdminTab)}>
            <StudioTabsContent value="overview" className={tabContentClass}>
              <OverviewPanel
                stats={stats}
                users={users}
                requests={requests}
                sessions={viewSessions}
                analytics={analyticsSummary}
                presence={presenceUsers}
                health={overallHealth}
                onTab={setActiveTab}
              />
            </StudioTabsContent>

            <StudioTabsContent value="users" className={tabContentClass}>
              <StudioSurface glass elevated className="overflow-hidden">
                <SectionHeader eyebrow="Identity and access" title="Users">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/45" size={16} />
                      <input className={`${inputClass} pl-9 sm:w-80`} value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search users..." />
                    </div>
                    <select className={selectClass} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)}>
                      <option value="all">All roles</option>
                      <option value="admin">Admins</option>
                      <option value="moderator">Moderators</option>
                      <option value="user">Users</option>
                    </select>
                  </div>
                </SectionHeader>
                <div className="grid gap-3 p-4 lg:grid-cols-2">
                  {filteredUsers.map((profile) => (
                    <StudioSurface key={profile.id} className="p-4" glass>
                      <div className="flex gap-4">
                        <img src={profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.id}`} className="h-12 w-12 rounded-full object-cover" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-base font-black">{profile.username || 'Unnamed user'}</h3>
                            <StatusPill tone={profile.role === 'admin' ? 'good' : 'neutral'}>{profile.role || 'user'}</StatusPill>
                            {profile.account_kind === 'guest' && <StatusPill tone="warn">Guest</StatusPill>}
                          </div>
                          <p className="mt-1 truncate text-xs text-white/40">{profile.id}</p>
                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <select
                              className={selectClass}
                              value={profile.role || 'user'}
                              onChange={(e) => updateUserRole(profile, e.target.value as 'admin' | 'moderator' | 'user')}
                            >
                              <option value="user">User</option>
                              <option value="moderator">Moderator</option>
                              <option value="admin">Admin</option>
                            </select>
                            <label className="flex items-center gap-2 text-sm font-semibold text-white/65">
                              <StudioSwitch checked={profile.can_stream !== false} onCheckedChange={(checked) => updateUserStreaming(profile, checked)} />
                              Streaming
                            </label>
                            <StudioButton size="sm" variant="ghost" onClick={() => inspectUser(profile)}>
                              Inspect
                            </StudioButton>
                            <StudioButton
                              size="icon"
                              variant="danger"
                              disabled={profile.id === user?.id}
                              onClick={() => deleteUser(profile)}
                              title="Delete user"
                            >
                              <Trash2 size={16} />
                            </StudioButton>
                          </div>
                        </div>
                      </div>
                    </StudioSurface>
                  ))}
                </div>
              </StudioSurface>
              <UserInspectorPanel
                profile={inspectedUser}
                stats={inspectedStats}
                history={inspectedHistory}
                loading={inspectorLoading}
                onClose={() => setInspectedUser(null)}
              />
            </StudioTabsContent>

            <StudioTabsContent value="guests" className={tabContentClass}>
              <GuestAccessAdminPanel compact />
            </StudioTabsContent>

            <StudioTabsContent value="providers" className={tabContentClass}>
              <StudioProviderPanel />
            </StudioTabsContent>

            <StudioTabsContent value="content" className={tabContentClass}>
              <ContentPanel
                playlists={filteredPlaylists}
                featuredMovies={featuredMovies}
                playlistSearch={playlistSearch}
                movieSearchQuery={movieSearchQuery}
                movieSearchResults={movieSearchResults}
                searching={isSearchingMovies}
                onPlaylistSearch={setPlaylistSearch}
                onMovieSearchQuery={setMovieSearchQuery}
                onSearchMovies={searchMovies}
                onAddFeatured={addFeaturedMovie}
                onRemoveFeatured={removeFeaturedMovie}
                onToggleFeaturedPlaylist={toggleFeaturedPlaylist}
              />
            </StudioTabsContent>

            <StudioTabsContent value="announcements" className={tabContentClass}>
              <StudioSurface glass elevated className="overflow-hidden">
                <SectionHeader eyebrow="Broadcasts" title="Announcements" />
                <div className="grid gap-5 p-5 lg:grid-cols-[0.85fr_1.15fr]">
                  <StudioSurface glass className="space-y-3 p-4">
                    <input className={inputClass} placeholder="Title" value={newAnnouncement.title} onChange={(e) => setNewAnnouncement((prev) => ({ ...prev, title: e.target.value }))} />
                    <textarea className={textareaClass} placeholder="Message" value={newAnnouncement.content} onChange={(e) => setNewAnnouncement((prev) => ({ ...prev, content: e.target.value }))} />
                    <select className={selectClass} value={newAnnouncement.type} onChange={(e) => setNewAnnouncement((prev) => ({ ...prev, type: e.target.value as any }))}>
                      <option value="info">Info</option>
                      <option value="warning">Warning</option>
                      <option value="success">Success</option>
                    </select>
                    <StudioButton onClick={createAnnouncement} className="w-full">Publish announcement</StudioButton>
                  </StudioSurface>
                  <div className="space-y-3">
                    {announcements.map((announcement) => (
                      <StudioSurface key={announcement.id} glass className="p-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-black">{announcement.title}</h3>
                              <StatusPill tone={announcement.is_active ? 'good' : 'neutral'}>{announcement.is_active ? 'Active' : 'Paused'}</StatusPill>
                              <StatusPill>{announcement.type}</StatusPill>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-white/55">{announcement.content}</p>
                            <p className="mt-3 text-xs text-white/30">{formatDate(announcement.created_at)}</p>
                          </div>
                          <div className="flex gap-2">
                            <StudioButton variant="ghost" size="sm" onClick={() => toggleAnnouncement(announcement)}>
                              {announcement.is_active ? 'Pause' : 'Activate'}
                            </StudioButton>
                            <StudioButton variant="danger" size="icon" onClick={() => deleteAnnouncement(announcement)}>
                              <Trash2 size={16} />
                            </StudioButton>
                          </div>
                        </div>
                      </StudioSurface>
                    ))}
                    {!announcements.length && <EmptyState label="No announcements yet." />}
                  </div>
                </div>
              </StudioSurface>
            </StudioTabsContent>

            <StudioTabsContent value="settings" className={tabContentClass}>
              <SettingsPanel appSettings={appSettings} onSave={saveSetting} />
            </StudioTabsContent>

            <StudioTabsContent value="requests" className={tabContentClass}>
              <RequestsPanel requests={requests} onToggle={updateRequestStatus} />
            </StudioTabsContent>

            <StudioTabsContent value="sessions" className={tabContentClass}>
              <SessionsTablePanel
                sessions={filteredSessions}
                search={sessionSearch}
                onlyPending={onlyPendingSessions}
                onSearch={setSessionSearch}
                onPending={setOnlyPendingSessions}
              />
            </StudioTabsContent>

            <StudioTabsContent value="analytics" className={tabContentClass}>
              <AnalyticsPanel
                summary={analyticsSummary}
                events={analyticsEvents}
                search={analyticsSearch}
                category={analyticsCategory}
                onSearch={setAnalyticsSearch}
                onCategory={setAnalyticsCategory}
                onRefresh={() => refreshAnalytics().catch((e) => {
                  console.error(e);
                  error('Failed to load analytics events');
                })}
              />
            </StudioTabsContent>

            <StudioTabsContent value="presence" className={tabContentClass}>
              <PresenceTablePanel
                users={presenceUsers}
                search={presenceSearch}
                onlineOnly={onlineOnlyPresence}
                onSearch={setPresenceSearch}
                onOnlineOnly={setOnlineOnlyPresence}
              />
            </StudioTabsContent>

            <StudioTabsContent value="health" className={tabContentClass}>
              <HealthPanel checks={healthChecks} loading={healthLoading} onRun={runHealthCheck} overall={overallHealth} />
            </StudioTabsContent>
          </StudioTabsRoot>
        )}
      </div>
    </main>
  );
};

const StatCard: React.FC<{
  label: string;
  value: number | string;
  hint: string;
  icon: React.ReactNode;
  tone?: 'good' | 'warn' | 'neutral';
}> = ({ label, value, hint, icon, tone = 'neutral' }) => (
  <StudioSurface glass className={`p-3 ${tone === 'warn' ? 'border-amber-300/18 bg-amber-400/8' : tone === 'good' ? 'border-emerald-300/18 bg-emerald-400/8' : ''}`}>
    <div className="flex items-center justify-between text-white/45">
      <span className="text-[10px] font-black uppercase tracking-[0.18em]">{label}</span>
      <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
    </div>
    <div className="mt-3 text-2xl font-black tracking-tight">{value}</div>
    <div className="mt-1 text-xs font-semibold text-white/40">{hint}</div>
  </StudioSurface>
);

const CompactMetric: React.FC<{ label: string; value: number | string; tone?: 'good' | 'warn' | 'neutral' }> = ({
  label,
  value,
  tone = 'neutral',
}) => {
  const toneClass =
    tone === 'good'
      ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100'
      : tone === 'warn'
        ? 'border-amber-300/20 bg-amber-400/10 text-amber-100'
        : 'border-white/10 bg-white/[0.06] text-white/75';

  return (
    <div className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-black ${toneClass}`}>
      <span className="text-white/42">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
};

const BUILT_IN_PROVIDER_IDS = new Set(getDefaultProviderRecords().map((provider) => provider.id));

const StudioProviderPanel: React.FC = () => {
  const { success, error, info } = useToast();
  const confirm = useConfirm();
  const [providers, setProviders] = useState<PlayerProviderRecord[]>([]);
  const [analytics, setAnalytics] = useState<AdminProviderAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProvider, setEditingProvider] = useState<PlayerProviderRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadProviders = async () => {
    setLoading(true);
    try {
      const [providerRows, analyticsRows] = await Promise.all([
        SocialService.getProviders({ includeDisabled: true }),
        SocialService.getProviderAnalytics(30),
      ]);
      setProviders(providerRows);
      setAnalytics(analyticsRows);
    } catch (e) {
      console.error(e);
      error('Failed to load providers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProviders();
  }, []);

  const sortedProviders = useMemo(
    () => [...providers].sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name)),
    [providers]
  );

  const analyticsByProvider = useMemo(() => {
    const map = new Map<string, AdminProviderAnalytics>();
    analytics.forEach((item) => map.set(item.provider_id, item));
    return map;
  }, [analytics]);

  const saveProvider = async (record: PlayerProviderRecord, isEditing: boolean) => {
    await SocialService.upsertProvider(record);
    success(isEditing ? 'Provider updated' : 'Provider added');
    await loadProviders();
  };

  const toggleProvider = async (provider: PlayerProviderRecord) => {
    try {
      await SocialService.updateProviderEnabled(provider.id, !provider.enabled);
      setProviders((prev) => prev.map((item) => (item.id === provider.id ? { ...item, enabled: !item.enabled } : item)));
    } catch (e) {
      console.error(e);
      error('Failed to update provider');
    }
  };

  const deleteProvider = async (provider: PlayerProviderRecord) => {
    if (BUILT_IN_PROVIDER_IDS.has(provider.id)) {
      info('Built-in providers should be disabled instead of deleted');
      return;
    }

    const ok = await confirm({
      title: 'Delete provider',
      message: `Delete provider "${provider.name}"?`,
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await SocialService.deleteProvider(provider.id);
      setProviders((prev) => prev.filter((item) => item.id !== provider.id));
      success('Provider deleted');
    } catch (e) {
      console.error(e);
      error('Failed to delete provider');
    }
  };

  const moveProvider = async (provider: PlayerProviderRecord, direction: -1 | 1) => {
    const currentIndex = sortedProviders.findIndex((item) => item.id === provider.id);
    const swap = sortedProviders[currentIndex + direction];
    if (!swap) return;

    const nextProviders = providers.map((item) => {
      if (item.id === provider.id) return { ...item, sort_order: swap.sort_order };
      if (item.id === swap.id) return { ...item, sort_order: provider.sort_order };
      return item;
    });

    setProviders(nextProviders);
    try {
      await SocialService.updateProviderSortOrders(nextProviders.map((item) => ({ id: item.id, sort_order: item.sort_order })));
    } catch (e) {
      console.error(e);
      error('Failed to reorder provider');
      loadProviders();
    }
  };

  return (
    <StudioSurface glass elevated className="overflow-hidden">
      <SectionHeader eyebrow="Routing matrix" title="Provider Control">
        <div className="flex gap-2">
          <StudioButton onClick={loadProviders} variant="ghost" size="sm">
            <RefreshCw size={14} />
            Refresh
          </StudioButton>
          <StudioButton
            onClick={() => {
              setEditingProvider(null);
              setIsModalOpen(true);
            }}
            size="sm"
          >
            <Plus size={14} />
            Provider
          </StudioButton>
        </div>
      </SectionHeader>

      <div className="max-h-[calc(100vh-260px)] overflow-auto overscroll-contain studio-scrollbar" {...nativeScrollProps}>
        <table className="w-full min-w-[980px] text-left">
          <thead className="border-b border-white/10 bg-white/[0.03] text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
            <tr>
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Health</th>
              <th className="px-4 py-3">Analytics</th>
              <th className="px-4 py-3">Tags</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-white/45">Loading providers...</td>
              </tr>
            ) : (
              sortedProviders.map((provider) => {
                const providerAnalytics = analyticsByProvider.get(provider.id);
                return (
                  <tr key={provider.id} className="bg-white/[0.015] transition-colors hover:bg-white/[0.04]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex w-9 shrink-0 flex-col overflow-hidden rounded-full border border-white/10 text-center text-[10px] font-black text-white/50">
                          <button className="h-4 hover:bg-white/10" onClick={() => moveProvider(provider, -1)}>↑</button>
                          <button className="h-4 border-t border-white/10 hover:bg-white/10" onClick={() => moveProvider(provider, 1)}>↓</button>
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-black">{provider.name}</span>
                            <StatusPill tone={provider.enabled ? 'good' : 'neutral'}>{provider.enabled ? 'Enabled' : 'Disabled'}</StatusPill>
                          </div>
                          <div className="mt-1 truncate font-mono text-xs text-white/35">{provider.id} · order {provider.sort_order}</div>
                          {provider.best_for && <div className="mt-1 truncate text-xs text-white/45">{provider.best_for}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <StatusPill>{provider.render_mode}</StatusPill>
                        {provider.has_events && <StatusPill tone="good">Events</StatusPill>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={provider.risk_level === 'high' ? 'bad' : provider.risk_level === 'medium' ? 'warn' : 'good'}>
                        {provider.risk_level} risk
                      </StatusPill>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/50">
                      {providerAnalytics ? (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          <span>Attempts {providerAnalytics.total_attempts}</span>
                          <span>Success {providerAnalytics.success_rate}%</span>
                          <span>Quick exits {providerAnalytics.quick_exit_count}</span>
                          <span>No ready {providerAnalytics.no_ready_timeout_count}</span>
                        </div>
                      ) : (
                        <span className="text-white/30">No data</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-[220px] flex-wrap gap-1.5">
                        {(provider.tags || []).slice(0, 4).map((tag) => <StatusPill key={tag}>{tag}</StatusPill>)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <StudioButton size="sm" variant={provider.enabled ? 'ghost' : 'primary'} onClick={() => toggleProvider(provider)}>
                          {provider.enabled ? 'Disable' : 'Enable'}
                        </StudioButton>
                        <StudioButton size="icon" variant="ghost" onClick={() => { setEditingProvider(provider); setIsModalOpen(true); }}>
                          <Pencil size={15} />
                        </StudioButton>
                        {!BUILT_IN_PROVIDER_IDS.has(provider.id) && (
                          <StudioButton size="icon" variant="danger" onClick={() => deleteProvider(provider)}>
                            <Trash2 size={15} />
                          </StudioButton>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ProviderFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={saveProvider}
        initialData={editingProvider}
        compact
      />
    </StudioSurface>
  );
};

const UserInspectorPanel: React.FC<{
  profile: Profile | null;
  stats: any | null;
  history: WatchProgress[];
  loading: boolean;
  onClose: () => void;
}> = ({ profile, stats, history, loading, onClose }) => {
  if (!profile) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 px-3 pb-3 backdrop-blur-xl animate-in fade-in duration-200 md:items-center md:p-6" onClick={onClose}>
      <StudioSurface
        glass
        elevated
        className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[30px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-black/20 px-5 py-4">
          <div className="flex min-w-0 items-center gap-4">
            <img
              src={profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.id}`}
              className="h-14 w-14 rounded-full object-cover"
            />
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">User inspector</div>
              <h3 className="mt-1 truncate text-2xl font-black tracking-tight">{profile.username || 'Unnamed user'}</h3>
              <div className="mt-1 flex flex-wrap gap-2">
                <StatusPill tone={profile.role === 'admin' ? 'good' : 'neutral'}>{profile.role || 'user'}</StatusPill>
                <StatusPill tone={profile.can_stream === false ? 'bad' : 'good'}>{profile.can_stream === false ? 'Streaming blocked' : 'Can stream'}</StatusPill>
                {profile.account_kind === 'guest' && <StatusPill tone="warn">Guest</StatusPill>}
              </div>
            </div>
          </div>
          <StudioButton variant="ghost" size="sm" onClick={onClose}>Close</StudioButton>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-5 studio-scrollbar" {...nativeScrollProps}>
          {loading ? (
            <div className="grid gap-3 md:grid-cols-3">
              {[0, 1, 2].map((item) => <StudioSurface key={item} glass className="h-32 animate-pulse bg-white/[0.03]" />)}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-4">
                <StatCard label="History" value={stats?.historyCount || history.length} hint="watch entries" icon={<Clock size={18} />} />
                <StatCard label="Playlists" value={stats?.playlistsCount || 0} hint="created" icon={<Heart size={18} />} />
                <StatCard label="Liked" value={stats?.likedPlaylistsCount || 0} hint="playlists" icon={<CheckCircle2 size={18} />} />
                <StatCard label="Views" value={stats?.totalPlaylistViews || 0} hint="playlist views" icon={<Activity size={18} />} />
              </div>

              <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
                <StudioSurface glass className="p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">Recent searches</div>
                  <div className="mt-3 max-h-72 space-y-2 overflow-y-auto overscroll-contain pr-1 studio-scrollbar" {...nativeScrollProps}>
                    {(profile.recent_searches || []).length ? (
                      profile.recent_searches?.map((query, index) => (
                        <div key={`${query}-${index}`} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                          <Search size={14} className="text-white/35" />
                          <span className="truncate text-sm font-semibold text-white/70">{query}</span>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-white/40">No recent searches.</div>
                    )}
                  </div>
                </StudioSurface>

                <StudioSurface glass className="overflow-hidden">
                  <div className="border-b border-white/10 px-4 py-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">Watch history</div>
                  </div>
                  <div className="max-h-[420px] overflow-y-auto overscroll-contain studio-scrollbar" {...nativeScrollProps}>
                    {history.length ? (
                      <div className="divide-y divide-white/10">
                        {history.map((item, index) => {
                          const poster = item.posterPath
                            ? item.posterPath.startsWith('http')
                              ? item.posterPath
                              : `https://image.tmdb.org/t/p/w185${item.posterPath}`
                            : '';
                          const progress = item.progress ?? Math.round((item.time / Math.max(1, item.duration)) * 100);
                          return (
                            <div key={`${item.tmdbId}-${item.season || 0}-${item.episode || 0}-${index}`} className="grid gap-3 px-4 py-3 md:grid-cols-[56px_1fr_190px] md:items-center">
                              {poster ? <img src={poster} className="h-20 w-14 rounded-xl object-cover" /> : <div className="h-20 w-14 rounded-xl bg-white/5" />}
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="truncate font-black">{item.title || `TMDB ${item.tmdbId}`}</h4>
                                  <StatusPill>{item.type}</StatusPill>
                                  {item.type === 'tv' && <StatusPill>S{item.season || 1} E{item.episode || 1}</StatusPill>}
                                </div>
                                <div className="mt-1 text-xs text-white/38">{item.provider || 'unknown provider'} · {formatDate(new Date(item.lastUpdated).toISOString())}</div>
                                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                                  <div className="h-full rounded-full bg-white/70" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
                                </div>
                              </div>
                              <div className="text-xs text-white/45 md:text-right">
                                <div>{formatDuration(item.time)} / {formatDuration(item.duration)}</div>
                                <div className="mt-1">{Math.min(100, Math.max(0, progress))}% watched</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-5"><EmptyState label="No watch history found." /></div>
                    )}
                  </div>
                </StudioSurface>
              </div>
            </div>
          )}
        </div>
      </StudioSurface>
    </div>
  );
};

const OverviewPanel: React.FC<{
  stats: { totalUsers: number; totalPlaylists: number; activeAnnouncements: number };
  users: Profile[];
  requests: MovieRequest[];
  sessions: AdminViewSession[];
  analytics: AdminAnalyticsSummary | null;
  presence: AdminPresenceUser[];
  health: string;
  onTab: (tab: AdminTab) => void;
}> = ({ stats, users, requests, sessions, analytics, presence, health, onTab }) => (
  <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
    <StudioSurface glass elevated className="overflow-hidden">
      <SectionHeader eyebrow="Live operations" title="Control map" />
      <div className="grid gap-2.5 p-3 md:grid-cols-2 2xl:grid-cols-3">
        {[
          ['Users', `${stats.totalUsers} profiles`, 'Manage roles, guest accounts, and streaming access.', 'users'],
          ['Providers', 'Routing stack', 'Tune provider order, analytics, embed mode, and failover.', 'providers'],
          ['Content', `${stats.totalPlaylists} playlists`, 'Feature playlists and title picks across the platform.', 'content'],
          ['Sessions', `${sessions.length} recent`, 'Review watch heartbeats and qualified viewing activity.', 'sessions'],
          ['Analytics', `${analytics?.total_events || 0} events`, 'Inspect buffered searches, controls, downloads, and player failures.', 'analytics'],
          ['Presence', `${presence.filter((item) => item.is_online).length} online`, 'See active users, paths, and time on platform.', 'presence'],
          ['Requests', `${requests.filter((item) => item.status === 'pending').length} pending`, 'Moderate community movie and series requests.', 'requests'],
        ].map(([title, value, copy, tab]) => (
          <button key={title} onClick={() => onTab(tab as AdminTab)} className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">{title}</div>
            <div className="mt-1.5 text-xl font-black">{value}</div>
            <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-white/48">{copy}</p>
          </button>
        ))}
      </div>
    </StudioSurface>

    <div className="space-y-4">
      <StudioSurface glass className="p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">Platform status</div>
        <div className="mt-2 flex items-center gap-3">
          <StatusPill tone={health === 'healthy' ? 'good' : health === 'down' ? 'bad' : 'warn'}>{health}</StatusPill>
          <span className="text-xs text-white/45">Run diagnostics in Health.</span>
        </div>
      </StudioSurface>
      <StudioSurface glass className="p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">Attention</div>
        <div className="mt-3 space-y-2">
          <AdminSignal label="Streaming blocked users" value={users.filter((item) => item.can_stream === false).length} />
          <AdminSignal label="Pending requests" value={requests.filter((item) => item.status === 'pending').length} />
          <AdminSignal label="Unqualified sessions" value={sessions.filter((item) => !item.is_qualified).length} />
        </div>
      </StudioSurface>
    </div>
  </div>
);

const AdminSignal: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
    <span className="text-xs font-semibold text-white/60">{label}</span>
    <span className="text-base font-black">{value}</span>
  </div>
);

const ContentPanel: React.FC<{
  playlists: any[];
  featuredMovies: any[];
  playlistSearch: string;
  movieSearchQuery: string;
  movieSearchResults: Movie[];
  searching: boolean;
  onPlaylistSearch: (value: string) => void;
  onMovieSearchQuery: (value: string) => void;
  onSearchMovies: () => void;
  onAddFeatured: (movie: Movie) => void;
  onRemoveFeatured: (id: string) => void;
  onToggleFeaturedPlaylist: (playlist: any) => void;
}> = ({
  playlists,
  featuredMovies,
  playlistSearch,
  movieSearchQuery,
  movieSearchResults,
  searching,
  onPlaylistSearch,
  onMovieSearchQuery,
  onSearchMovies,
  onAddFeatured,
  onRemoveFeatured,
  onToggleFeaturedPlaylist,
}) => (
  <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
    <StudioSurface glass elevated className="overflow-hidden">
      <SectionHeader eyebrow="Shelves" title="Playlists">
        <input className={`${inputClass} sm:w-72`} value={playlistSearch} onChange={(e) => onPlaylistSearch(e.target.value)} placeholder="Search playlists..." />
      </SectionHeader>
      <div className="grid max-h-[760px] gap-3 overflow-y-auto overscroll-contain p-5 pr-3 studio-scrollbar" {...nativeScrollProps}>
        {playlists.map((playlist) => (
          <StudioSurface key={playlist.id} glass className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-lg font-black">{playlist.name}</h3>
                  {playlist.is_featured && <StatusPill tone="good">Featured</StatusPill>}
                  <StatusPill>{playlist.is_public ? 'Public' : 'Private'}</StatusPill>
                </div>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/35">
                  by {playlist.profiles?.username || 'unknown'} · {playlist.playlist_items?.length || playlist.items_count || 0} items
                </p>
              </div>
              <StudioButton size="sm" variant={playlist.is_featured ? 'primary' : 'ghost'} onClick={() => onToggleFeaturedPlaylist(playlist)}>
                {playlist.is_featured ? 'Featured' : 'Feature'}
              </StudioButton>
            </div>
          </StudioSurface>
        ))}
        {!playlists.length && <EmptyState label="No playlists match the current filter." />}
      </div>
    </StudioSurface>

    <StudioSurface glass elevated className="overflow-hidden">
      <SectionHeader eyebrow="Hero picks" title="Featured Movies & Series" />
      <div className="space-y-4 p-5">
        <div className="flex gap-2">
          <input
            className={inputClass}
            value={movieSearchQuery}
            onChange={(e) => onMovieSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearchMovies()}
            placeholder="Search TMDB..."
          />
          <StudioButton onClick={onSearchMovies} disabled={searching}>
            {searching ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
          </StudioButton>
        </div>
        {movieSearchResults.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {movieSearchResults.slice(0, 6).map((movie) => (
              <button key={`${movie.id}-${movie.mediaType}`} onClick={() => onAddFeatured(movie)} className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.04] text-left transition hover:border-white/25">
                {movie.posterUrl || movie.imageUrl ? <img src={movie.posterUrl || movie.imageUrl} className="aspect-[2/3] w-full object-cover" /> : <div className="aspect-[2/3] bg-white/5" />}
                <div className="p-3 text-sm font-black">{getMovieTitle(movie)}</div>
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {featuredMovies.map((row) => {
            const metadata = row.metadata || row;
            const poster = metadata.poster_path ? getPoster(metadata.poster_path) : metadata.posterUrl || metadata.imageUrl;
            return (
              <StudioSurface key={row.id} glass className="overflow-hidden">
                {poster ? <img src={poster} className="aspect-[2/3] w-full object-cover" /> : <div className="aspect-[2/3] bg-white/5" />}
                <div className="space-y-2 p-3">
                  <div className="line-clamp-2 text-sm font-black">{getMovieTitle(metadata)}</div>
                  <StudioButton className="w-full" size="sm" variant="danger" onClick={() => onRemoveFeatured(row.id)}>
                    Remove
                  </StudioButton>
                </div>
              </StudioSurface>
            );
          })}
        </div>
      </div>
    </StudioSurface>
  </div>
);

const SettingsPanel: React.FC<{ appSettings: AppSettings; onSave: (key: string, value: string) => void }> = ({ appSettings, onSave }) => {
  const [draft, setDraft] = useState<AppSettings>(appSettings);
  useEffect(() => setDraft(appSettings), [appSettings]);

  const setDraftValue = (key: string, value: string) => setDraft((prev) => ({ ...prev, [key]: value }));
  const boolValue = (key: string) => (draft[key] ?? 'true') === 'true';

  return (
    <StudioSurface glass elevated className="overflow-hidden">
      <SectionHeader eyebrow="Runtime settings" title="App Settings" />
      <div className="grid gap-5 p-5 xl:grid-cols-2">
        <StudioSurface glass className="space-y-4 p-5">
          <div>
            <label className="text-xs font-black uppercase tracking-[0.2em] text-white/35">Public site URL</label>
            <div className="mt-2 flex gap-2">
              <input className={inputClass} value={draft.site_url || ''} onChange={(e) => setDraftValue('site_url', e.target.value)} placeholder="https://plusultra.example.com" />
              <StudioButton onClick={() => onSave('site_url', String(draft.site_url || '').trim())}>Save</StudioButton>
            </div>
            <p className="mt-2 text-xs leading-5 text-white/42">Tauri guest account links use this domain and ignore localhost/Tauri origins.</p>
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-[0.2em] text-white/35">Donation URL</label>
            <div className="mt-2 flex gap-2">
              <input className={inputClass} value={draft.donation_url || ''} onChange={(e) => setDraftValue('donation_url', e.target.value)} placeholder="https://..." />
              <StudioButton onClick={() => onSave('donation_url', String(draft.donation_url || '').trim())}>Save</StudioButton>
            </div>
          </div>
        </StudioSurface>
        <StudioSurface glass className="space-y-3 p-5">
          {[
            ['registration_enabled', 'Open registration', 'Allow new users to create accounts.'],
            ['clear_history_enabled', 'Clear history', 'Allow users to clear watch history.'],
            [WRAPPED_SETTING_KEY, 'Wrapped experience', 'Enable annual/personal watch recap surfaces.'],
          ].map(([key, label, copy]) => (
            <div key={key} className="flex items-center justify-between gap-4 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <div>
                <div className="font-black">{label}</div>
                <div className="mt-1 text-sm text-white/45">{copy}</div>
              </div>
              <StudioSwitch checked={boolValue(key)} onCheckedChange={(checked) => onSave(key, checked ? 'true' : 'false')} />
            </div>
          ))}
        </StudioSurface>
      </div>
    </StudioSurface>
  );
};

const RequestsPanel: React.FC<{ requests: MovieRequest[]; onToggle: (request: MovieRequest) => void }> = ({ requests, onToggle }) => (
  <StudioSurface glass elevated className="overflow-hidden">
    <SectionHeader eyebrow="Community demand" title="Requests" />
    <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
      {requests.map((request) => (
        <StudioSurface key={request.id} glass className="overflow-hidden">
          <div className="flex gap-4 p-4">
            {request.poster_path ? <img src={getPoster(request.poster_path)} className="h-28 w-20 rounded-2xl object-cover" /> : <div className="h-28 w-20 rounded-2xl bg-white/5" />}
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 text-base font-black">{request.title}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusPill tone={request.status === 'fulfilled' ? 'good' : 'warn'}>{request.status}</StatusPill>
                <StatusPill>{request.reply_count || 0} replies</StatusPill>
              </div>
              <p className="mt-3 text-xs text-white/35">{formatDate(request.created_at)}</p>
              <StudioButton size="sm" className="mt-4" onClick={() => onToggle(request)}>
                Mark {request.status === 'pending' ? 'fulfilled' : 'pending'}
              </StudioButton>
            </div>
          </div>
        </StudioSurface>
      ))}
      {!requests.length && <EmptyState label="No requests found." />}
    </div>
  </StudioSurface>
);

const analyticsCategories = [
  { value: 'all', label: 'All' },
  { value: 'player', label: 'Player' },
  { value: 'search', label: 'Search' },
  { value: 'download', label: 'Download' },
  { value: 'content', label: 'Content' },
  { value: 'playlist', label: 'Playlist' },
  { value: 'navigation', label: 'Navigation' },
];

const payloadSummary = (event: AdminAnalyticsEvent) => {
  const payload = event.payload || {};
  return (
    payload.title ||
    payload.query ||
    payload.control ||
    payload.action ||
    payload.reason ||
    payload.error ||
    payload.label ||
    ''
  );
};

const AnalyticsPanel: React.FC<{
  summary: AdminAnalyticsSummary | null;
  events: AdminAnalyticsEvent[];
  search: string;
  category: string;
  onSearch: (value: string) => void;
  onCategory: (value: string) => void;
  onRefresh: () => void;
}> = ({ summary, events, search, category, onSearch, onCategory, onRefresh }) => (
  <StudioSurface glass elevated className="overflow-hidden">
    <SectionHeader eyebrow="Buffered event stream" title="Analytics">
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
        onSubmit={(event) => {
          event.preventDefault();
          onRefresh();
        }}
      >
        <select className={selectClass} value={category} onChange={(event) => onCategory(event.target.value)}>
          {analyticsCategories.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
        <input className={`${inputClass} sm:w-80`} value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search events, users, TMDB..." />
        <StudioButton size="sm" variant="ghost" type="submit">
          <RefreshCw size={15} />
          Refresh
        </StudioButton>
      </form>
    </SectionHeader>
    <div className="grid gap-3 border-b border-white/10 p-4 sm:grid-cols-2 xl:grid-cols-5">
      <AdminSignal label="Events 7d" value={summary?.total_events || 0} />
      <AdminSignal label="Unique users" value={summary?.unique_users || 0} />
      <AdminSignal label="Player events" value={summary?.player_events || 0} />
      <AdminSignal label="Provider events" value={summary?.provider_events || 0} />
      <AdminSignal label="Failures" value={summary?.failure_events || 0} />
    </div>
    <div className="max-h-[calc(100vh-330px)] overflow-auto overscroll-contain studio-scrollbar" {...nativeScrollProps}>
      <table className="w-full min-w-[1080px] text-left">
        <thead className="border-b border-white/10 bg-white/[0.03] text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
          <tr>
            <th className="px-4 py-3">Event</th>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Content</th>
            <th className="px-4 py-3">Provider</th>
            <th className="px-4 py-3">Context</th>
            <th className="px-4 py-3 text-right">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {events.map((event) => (
            <tr key={event.id} className="transition-colors hover:bg-white/[0.035]">
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-black">{event.event_name}</span>
                  <StatusPill>{event.event_category}</StatusPill>
                </div>
                <div className="mt-1 max-w-[330px] truncate text-xs text-white/38">{payloadSummary(event) || 'No payload label'}</div>
              </td>
              <td className="px-4 py-3">
                <div className="font-semibold text-white/70">{event.username || 'unknown'}</div>
                <div className="mt-1 max-w-[190px] truncate font-mono text-xs text-white/30">{event.user_id}</div>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {event.tmdb_id ? <StatusPill>TMDB {event.tmdb_id}</StatusPill> : <StatusPill>no title</StatusPill>}
                  {event.media_type && <StatusPill>{event.media_type}</StatusPill>}
                  {event.media_type === 'tv' && <StatusPill>S{event.season || 1} E{event.episode || 1}</StatusPill>}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="font-semibold text-white/62">{event.provider_id || 'none'}</div>
                <div className="mt-1 max-w-[180px] truncate font-mono text-xs text-white/28">{event.attempt_id || event.session_id || ''}</div>
              </td>
              <td className="px-4 py-3">
                <div className="max-w-[260px] truncate text-sm font-semibold text-white/55">{event.page_path || 'No path'}</div>
                <div className="mt-1 text-xs text-white/32">{event.client_context?.appMode || event.client_context?.platform || 'client'}</div>
              </td>
              <td className="px-4 py-3 text-right text-xs text-white/35">{formatDate(event.occurred_at)}</td>
            </tr>
          ))}
          {!events.length && (
            <tr>
              <td colSpan={6} className="p-5"><EmptyState label="No analytics events found." /></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </StudioSurface>
);

const SessionsTablePanel: React.FC<{
  sessions: AdminViewSession[];
  search: string;
  onlyPending: boolean;
  onSearch: (value: string) => void;
  onPending: (value: boolean) => void;
}> = ({ sessions, search, onlyPending, onSearch, onPending }) => (
  <StudioSurface glass elevated className="overflow-hidden">
    <SectionHeader eyebrow="Viewing analytics" title="Recent Sessions">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input className={`${inputClass} sm:w-80`} value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search sessions..." />
        <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-white/65">
          Pending
          <StudioSwitch checked={onlyPending} onCheckedChange={onPending} />
        </label>
      </div>
    </SectionHeader>
    <div className="max-h-[calc(100vh-260px)] overflow-auto overscroll-contain studio-scrollbar" {...nativeScrollProps}>
      <table className="w-full min-w-[940px] text-left">
        <thead className="border-b border-white/10 bg-white/[0.03] text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
          <tr>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Viewer</th>
            <th className="px-4 py-3">Playback</th>
            <th className="px-4 py-3">Progress</th>
            <th className="px-4 py-3 text-right">Heartbeat</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {sessions.map((session) => (
            <tr key={session.id} className="transition-colors hover:bg-white/[0.035]">
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="max-w-[360px] truncate font-black">{session.title || session.tmdb_id}</span>
                  <StatusPill>{session.media_type}</StatusPill>
                  {session.media_type === 'tv' && <StatusPill>S{session.season || 1} E{session.episode || 1}</StatusPill>}
                </div>
                <div className="mt-1 font-mono text-xs text-white/32">TMDB {session.tmdb_id}</div>
              </td>
              <td className="px-4 py-3">
                <div className="font-semibold text-white/75">{session.username || 'unknown'}</div>
                <div className="mt-1 max-w-[190px] truncate font-mono text-xs text-white/30">{session.user_id}</div>
              </td>
              <td className="px-4 py-3">
                <div className="font-semibold text-white/65">{session.provider_id || 'no provider'}</div>
                <div className="mt-1 text-xs text-white/35">{session.last_activity_mode || 'watch'} · switches {session.provider_switch_count || 0}</div>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={session.is_qualified ? 'good' : session.qualification_state === 'close' ? 'warn' : 'neutral'}>{session.qualification_state}</StatusPill>
                  <span className="text-xs text-white/45">{formatDuration(session.active_seconds)} / {formatDuration(session.threshold_seconds)}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-white/70"
                    style={{ width: `${Math.min(100, Math.round((session.active_seconds / Math.max(1, session.threshold_seconds)) * 100))}%` }}
                  />
                </div>
              </td>
              <td className="px-4 py-3 text-right text-xs text-white/35">{formatDate(session.last_heartbeat_at)}</td>
            </tr>
          ))}
          {!sessions.length && (
            <tr>
              <td colSpan={5} className="p-5"><EmptyState label="No matching sessions." /></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </StudioSurface>
);

const PresenceTablePanel: React.FC<{
  users: AdminPresenceUser[];
  search: string;
  onlineOnly: boolean;
  onSearch: (value: string) => void;
  onOnlineOnly: (value: boolean) => void;
}> = ({ users, search, onlineOnly, onSearch, onOnlineOnly }) => {
  const filtered = users.filter((profile) => [profile.username, profile.user_id, profile.last_path].map(normalize).join(' ').includes(normalize(search)));
  return (
    <StudioSurface glass elevated className="overflow-hidden">
      <SectionHeader eyebrow="Live users" title="Presence">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input className={`${inputClass} sm:w-80`} value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search presence..." />
          <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-white/65">
            Online only
            <StudioSwitch checked={onlineOnly} onCheckedChange={onOnlineOnly} />
          </label>
        </div>
      </SectionHeader>
      <div className="max-h-[calc(100vh-260px)] overflow-auto overscroll-contain studio-scrollbar" {...nativeScrollProps}>
        <table className="w-full min-w-[900px] text-left">
          <thead className="border-b border-white/10 bg-white/[0.03] text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">State</th>
              <th className="px-4 py-3">Current path</th>
              <th className="px-4 py-3">Activity</th>
              <th className="px-4 py-3 text-right">Last seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {filtered.map((profile) => (
              <tr key={profile.user_id} className="transition-colors hover:bg-white/[0.035]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <img src={profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.user_id}`} className="h-10 w-10 rounded-full object-cover" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-black">{profile.username || 'unknown'}</span>
                        {profile.is_online ? <Wifi size={14} className="text-emerald-300" /> : <WifiOff size={14} className="text-white/30" />}
                      </div>
                      <div className="mt-1 max-w-[190px] truncate font-mono text-xs text-white/30">{profile.user_id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <StatusPill tone={profile.is_online ? 'good' : 'neutral'}>{profile.is_online ? 'Online' : 'Offline'}</StatusPill>
                    <StatusPill tone={profile.can_stream === false ? 'bad' : 'good'}>{profile.can_stream === false ? 'Blocked' : 'Can stream'}</StatusPill>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="max-w-[280px] truncate text-sm font-semibold text-white/60">{profile.last_path || 'No path'}</div>
                  <div className="mt-1 text-xs text-white/32">{profile.active_mode || 'idle'}</div>
                </td>
                <td className="px-4 py-3 text-xs text-white/45">
                  <div>Today {formatDuration(profile.today_active_seconds)}</div>
                  <div className="mt-1">Total {formatDuration(profile.total_active_seconds)} · {profile.session_count} sessions</div>
                </td>
                <td className="px-4 py-3 text-right text-xs text-white/35">{formatDate(profile.last_seen_at)}</td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={5} className="p-5"><EmptyState label="No matching presence records." /></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </StudioSurface>
  );
};

const SessionsPanel: React.FC<{
  sessions: AdminViewSession[];
  search: string;
  onlyPending: boolean;
  onSearch: (value: string) => void;
  onPending: (value: boolean) => void;
}> = ({ sessions, search, onlyPending, onSearch, onPending }) => (
  <StudioSurface glass elevated className="overflow-hidden">
    <SectionHeader eyebrow="Viewing analytics" title="Recent Sessions">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input className={`${inputClass} sm:w-80`} value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search sessions..." />
        <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-white/65">
          Pending
          <StudioSwitch checked={onlyPending} onCheckedChange={onPending} />
        </label>
      </div>
    </SectionHeader>
    <div className="divide-y divide-white/10">
      {sessions.map((session) => (
        <div key={session.id} className="grid gap-3 p-4 md:grid-cols-[1.4fr_0.8fr_0.5fr] md:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-black">{session.title || session.tmdb_id}</h3>
              <StatusPill tone={session.is_qualified ? 'good' : session.qualification_state === 'close' ? 'warn' : 'neutral'}>{session.qualification_state}</StatusPill>
            </div>
            <p className="mt-1 text-xs text-white/40">{session.username || 'unknown'} · {session.provider_id || 'no provider'}</p>
          </div>
          <div className="text-sm text-white/55">
            Active {formatDuration(session.active_seconds)} · threshold {formatDuration(session.threshold_seconds)}
          </div>
          <div className="text-xs text-white/35 md:text-right">{formatDate(session.last_heartbeat_at)}</div>
        </div>
      ))}
      {!sessions.length && <div className="p-5"><EmptyState label="No matching sessions." /></div>}
    </div>
  </StudioSurface>
);

const PresencePanel: React.FC<{
  users: AdminPresenceUser[];
  search: string;
  onlineOnly: boolean;
  onSearch: (value: string) => void;
  onOnlineOnly: (value: boolean) => void;
}> = ({ users, search, onlineOnly, onSearch, onOnlineOnly }) => {
  const filtered = users.filter((profile) => [profile.username, profile.user_id, profile.last_path].map(normalize).join(' ').includes(normalize(search)));
  return (
    <StudioSurface glass elevated className="overflow-hidden">
      <SectionHeader eyebrow="Live users" title="Presence">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input className={`${inputClass} sm:w-80`} value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search presence..." />
          <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-white/65">
            Online only
            <StudioSwitch checked={onlineOnly} onCheckedChange={onOnlineOnly} />
          </label>
        </div>
      </SectionHeader>
      <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((profile) => (
          <StudioSurface key={profile.user_id} glass className="p-4">
            <div className="flex gap-3">
              <img src={profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.user_id}`} className="h-11 w-11 rounded-full object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-black">{profile.username || 'unknown'}</h3>
                  {profile.is_online ? <Wifi size={15} className="text-emerald-300" /> : <WifiOff size={15} className="text-white/30" />}
                </div>
                <p className="mt-1 truncate text-xs text-white/40">{profile.last_path || 'No path'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusPill tone={profile.can_stream === false ? 'bad' : 'good'}>{profile.can_stream === false ? 'Blocked' : 'Can stream'}</StatusPill>
                  <StatusPill>{formatDuration(profile.today_active_seconds)} today</StatusPill>
                </div>
              </div>
            </div>
          </StudioSurface>
        ))}
      </div>
    </StudioSurface>
  );
};

const HealthPanel: React.FC<{
  checks: HealthStatus[];
  loading: boolean;
  overall: string;
  onRun: () => void;
}> = ({ checks, loading, overall, onRun }) => (
  <StudioSurface glass elevated className="overflow-hidden">
    <SectionHeader eyebrow="Diagnostics" title="System Health">
      <StudioButton onClick={onRun} disabled={loading}>
        {loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
        Run checks
      </StudioButton>
    </SectionHeader>
    <div className="p-5">
      <div className="mb-4">
        <StatusPill tone={overall === 'healthy' ? 'good' : overall === 'down' ? 'bad' : 'warn'}>{overall}</StatusPill>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {checks.map((check) => (
          <StudioSurface key={check.service} glass className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black">{check.service}</h3>
              {check.status === 'healthy' ? <CheckCircle2 className="text-emerald-300" size={18} /> : <AlertTriangle className={check.status === 'down' ? 'text-red-300' : 'text-amber-300'} size={18} />}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusPill tone={check.status === 'healthy' ? 'good' : check.status === 'down' ? 'bad' : 'warn'}>{check.status}</StatusPill>
              <StatusPill>{check.responseTime}ms</StatusPill>
            </div>
            {check.error && <p className="mt-3 text-xs leading-5 text-red-200/70">{check.error}</p>}
          </StudioSurface>
        ))}
        {!checks.length && <EmptyState label="Run diagnostics to check database, auth, RPC, storage, and realtime." />}
      </div>
    </div>
  </StudioSurface>
);
