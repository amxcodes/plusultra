import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { MovieDetail } from './components/MovieDetail';
import { SearchPage } from './components/SearchPage';
import { AnimePage } from './components/AnimePage';
import { Row } from './components/Row';
import { HeroMovie, Movie, NavItem, Playlist } from './types';
import { TmdbService, requests } from './services/tmdb';
import { useMyList } from './hooks/useMyList';
import { useWatchHistory } from './components/useWatchHistory';
import { ErrorBoundary } from './components/ErrorBoundary';

import { CategoryRow } from './components/CategoryRow';
import { AsianDramaPage } from './components/AsianDramaPage';
import { ForYouPage } from './components/ForYouPage';


import { Footer } from './components/Footer';
import { SettingsPage } from './components/SettingsPage';
import { LibraryBig } from 'lucide-react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { AuthPage } from './components/AuthPage';
import { ProfilePage } from './components/ProfilePage';
import { PlaylistPage } from './components/PlaylistPage';
import { AdminDashboard } from './components/AdminDashboard';
import { SocialService } from './lib/social';
import { ToastProvider } from './lib/ToastContext';
import { ConfirmProvider } from './lib/ConfirmContext';
import { PlaylistRow } from './components/PlaylistRow';
import { AddToPlaylistModal } from './components/AddToPlaylistModal';
import { AnnouncementsPage } from './components/AnnouncementsPage';
import { ViewAllPage } from './components/ViewAllPage';
import { PlayerPage } from './components/PlayerPage';
import { ActivityPage } from './components/ActivityPage';
import { PlaylistsPage } from './components/PlaylistsPage';
import { StatsDashboard } from './components/StatsDashboard';
import { NewsFeed } from './components/NewsFeed';
import { RequestsPage } from './components/RequestsPage';
import { MobileNavbar } from './components/MobileNavbar';
import { MobileMenu } from './components/MobileMenu';
import { MobileHome } from './components/MobileHome';
import { MobileAdminDashboard } from './components/MobileAdminDashboard';
import { MobileStatsDashboard } from './components/MobileStatsDashboard';
import { MobileProfilePage } from './components/MobileProfilePage';
import { MobileSearchPage } from './components/MobileSearchPage';
import { MobileSettingsPage } from './components/MobileSettingsPage';
import { MobileNewsPage } from './components/MobileNewsPage';
import { MobileActivityPage } from './components/MobileActivityPage';
import { MobileAnnouncementsPage } from './components/MobileAnnouncementsPage';
import { MobileAddToPlaylistModal } from './components/MobileAddToPlaylistModal';
import { MobileWrappedPage } from './components/MobileWrappedPage';
import { MobileViewAllPage } from './components/MobileViewAllPage';
import { CuratorLabPage } from './components/CuratorLabPage';
import { GuestAccessPage } from './components/GuestAccessPage';
import { GuestExpiredPage } from './components/GuestExpiredPage';
import { isGuestExpired } from './lib/guestAccess';
import { DownloadQuestPage, type OfflineDownloadGroup } from './components/DownloadQuestPage';
import type { OfflineDownloadEntry } from './types';

type ViewAllCategoryState = {
  title: string;
  fetchUrl?: string;
  movies?: Movie[];
  forcedMediaType?: 'movie' | 'tv';
};

type PlayerState = {
  movie: Movie;
  season?: number;
  episode?: number;
};

type NavigationSnapshot = {
  activeTab: NavItem;
  isSearchOpen: boolean;
  isMobileMenuOpen: boolean;
  selectedMovie: Movie | null;
  selectedOfflineDownloads: OfflineDownloadEntry[] | null;
  offlinePlaybackUrl: string | null;
  selectedProfileId?: string;
  selectedPlaylistId?: string;
  playlistModalMovie: Movie | null;
  viewAllCategory: ViewAllCategoryState | null;
  playerState: PlayerState | null;
};

type AppHistoryState = {
  __streamNav: true;
  index: number;
  snapshot: NavigationSnapshot;
};

const isAppHistoryState = (state: unknown): state is AppHistoryState => {
  if (!state || typeof state !== 'object') return false;
  return '__streamNav' in state && (state as AppHistoryState).__streamNav === true;
};

const getGuestTokenFromPath = () => {
  if (typeof window === 'undefined') return null;
  const match = window.location.pathname.match(/^\/guest\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

function StreamApp() {
  const { user, loading, profile, signOut } = useAuth();
  const canStream = profile?.can_stream || profile?.role === 'admin';
  const guestToken = getGuestTokenFromPath();
  const [guestExpiryNow, setGuestExpiryNow] = useState(() => Date.now());
  const guestExpired = isGuestExpired(profile, guestExpiryNow);

  useEffect(() => {
    if (profile?.account_kind !== 'guest' || !profile.guest_expires_at) return;

    const expiresAt = new Date(profile.guest_expires_at).getTime();
    if (!Number.isFinite(expiresAt)) return;
    if (expiresAt <= Date.now()) {
      setGuestExpiryNow(Date.now());
      return;
    }

    const timeout = window.setTimeout(() => {
      setGuestExpiryNow(Date.now());
    }, expiresAt - Date.now() + 50);

    return () => window.clearTimeout(timeout);
  }, [profile?.account_kind, profile?.guest_expires_at]);


  const [activeTab, setActiveTab] = useState<NavItem>(NavItem.DASHBOARD);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);


  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [selectedOfflineDownloads, setSelectedOfflineDownloads] = useState<OfflineDownloadEntry[] | null>(null);
  const [offlinePlaybackUrl, setOfflinePlaybackUrl] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | undefined>(undefined);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | undefined>(undefined);
  const [playlistModalMovie, setPlaylistModalMovie] = useState<Movie | null>(null);
  const [viewAllCategory, setViewAllCategory] = useState<ViewAllCategoryState | null>(null);

  // Data State
  const [heroMovie, setHeroMovie] = useState<HeroMovie | null>(null);
  const [featuredMovies, setFeaturedMovies] = useState<Movie[]>([]);
  const [featuredPlaylists, setFeaturedPlaylists] = useState<Playlist[]>([]);
  const { list: myList } = useMyList();
  const { getContinueWatching } = useWatchHistory();
  const [continueWatching, setContinueWatching] = useState<Movie[]>([]);

  // Load Hero and Initial Data
  useEffect(() => {
    const loadData = async () => {
      // 1. Hero Data - Load basic info immediately, details in background
      const trending = await TmdbService.getTrending();
      if (trending.length > 0) {
        const random = trending[Math.floor(Math.random() * trending.length)];

        // Set basic hero immediately (unblocks render)
        setHeroMovie({
          ...random,
          tagline: "",
          genre: random.genre || [],
          duration: "",
          director: "",
          cast: []
        } as HeroMovie);

        // Fetch detailed info in background (non-blocking)
        TmdbService.getDetails(random.id.toString(), random.mediaType || 'movie')
          .then(details => {
            setHeroMovie(prev => prev ? {
              ...prev,
              ...details,
              tagline: details.tagline || "",
              genre: details.genre || prev.genre || [],
              duration: details.duration || "",
              director: details.director || "",
              cast: details.cast || []
            } as HeroMovie : null);
          })
          .catch(err => console.error("Failed to load hero details:", err));
      }

      // 2. Featured Content (runs in parallel with hero basic data)
      try {
        const [fMovies, fPlaylists] = await Promise.all([
          SocialService.getFeaturedMovies(),
          SocialService.getFeaturedPlaylists()
        ]);

        // Map featured movies metadata to Movie objects
        setFeaturedMovies((fMovies as any[]).map((m: any) => ({
          ...m.metadata,
          // Ensure ID is number as Component expects
          id: parseInt(m.tmdb_id),
          mediaType: m.media_type
        })));
        setFeaturedPlaylists(fPlaylists as Playlist[]);
      } catch (e) {
        console.error("Failed to load featured content", e);
      }
    };
    loadData();
  }, []);


  // ... imports


  // Hydrate Continue Watching from History
  useEffect(() => {
    if (activeTab === NavItem.DASHBOARD) {
      const items = getContinueWatching();
      const mappedItems = items.map(item => {
        // Calculate progress with fallback for unknown durations
        let progress = 0;
        if (item.duration > 0) {
          // Known duration: use exact calculation
          progress = item.time / item.duration;
        } else if (item.time > 0) {
          // Unknown duration: estimate based on typical lengths
          // Movies ~90min, TV episodes ~45min
          const estimatedDuration = item.type === 'movie' ? 90 * 60 : 45 * 60;
          progress = Math.min(item.time / estimatedDuration, 0.95); // Cap at 95%
        }

        // Determine best image
        // prioritizing 16:9 images for continue watching cards
        const image = item.episodeImage || item.backdropUrl || item.posterPath || "";

        // Ensure imageUrl is fully qualified if it's a relative path (though usually they are full URLs or TMDB paths)
        // Note: Our history saves them as full strings usually, but if relying on TMDB paths:
        const finalImage = image.startsWith('/') ? `https://image.tmdb.org/t/p/w500${image}` : image;

        return {
          ...item,
          id: parseInt(item.tmdbId),
          title: item.title || "Untitled",
          imageUrl: finalImage, // Critical fix for thumbnails
          year: item.year, // Don't fallback to current year for historical content
          match: item.voteAverage || 0,
          mediaType: item.type,
          progress, // For ContinueWatchingCard
          timeLeft: item.duration > 0 ? item.duration - item.time : 0
        } as unknown as Movie;
      });
      setContinueWatching(mappedItems);
    }
  }, [getContinueWatching, activeTab]);

  // Player State
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const historyIndexRef = useRef(0);
  const isRestoringHistoryRef = useRef(false);
  const basePathRef = useRef(
    typeof window !== 'undefined' && window.location.pathname.startsWith('/playlist/')
      ? '/'
      : (typeof window !== 'undefined' && window.location.pathname) || '/'
  );

  const buildSnapshot = (overrides: Partial<NavigationSnapshot> = {}): NavigationSnapshot => ({
    activeTab,
    isSearchOpen,
    isMobileMenuOpen,
    selectedMovie,
    selectedOfflineDownloads,
    offlinePlaybackUrl,
    selectedProfileId,
    selectedPlaylistId,
    playlistModalMovie,
    viewAllCategory,
    playerState,
    ...overrides,
  });

  const applySnapshot = (snapshot: NavigationSnapshot) => {
    setActiveTab(snapshot.activeTab);
    setIsSearchOpen(snapshot.isSearchOpen);
    setIsMobileMenuOpen(snapshot.isMobileMenuOpen);
    setSelectedMovie(snapshot.selectedMovie);
    setSelectedOfflineDownloads(snapshot.selectedOfflineDownloads);
    setOfflinePlaybackUrl(snapshot.offlinePlaybackUrl);
    setSelectedProfileId(snapshot.selectedProfileId);
    setSelectedPlaylistId(snapshot.selectedPlaylistId);
    setPlaylistModalMovie(snapshot.playlistModalMovie);
    setViewAllCategory(snapshot.viewAllCategory);
    setPlayerState(snapshot.playerState);
  };

  const getSnapshotUrl = (snapshot: NavigationSnapshot) => (
    snapshot.selectedPlaylistId ? `/playlist/${snapshot.selectedPlaylistId}` : basePathRef.current
  );

  const snapshotsMatch = (left: NavigationSnapshot, right: NavigationSnapshot) => (
    left.activeTab === right.activeTab &&
    left.isSearchOpen === right.isSearchOpen &&
    left.isMobileMenuOpen === right.isMobileMenuOpen &&
    left.selectedMovie === right.selectedMovie &&
    left.selectedOfflineDownloads === right.selectedOfflineDownloads &&
    left.offlinePlaybackUrl === right.offlinePlaybackUrl &&
    left.selectedProfileId === right.selectedProfileId &&
    left.selectedPlaylistId === right.selectedPlaylistId &&
    left.playlistModalMovie === right.playlistModalMovie &&
    left.viewAllCategory === right.viewAllCategory &&
    left.playerState === right.playerState
  );

  const commitSnapshot = (snapshot: NavigationSnapshot, mode: 'push' | 'replace' = 'push', options?: { scrollToTop?: boolean }) => {
    const currentSnapshot = buildSnapshot();
    if (mode === 'push' && snapshotsMatch(snapshot, currentSnapshot)) {
      return;
    }

    const nextIndex = mode === 'push' ? historyIndexRef.current + 1 : historyIndexRef.current;
    historyIndexRef.current = nextIndex;

    const historyState: AppHistoryState = {
      __streamNav: true,
      index: nextIndex,
      snapshot,
    };

    if (mode === 'push') {
      window.history.pushState(historyState, '', getSnapshotUrl(snapshot));
    } else {
      window.history.replaceState(historyState, '', getSnapshotUrl(snapshot));
    }

    applySnapshot(snapshot);

    if (options?.scrollToTop ?? true) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  const navigateBack = (fallbackSnapshot: NavigationSnapshot, options?: { scrollToTop?: boolean }) => {
    if (isAppHistoryState(window.history.state) && historyIndexRef.current > 0) {
      window.history.back();
      return;
    }

    commitSnapshot(fallbackSnapshot, 'replace', options);
  };

  const openSearch = () => {
    commitSnapshot(buildSnapshot({
      isSearchOpen: true,
      isMobileMenuOpen: false,
      selectedMovie: null,
    }), 'push', { scrollToTop: false });
  };

  const closeSearch = () => {
    navigateBack(buildSnapshot({ isSearchOpen: false }), { scrollToTop: false });
  };

  const openMobileMenu = () => {
    commitSnapshot(buildSnapshot({ isMobileMenuOpen: true }), 'push', { scrollToTop: false });
  };

  const closeMobileMenu = () => {
    navigateBack(buildSnapshot({ isMobileMenuOpen: false }), { scrollToTop: false });
  };

  const openViewAll = (category: ViewAllCategoryState) => {
    commitSnapshot(buildSnapshot({
      viewAllCategory: category,
      isSearchOpen: false,
      isMobileMenuOpen: false,
    }));
  };

  const closeViewAll = () => {
    navigateBack(buildSnapshot({ viewAllCategory: null }));
  };

  const openPlaylistModal = (movie: Movie) => {
    commitSnapshot(buildSnapshot({ playlistModalMovie: movie }), 'push', { scrollToTop: false });
  };

  const closePlaylistModal = () => {
    navigateBack(buildSnapshot({ playlistModalMovie: null }), { scrollToTop: false });
  };

  // Revoke access immediately across shared desktop/mobile routes.
  useEffect(() => {
    if (canStream) return;

    if (playerState) {
      console.log('[Security] Streaming permission revoked - clearing player');
      commitSnapshot(buildSnapshot({ playerState: null }), 'replace', { scrollToTop: false });
      return;
    }

    if (activeTab === NavItem.STATS || activeTab === NavItem.REQUESTS) {
      console.log('[Security] Streaming permission revoked - redirecting to dashboard');
      commitSnapshot(buildSnapshot({
        activeTab: NavItem.DASHBOARD,
        isMobileMenuOpen: false,
      }), 'replace');
    }
  }, [activeTab, canStream, playerState]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (!isAppHistoryState(event.state)) return;

      historyIndexRef.current = event.state.index;
      isRestoringHistoryRef.current = true;
      applySnapshot(event.state.snapshot);
      window.scrollTo({ top: 0, behavior: 'auto' });
    };

    if (isAppHistoryState(window.history.state)) {
      historyIndexRef.current = window.history.state.index;
      applySnapshot(window.history.state.snapshot);
    } else {
      const initialSnapshot = buildSnapshot();
      window.history.replaceState({
        __streamNav: true,
        index: 0,
        snapshot: initialSnapshot,
      } satisfies AppHistoryState, '', getSnapshotUrl(initialSnapshot));
    }

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    const snapshot = buildSnapshot();
    window.history.replaceState({
      __streamNav: true,
      index: historyIndexRef.current,
      snapshot,
    } satisfies AppHistoryState, '', getSnapshotUrl(snapshot));

    if (isRestoringHistoryRef.current) {
      isRestoringHistoryRef.current = false;
    }
  }, [
    activeTab,
    isSearchOpen,
    isMobileMenuOpen,
    selectedMovie,
    selectedOfflineDownloads,
    offlinePlaybackUrl,
    selectedProfileId,
    selectedPlaylistId,
    playlistModalMovie,
    viewAllCategory,
    playerState,
  ]);

  // Reset to Dashboard on logout so next login starts at Home
  useEffect(() => {
    if (!user) {
      setActiveTab(NavItem.DASHBOARD);
      setSelectedMovie(null);
      setSelectedOfflineDownloads(null);
      setOfflinePlaybackUrl(null);
      setPlayerState(null);
      setIsSearchOpen(false);
      setSelectedPlaylistId(undefined);
      setPlaylistModalMovie(null);
      setViewAllCategory(null);
    }
  }, [user]);

  // Playlist Deep Linking
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/\/playlist\/([a-zA-Z0-9-]+)/);
    if (match && match[1]) {
      setSelectedPlaylistId(match[1]);
    }
  }, []);


  const handleMovieSelect = (movie: Movie) => {
    commitSnapshot(buildSnapshot({
      selectedMovie: movie,
      selectedOfflineDownloads: null,
      offlinePlaybackUrl: null,
      isMobileMenuOpen: false,
    }), 'push', { scrollToTop: false });
  };

  const handlePlay = (movie: Movie, season?: number, episode?: number) => {
    commitSnapshot(buildSnapshot({
      playerState: { movie, season, episode },
      offlinePlaybackUrl: null,
      isMobileMenuOpen: false,
    }), 'push', { scrollToTop: false });
  };

  const handlePlayerEpisodeChange = (season: number, episode: number) => {
    if (!playerState) return;

    commitSnapshot(buildSnapshot({
      playerState: {
        movie: playerState.movie,
        season,
        episode,
      },
      isMobileMenuOpen: false,
    }), 'replace', { scrollToTop: false });
  };

  const handleContinueWatchingSelect = (movie: Movie) => {
    const season = typeof movie.season === 'number' ? movie.season : undefined;
    const episode = typeof movie.episode === 'number' ? movie.episode : undefined;

    handlePlay(movie, season, episode);
  };

  const handlePlaylistSelect = (playlist: Playlist) => {
    commitSnapshot(buildSnapshot({
      selectedPlaylistId: playlist.id,
      isSearchOpen: false,
      isMobileMenuOpen: false,
    }));
  };

  const handleCloseDetail = () => {
    navigateBack(buildSnapshot({
      selectedMovie: null,
      selectedOfflineDownloads: null,
      offlinePlaybackUrl: null,
    }), { scrollToTop: false });
  };

  const handleOfflineGroupSelect = (group: OfflineDownloadGroup) => {
    commitSnapshot(buildSnapshot({
      selectedMovie: group.movie,
      selectedOfflineDownloads: group.entries,
      offlinePlaybackUrl: null,
      isMobileMenuOpen: false,
    }), 'push', { scrollToTop: false });
  };

  const handlePlayOffline = async (download: OfflineDownloadEntry) => {
    if (!window.desktop) return;

    const playback = await window.desktop.getOfflinePlaybackUrl(download.id);
    if (!playback.ok || !playback.url) {
      return;
    }

    commitSnapshot(buildSnapshot({
      selectedMovie: {
        id: download.tmdbId,
        tmdbId: download.tmdbId,
        title: download.title,
        imageUrl: download.imageUrl,
        backdropUrl: download.backdropUrl,
        description: download.description,
        genre: download.genre,
        year: download.year,
        match: 100,
        mediaType: download.mediaType,
      },
      selectedOfflineDownloads,
      offlinePlaybackUrl: playback.url,
      playerState: {
        movie: {
          id: download.tmdbId,
          tmdbId: download.tmdbId,
          title: download.title,
          imageUrl: download.imageUrl,
          backdropUrl: download.backdropUrl,
          description: download.description,
          genre: download.genre,
          year: download.year,
          match: 100,
          mediaType: download.mediaType,
        },
        season: download.season,
        episode: download.episode,
      },
      isMobileMenuOpen: false,
    }), 'push', { scrollToTop: false });
  };

  const handleTabChange = (tab: NavItem, params?: any) => {
    commitSnapshot(buildSnapshot({
      activeTab: tab,
      selectedOfflineDownloads: null,
      offlinePlaybackUrl: null,
      selectedProfileId: tab === NavItem.PROFILE ? params?.id : undefined,
      selectedPlaylistId: undefined,
      viewAllCategory: null,
      selectedMovie: null,
      playerState: null,
      playlistModalMovie: null,
      isSearchOpen: false,
      isMobileMenuOpen: false,
    }));
  };

  const handleNavigate = (page: string, params?: any) => {
    if (page === 'profile') {
      commitSnapshot(buildSnapshot({
        activeTab: NavItem.PROFILE,
        selectedOfflineDownloads: null,
        offlinePlaybackUrl: null,
        selectedProfileId: params?.id,
        selectedPlaylistId: undefined,
        viewAllCategory: null,
        selectedMovie: null,
        playerState: null,
        isSearchOpen: false,
        isMobileMenuOpen: false,
      }));
    } else if (page === 'playlist') {
      commitSnapshot(buildSnapshot({
        selectedOfflineDownloads: null,
        offlinePlaybackUrl: null,
        selectedPlaylistId: params?.id,
        selectedMovie: null,
        isSearchOpen: false,
        isMobileMenuOpen: false,
      }));
    }
  };

  if (guestToken) {
    return <GuestAccessPage token={guestToken} />;
  }

  if (loading) return <div className="min-h-screen bg-[#0f1014] flex items-center justify-center text-white">Loading...</div>;
  if (!user) return <AuthPage />;
  if (guestExpired) {
    return <GuestExpiredPage profile={profile} onSignOut={signOut} />;
  }

  // Render Player Page if active AND user has streaming permission
  if (playerState && canStream) {
    return (
      <PlayerPage
        movie={playerState.movie}
        season={playerState.season}
        episode={playerState.episode}
        offlinePlaybackUrl={offlinePlaybackUrl}
        onPlayEpisode={handlePlayerEpisodeChange}
        onBack={() => {
          navigateBack(buildSnapshot({
            playerState: null,
            offlinePlaybackUrl: null,
          }), { scrollToTop: false });
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1014] text-white selection:bg-white/30 selection:text-white font-sans overflow-x-hidden pb-16 md:pb-0">
      <div className="hidden md:block">
        <Navbar
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          onSearchClick={openSearch}
        />
      </div>

      <div className="md:hidden">
        <MobileNavbar
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          onSearchClick={openSearch}
          onMenuClick={openMobileMenu}
        />
        <MobileMenu
          isOpen={isMobileMenuOpen}
          onClose={closeMobileMenu}
          activeTab={activeTab}
          setActiveTab={handleTabChange}
        />
      </div>

      {selectedMovie && (
        <MovieDetail
          movie={selectedMovie}
          onClose={handleCloseDetail}
          onPlay={handlePlay}
          onPlayOffline={handlePlayOffline}
          offlineDownloads={selectedOfflineDownloads}
          similarMovies={[]}
          onMovieSelect={handleMovieSelect}
        />
      )}

      {/* Rest of the app... */}
      <div className={`transition-opacity duration-300 ${selectedMovie ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {isSearchOpen ? (
          <div className="fixed inset-0 z-50 bg-[#0f1014] animate-in fade-in duration-500 overflow-y-auto custom-scrollbar">
            <div className="hidden md:block">
              <SearchPage
                onMovieSelect={handleMovieSelect}
                onNavigate={handleNavigate}
              />
            </div>
            <div className="md:hidden">
              <MobileSearchPage
                onMovieSelect={handleMovieSelect}
                onNavigate={handleNavigate}
                onClose={closeSearch}
              />
            </div>
          </div>
        ) : (
          <div>
            {activeTab === NavItem.DASHBOARD && !selectedPlaylistId && !viewAllCategory && (
              <div className="hidden md:block">
                <Hero
                  movie={heroMovie || {
                    id: 0,
                    title: "Loading...",
                    year: 2024,
                    match: 0,
                    imageUrl: "",
                    backdropUrl: "",
                    description: ""
                  }}
                  onPlay={(m) => handlePlay(m as Movie)}
                  onAddToPlaylist={(m) => openPlaylistModal(m as Movie)}
                />
              </div>
            )}


            {/* Desktop: pl-10 (Strict Original) | Mobile: px-0 (MobileHome handles padding) */}
            <div className={`${activeTab === NavItem.DASHBOARD && !viewAllCategory && !selectedPlaylistId ? '-mt-32' : (activeTab === NavItem.NEWS ? '' : 'pt-0 md:pt-20')} relative z-20 px-0 md:pl-10 md:pr-0 space-y-2`}>

              {/* MOBILE HOME VIEW (Handles Dashboard, Movies, Series) - My List moved to separate view */}
              {!viewAllCategory && !selectedPlaylistId && [NavItem.DASHBOARD, NavItem.MOVIES, NavItem.SERIES].includes(activeTab) && (
                <div className="md:hidden">
                  <MobileHome
                    heroMovie={heroMovie}
                    featuredMovies={featuredMovies}
                    featuredPlaylists={featuredPlaylists}
                    continueWatching={continueWatching}
                    myList={myList}
                    activeTab={activeTab}
                    viewAllCategory={viewAllCategory}
                    onPlay={(m) => handlePlay(m)}
                    onContinueWatchingSelect={handleContinueWatchingSelect}
                    onMovieSelect={handleMovieSelect}
                    onPlaylistSelect={handlePlaylistSelect}
                    onAddToPlaylist={(m) => openPlaylistModal(m)}
                    onViewAll={openViewAll}
                  />
                </div>
              )}

              {/* VIEW ALL PAGE (Desktop & Mobile) */}
              {viewAllCategory && (
                <>
                  <div className="hidden md:block px-4 md:px-0">
                    <ViewAllPage
                      title={viewAllCategory.title}
                      fetchUrl={viewAllCategory.fetchUrl}
                      initialMovies={viewAllCategory.movies}
                      forcedMediaType={viewAllCategory.forcedMediaType}
                      onBack={closeViewAll}
                      onMovieSelect={viewAllCategory.title === 'Continue Watching' ? handleContinueWatchingSelect : handleMovieSelect}
                    />
                  </div>
                  <div className="md:hidden fixed inset-0 z-50 bg-[#0f1014] overflow-y-auto w-full">
                    <MobileViewAllPage
                      title={viewAllCategory.title}
                      fetchUrl={viewAllCategory.fetchUrl}
                      initialMovies={viewAllCategory.movies}
                      forcedMediaType={viewAllCategory.forcedMediaType}
                      onBack={closeViewAll}
                      onMovieSelect={viewAllCategory.title === 'Continue Watching' ? handleContinueWatchingSelect : handleMovieSelect}
                    />
                  </div>
                </>
              )}

              {activeTab === NavItem.DOWNLOAD_QUEST && window.desktop?.isDesktop && !viewAllCategory && !selectedPlaylistId && (
                <DownloadQuestPage onSelectGroup={handleOfflineGroupSelect} />
              )}

              {/* DASHBOARD VIEW (Desktop) */}
              {activeTab === NavItem.DASHBOARD && !viewAllCategory && (
                <div className="hidden md:block">
                  {continueWatching.length > 0 && canStream && (
                    <Row
                      title="Continue Watching"
                      movies={continueWatching}
                      onMovieSelect={handleContinueWatchingSelect}
                      variant="continue-watching"
                      onViewAll={() => openViewAll({ title: "Continue Watching", movies: continueWatching })}
                    />
                  )}

                  {/* Featured Movies */}
                  {featuredMovies.length > 0 && (
                    <Row
                      title="Featured Movies"
                      movies={featuredMovies}
                      onMovieSelect={handleMovieSelect}
                      onViewAll={() => openViewAll({ title: "Featured Movies", movies: featuredMovies })}
                    />
                  )}

                  {/* Featured Playlists */}
                  {featuredPlaylists.length > 0 && (
                    <PlaylistRow
                      title="Featured Playlists"
                      playlists={featuredPlaylists}
                      onPlaylistSelect={handlePlaylistSelect}
                    />
                  )}







                  <Row title="Trending Now" fetchUrl={requests.fetchTrending} onMovieSelect={handleMovieSelect} isLarge onViewAll={() => openViewAll({ title: "Trending Now", fetchUrl: requests.fetchTrending })} />
                  <Row title="Top Rated" fetchUrl={requests.fetchTopRated} onMovieSelect={handleMovieSelect} onViewAll={() => openViewAll({ title: "Top Rated", fetchUrl: requests.fetchTopRated })} />
                  <Row title="Action Blockbusters" fetchUrl={requests.fetchActionMovies} onMovieSelect={handleMovieSelect} onViewAll={() => openViewAll({ title: "Action Blockbusters", fetchUrl: requests.fetchActionMovies })} />
                  <Row title="Comedy Hits" fetchUrl={requests.fetchComedyMovies} onMovieSelect={handleMovieSelect} onViewAll={() => openViewAll({ title: "Comedy Hits", fetchUrl: requests.fetchComedyMovies })} />
                  <Row title="Scary Movies" fetchUrl={requests.fetchHorrorMovies} onMovieSelect={handleMovieSelect} onViewAll={() => openViewAll({ title: "Scary Movies", fetchUrl: requests.fetchHorrorMovies })} />
                  <Row title="Romance" fetchUrl={requests.fetchRomanceMovies} onMovieSelect={handleMovieSelect} onViewAll={() => openViewAll({ title: "Romance", fetchUrl: requests.fetchRomanceMovies })} />
                  <Row title="Documentaries" fetchUrl={requests.fetchDocumentaries} onMovieSelect={handleMovieSelect} onViewAll={() => openViewAll({ title: "Documentaries", fetchUrl: requests.fetchDocumentaries })} />
                </div>
              )}

              {/* MOVIES ONLY VIEW */}
              {/* MOVIES ONLY VIEW (Desktop) */}
              {activeTab === NavItem.MOVIES && !viewAllCategory && (
                <div className="hidden md:block">
                  <Row title="Trending Movies" fetchUrl={requests.fetchTrending} forcedMediaType='movie' onMovieSelect={handleMovieSelect} isLarge onViewAll={() => openViewAll({ title: "Trending Movies", fetchUrl: requests.fetchTrending, forcedMediaType: 'movie' })} />
                  <Row title="Romance" fetchUrl={requests.fetchRomanceMovies} forcedMediaType='movie' onMovieSelect={handleMovieSelect} onViewAll={() => openViewAll({ title: "Romance", fetchUrl: requests.fetchRomanceMovies, forcedMediaType: 'movie' })} />
                </div>
              )}

              {/* TV SERIES ONLY VIEW */}
              {/* TV SERIES ONLY VIEW (Desktop) */}
              {activeTab === NavItem.SERIES && !viewAllCategory && (
                <div className="hidden md:block">
                  <Row title="Trending TV" fetchUrl={requests.fetchNetflixOriginals} forcedMediaType='tv' onMovieSelect={handleMovieSelect} isLarge onViewAll={() => openViewAll({ title: "Trending TV", fetchUrl: requests.fetchNetflixOriginals, forcedMediaType: 'tv' })} />
                  <Row title="Top Rated TV" fetchUrl={requests.fetchTopRated} forcedMediaType='tv' onMovieSelect={handleMovieSelect} onViewAll={() => openViewAll({ title: "Top Rated TV", fetchUrl: requests.fetchTopRated, forcedMediaType: 'tv' })} />
                  <Row title="Action & Adventure" fetchUrl={requests.fetchActionMovies} forcedMediaType='tv' onMovieSelect={handleMovieSelect} onViewAll={() => openViewAll({ title: "Action & Adventure", fetchUrl: requests.fetchActionMovies, forcedMediaType: 'tv' })} />
                  <Row title="Comedy Series" fetchUrl={requests.fetchComedyMovies} forcedMediaType='tv' onMovieSelect={handleMovieSelect} onViewAll={() => openViewAll({ title: "Comedy Series", fetchUrl: requests.fetchComedyMovies, forcedMediaType: 'tv' })} />
                  <Row title="Documentary Series" fetchUrl={requests.fetchDocumentaries} forcedMediaType='tv' onMovieSelect={handleMovieSelect} onViewAll={() => openViewAll({ title: "Documentary Series", fetchUrl: requests.fetchDocumentaries, forcedMediaType: 'tv' })} />
                </div>
              )}

              {/* ANIME VIEW */}
              {activeTab === NavItem.ANIME && !viewAllCategory && (
                <AnimePage
                  onMovieSelect={handleMovieSelect}
                  onViewAll={openViewAll}
                />
              )}

              {/* ASIAN DRAMA VIEW */}
              {activeTab === NavItem.ASIAN_DRAMA && !viewAllCategory && (
                <AsianDramaPage
                  onMovieSelect={handleMovieSelect}
                  onViewAll={openViewAll}
                />
              )}

              {/* FOR YOU VIEW */}
              {activeTab === NavItem.FOR_YOU && (
                <ForYouPage onMovieSelect={handleMovieSelect} />
              )}

              {/* CURATOR LAB VIEW */}
              {activeTab === NavItem.CURATOR && (
                <CuratorLabPage
                  onMovieSelect={handleMovieSelect}
                  onPlaylistSelect={handlePlaylistSelect}
                />
              )}


              {/* MY LIST VIEW */}
              {activeTab === NavItem.MY_LIST && (
                <>
                  <div className="hidden md:block px-12">
                    <h2 className="text-2xl font-bold mb-8">My List</h2>
                    {myList.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {myList.map(movie => (
                          <div key={movie.id} onClick={() => handleMovieSelect(movie)} className="cursor-pointer hover:scale-105 transition-transform">
                            <div className="aspect-[2/3] relative rounded-lg overflow-hidden">
                              <img src={movie.imageUrl} alt={movie.title} className="w-full h-full object-cover" />
                            </div>
                            <p className="mt-2 text-sm text-gray-300 truncate">{movie.title}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                        <div className="bg-zinc-900 p-6 rounded-full mb-4">
                          <LibraryBig size={48} className="text-zinc-500" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Your list is empty</h3>
                        <p className="text-zinc-500 max-w-md">
                          Movies and TV shows you add to your list will appear here.
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="md:hidden">
                    <MobileViewAllPage
                      title="My List"
                      initialMovies={myList}
                      onBack={() => navigateBack(buildSnapshot({ activeTab: NavItem.DASHBOARD }))}
                      onMovieSelect={handleMovieSelect}
                    />
                  </div>
                </>
              )}

              {/* SETTINGS VIEW */}
              {activeTab === NavItem.SETTINGS && (
                <>
                  <div className="hidden md:block">
                    <SettingsPage />
                  </div>
                  <div className="md:hidden">
                    <MobileSettingsPage />
                  </div>
                </>
              )}

              {/* ADMIN DASHBOARD VIEW */}
              {activeTab === NavItem.ADMIN && (
                <>
                  <div className="hidden md:block">
                    <AdminDashboard onNavigate={handleNavigate} />
                  </div>
                  <div className="md:hidden">
                    <MobileAdminDashboard onNavigate={handleNavigate} />
                  </div>
                </>
              )}

              {/* PROFILE VIEW */}
              {activeTab === NavItem.PROFILE && !selectedPlaylistId && (
                <>
                  <div className="hidden md:block">
                    <ProfilePage
                      userId={selectedProfileId}
                      onNavigate={handleNavigate}
                      onMovieSelect={handleMovieSelect}
                    />
                  </div>
                  <div className="md:hidden">
                    <MobileProfilePage
                      userId={selectedProfileId}
                      onNavigate={handleNavigate}
                      onMovieSelect={handleMovieSelect}
                    />
                  </div>
                </>
              )}

              {/* ANNOUNCEMENTS VIEW */}
              {activeTab === NavItem.ANNOUNCEMENTS && (
                <>
                  <div className="hidden md:block">
                    <AnnouncementsPage />
                  </div>
                  <div className="md:hidden">
                    <MobileAnnouncementsPage />
                  </div>
                </>
              )}

              {/* ACTIVITY VIEW */}
              {activeTab === NavItem.ACTIVITY && (
                <>
                  <div className="hidden md:block">
                    <ActivityPage onNavigate={handleNavigate} />
                  </div>
                  <div className="md:hidden">
                    <MobileActivityPage onNavigate={handleNavigate} />
                  </div>
                </>
              )}

              {/* PLAYLISTS VIEW */}
              {activeTab === NavItem.PLAYLISTS && !selectedPlaylistId && (
                <PlaylistsPage
                  onBack={() => navigateBack(buildSnapshot({ activeTab: NavItem.DASHBOARD }))}
                  onPlaylistSelect={handlePlaylistSelect}
                />
              )}

              {/* STATS VIEW */}
              {activeTab === NavItem.STATS && canStream && (
                <>
                  <div className="hidden md:block">
                    <StatsDashboard />
                  </div>
                  <div className="md:hidden">
                    <MobileStatsDashboard />
                  </div>
                </>
              )}

              {/* NEWS FEED VIEW */}
              {activeTab === NavItem.NEWS && !viewAllCategory && (
                <>
                  <div className="hidden md:block">
                    <NewsFeed onMovieSelect={handleMovieSelect} />
                  </div>
                  <div className="md:hidden">
                    <MobileNewsPage onMovieSelect={handleMovieSelect} />
                  </div>
                </>
              )}

              {/* REQUESTS VIEW */}
              {activeTab === NavItem.REQUESTS && canStream && !viewAllCategory && (
                <RequestsPage />
              )}

              {/* Add To Playlist Modal (Global generic overlay) */}
              {playlistModalMovie && (
                <>
                  <div className="hidden md:flex fixed inset-0 z-[60] items-center justify-center">
                    <AddToPlaylistModal
                      movie={playlistModalMovie}
                      onClose={closePlaylistModal}
                    />
                  </div>
                  <div className="md:hidden">
                    <MobileAddToPlaylistModal
                      movie={playlistModalMovie}
                      onClose={closePlaylistModal}
                    />
                  </div>
                </>
              )}


              {/* PLAYLIST VIEW (Overrides others if active) */}
              {selectedPlaylistId && (
                <div className="absolute inset-0 bg-[#0f1014] z-30 min-h-screen">
                  <PlaylistPage
                    playlistId={selectedPlaylistId}
                    onMovieSelect={handleMovieSelect}
                    onBack={() => navigateBack(buildSnapshot({ selectedPlaylistId: undefined }))}
                  />
                </div>
              )}

              <Footer />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <ErrorBoundary>
            <StreamApp />
          </ErrorBoundary>
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
