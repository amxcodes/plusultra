import React, { useEffect, useMemo, useState } from 'react';
import { LibraryBig } from 'lucide-react';
import { HeroMovie, Movie, NavItem, Playlist, Profile } from '../../types';
import { requests } from '../../services/tmdb';
import { getUiPreferences, subscribeToUiPreferences, UiPreferences } from '../../lib/uiPreferences';
import { StudioThemeProvider } from './system/StudioThemeProvider';
import { StudioHeader, StudioBottomDock } from './layout/StudioHeader';
import { StudioHero } from './media/StudioHero';
import { StudioRow } from './media/StudioRow';
import { StudioMediaDrawer } from './media/StudioMediaDrawer';
import { StudioMediaCard } from './media/StudioMediaCard';
import { StudioSearchOverlay } from './pages/StudioSearchOverlay';
import { StudioSettingsPage } from './pages/StudioSettingsPage';
import { StudioViewAllPage } from './pages/StudioViewAllPage';
import { StudioPlaylistDetailPage } from './pages/StudioPlaylistDetailPage';
import { StudioProfilePage } from './pages/StudioProfilePage';
import { StudioPageFrame } from './system/StudioPageFrame';
import { StudioSurface } from './system/StudioSurface';
import { StudioButton } from './system/StudioButton';
import { StudioPlaylistCard, StudioPlaylistsPage } from './pages/StudioPlaylistsPage';
import { AdminDashboard } from '../AdminDashboard';
import { ActivityPage } from '../ActivityPage';
import { MessagesPage } from '../MessagesPage';
import { AnnouncementsPage } from '../AnnouncementsPage';
import { StatsDashboard } from '../StatsDashboard';
import { StudioNewsPage } from './pages/StudioNewsPage';
import { StudioSportsPage } from './pages/StudioSportsPage';
import { StudioProviderRow } from './media/StudioProviderRow';
import { RequestsPage } from '../RequestsPage';
import { CuratorLabPage } from '../CuratorLabPage';
import { AnimePage } from '../AnimePage';
import { AsianDramaPage } from '../AsianDramaPage';
import { ForYouPage } from '../ForYouPage';
import type { OfflineDownloadGroup } from '../DownloadQuestPage';
import { StudioDownloadsPage } from './pages/StudioDownloadsPage';
import { StudioAddToPlaylistSheet } from './media/StudioAddToPlaylistSheet';
import { LatestTrailersByCountrySection } from '../LatestTrailersByCountrySection';
import type { ActivityFeedTab } from '../../hooks/useActivityFeed';
import type { CountryTrailerGroup } from '../../services/latestTrailers';
import type { OfflineDownloadEntry } from '../../types';

type ViewAllCategoryState = {
  title: string;
  fetchUrl?: string;
  movies?: Movie[];
  forcedMediaType?: 'movie' | 'tv';
};

interface StudioShellProps {
  activeTab: NavItem;
  setActiveTab: (tab: NavItem, params?: any) => void;
  isSearchOpen: boolean;
  closeSearch: () => void;
  openSearch: () => void;
  selectedMovie: Movie | null;
  closeDetail: () => void;
  selectedPlaylistId?: string;
  selectedProfileId?: string;
  selectedMessageConversationId?: string;
  selectedActivityTab: ActivityFeedTab;
  viewAllCategory: ViewAllCategoryState | null;
  closeViewAll: () => void;
  openViewAll: (category: ViewAllCategoryState) => void;
  playlistModalMovie: Movie | null;
  closePlaylistModal: () => void;
  openPlaylistModal: (movie: Movie) => void;
  heroMovie: HeroMovie | null;
  featuredMovies: Movie[];
  featuredPlaylists: Playlist[];
  communityTrending: Movie[];
  latestTrailerGroups: CountryTrailerGroup[];
  continueWatching: Movie[];
  myList: Movie[];
  canStream: boolean;
  profile?: Profile | null;
  messageUnreadCount: number;
  onMovieSelect: (movie: Movie) => void;
  onContinueWatchingSelect: (movie: Movie) => void;
  onPlay: (movie: Movie, season?: number, episode?: number) => void;
  onPlaylistSelect: (playlist: Playlist) => void;
  onNavigate: (page: string, params?: any) => void;
  onConversationChange: (conversationId?: string) => void;
  onOfflineGroupSelect: (group: OfflineDownloadGroup) => void;
  onSearchMovieSelect: (movie: Movie) => void;
}

const useStudioSmoothScroll = (preferences: UiPreferences, disabled: boolean) => {
  useEffect(() => {
    if (
      disabled
      || !preferences.smoothScroll
      || preferences.reduceMotion
      || !window.matchMedia('(pointer: fine)').matches
    ) return;

    let lenis: any;
    let frame = 0;
    let cancelled = false;

    import('lenis').then(({ default: Lenis }) => {
      if (cancelled) return;
      lenis = new Lenis({
        duration: 0.68,
        smoothWheel: true,
        wheelMultiplier: 0.8,
      });

      const raf = (time: number) => {
        if (!document.hidden) lenis?.raf(time);
        frame = window.requestAnimationFrame(raf);
      };

      frame = window.requestAnimationFrame(raf);
    });

    return () => {
      cancelled = true;
      if (frame) window.cancelAnimationFrame(frame);
      lenis?.destroy?.();
    };
  }, [disabled, preferences.reduceMotion, preferences.smoothScroll]);
};

export const StudioShell: React.FC<StudioShellProps> = (props) => {
  const [preferences, setPreferences] = useState<UiPreferences>(() => getUiPreferences());
  const drawerOpen = Boolean(props.selectedMovie);
  useStudioSmoothScroll(preferences, props.isSearchOpen || drawerOpen);

  useEffect(() => subscribeToUiPreferences(setPreferences), []);

  const playTitle = (movie: Movie, season?: number, episode?: number) => {
    if (!props.canStream) return;

    if (movie.mediaType === 'tv') {
      props.onPlay(movie, season || movie.season || 1, episode || movie.episode || 1);
      return;
    }

    props.onPlay(movie);
  };
  const studioPlay = props.canStream ? playTitle : undefined;

  const homeRows = useMemo(() => [
    { title: 'Trending Now', fetchUrl: requests.fetchTrending },
    { title: 'Top Rated', fetchUrl: requests.fetchTopRated },
    { title: 'Action Blockbusters', fetchUrl: requests.fetchActionMovies },
    { title: 'Comedy Hits', fetchUrl: requests.fetchComedyMovies },
  ], []);

  const renderHome = () => (
    <>
      <StudioHero
        movie={props.heroMovie}
        onPlay={studioPlay}
        onInfo={props.onMovieSelect}
        onAddToPlaylist={props.openPlaylistModal}
      />
      <div className="relative z-10 -mt-16 pb-20">
        {props.continueWatching.length > 0 && props.canStream && (
          <StudioRow
            title="Continue Watching"
            movies={props.continueWatching}
            variant="landscape"
            onMovieSelect={props.onContinueWatchingSelect}
            onPlay={props.onContinueWatchingSelect}
            onAddToPlaylist={props.openPlaylistModal}
            onViewAll={() => props.openViewAll({ title: 'Continue Watching', movies: props.continueWatching })}
          />
        )}
        {props.canStream && (
          <>
            <StudioProviderRow mediaType="movie" onMovieSelect={props.onMovieSelect} onPlay={playTitle} onAddToPlaylist={props.openPlaylistModal} />
            <StudioProviderRow mediaType="tv" onMovieSelect={props.onMovieSelect} onPlay={playTitle} onAddToPlaylist={props.openPlaylistModal} />
          </>
        )}
        {props.featuredMovies.length > 0 && (
          <StudioRow
            title="Featured Movies"
            movies={props.featuredMovies}
            onMovieSelect={props.onMovieSelect}
            onPlay={studioPlay}
            onAddToPlaylist={props.openPlaylistModal}
            onViewAll={() => props.openViewAll({ title: 'Featured Movies', movies: props.featuredMovies })}
          />
        )}
        {props.featuredPlaylists.length > 0 && (
          <div className="mx-auto max-w-[1500px] px-4 py-5 md:px-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">Featured Playlists</h2>
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {props.featuredPlaylists.slice(0, 6).map(playlist => (
                <StudioPlaylistCard key={playlist.id} playlist={playlist} onClick={() => props.onPlaylistSelect(playlist)} />
              ))}
            </div>
          </div>
        )}
        {props.communityTrending.length > 0 && (
          <StudioRow
            title="Trending With Users"
            movies={props.communityTrending}
            onMovieSelect={props.onMovieSelect}
            onPlay={studioPlay}
            onAddToPlaylist={props.openPlaylistModal}
            onViewAll={() => props.openViewAll({ title: 'Trending With Users', movies: props.communityTrending })}
          />
        )}
        <LatestTrailersByCountrySection groups={props.latestTrailerGroups} />
        {homeRows.map(row => (
          <StudioRow
            key={row.title}
            title={row.title}
            fetchUrl={row.fetchUrl}
            onMovieSelect={props.onMovieSelect}
            onPlay={studioPlay}
            onAddToPlaylist={props.openPlaylistModal}
            onViewAll={() => props.openViewAll({ title: row.title, fetchUrl: row.fetchUrl })}
          />
        ))}
      </div>
    </>
  );

  const renderGrid = (title: string, movies: Movie[], emptyCopy: string) => (
    <StudioPageFrame title={title}>
      {movies.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
          {movies.map(movie => (
            <StudioMediaCard key={`${movie.mediaType || 'movie'}-${movie.id}`} movie={movie} onSelect={props.onMovieSelect} onPlay={studioPlay} onAddToPlaylist={props.openPlaylistModal} />
          ))}
        </div>
      ) : (
        <StudioSurface className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
          <LibraryBig size={42} className="mb-4 text-white/30" />
          <h3 className="text-xl font-semibold text-white">{emptyCopy}</h3>
        </StudioSurface>
      )}
    </StudioPageFrame>
  );

  const renderActivePage = () => {
    if (props.selectedPlaylistId) {
      return (
        <StudioPageFrame>
          <StudioPlaylistDetailPage
            playlistId={props.selectedPlaylistId}
            onMovieSelect={props.onMovieSelect}
            onBack={() => props.setActiveTab(NavItem.DASHBOARD)}
            onPlay={studioPlay}
            onAddToPlaylist={props.openPlaylistModal}
          />
        </StudioPageFrame>
      );
    }

    if (props.viewAllCategory) {
      return (
        <StudioPageFrame>
          <StudioViewAllPage
            title={props.viewAllCategory.title}
            fetchUrl={props.viewAllCategory.fetchUrl}
            initialMovies={props.viewAllCategory.movies}
            forcedMediaType={props.viewAllCategory.forcedMediaType}
            onBack={props.closeViewAll}
            onMovieSelect={props.viewAllCategory.title === 'Continue Watching' ? props.onContinueWatchingSelect : props.onMovieSelect}
            onPlay={props.canStream ? (props.viewAllCategory.title === 'Continue Watching' ? props.onContinueWatchingSelect : playTitle) : undefined}
            onAddToPlaylist={props.openPlaylistModal}
          />
        </StudioPageFrame>
      );
    }

    switch (props.activeTab) {
      case NavItem.DASHBOARD:
        return renderHome();
      case NavItem.MOVIES:
        return (
          <StudioPageFrame title="Movies" subtitle="Browse">
            <StudioRow title="Now Playing" fetchUrl={requests.fetchNowPlaying} forcedMediaType="movie" onMovieSelect={props.onMovieSelect} onPlay={studioPlay} onAddToPlaylist={props.openPlaylistModal} />
            <StudioRow title="Top Rated Movies" fetchUrl={requests.fetchTopRated} forcedMediaType="movie" onMovieSelect={props.onMovieSelect} onPlay={studioPlay} onAddToPlaylist={props.openPlaylistModal} />
            <StudioRow title="Action" fetchUrl={requests.fetchActionMovies} forcedMediaType="movie" onMovieSelect={props.onMovieSelect} onPlay={studioPlay} onAddToPlaylist={props.openPlaylistModal} />
          </StudioPageFrame>
        );
      case NavItem.SERIES:
        return (
          <StudioPageFrame title="Series" subtitle="Browse">
            <StudioRow title="Popular Series" fetchUrl={requests.fetchTvPopular} forcedMediaType="tv" onMovieSelect={props.onMovieSelect} onPlay={studioPlay} onAddToPlaylist={props.openPlaylistModal} />
            <StudioRow title="Airing Today" fetchUrl={requests.fetchAiringToday} forcedMediaType="tv" onMovieSelect={props.onMovieSelect} onPlay={studioPlay} onAddToPlaylist={props.openPlaylistModal} />
            <StudioRow title="On The Air" fetchUrl={requests.fetchOnTheAir} forcedMediaType="tv" onMovieSelect={props.onMovieSelect} onPlay={studioPlay} onAddToPlaylist={props.openPlaylistModal} />
          </StudioPageFrame>
        );
      case NavItem.MY_LIST:
        return renderGrid('My List', props.myList, 'Your list is empty');
      case NavItem.SETTINGS:
        return <StudioSettingsPage />;
      case NavItem.PLAYLISTS:
        return <StudioPageFrame><StudioPlaylistsPage onPlaylistSelect={props.onPlaylistSelect} /></StudioPageFrame>;
      case NavItem.PROFILE:
        return <StudioPageFrame><StudioProfilePage userId={props.selectedProfileId} onPlaylistSelect={props.onPlaylistSelect} onMovieSelect={props.onMovieSelect} /></StudioPageFrame>;
      case NavItem.ADMIN:
        return <StudioPageFrame className="studio-classic-bridge"><AdminDashboard onNavigate={props.onNavigate} /></StudioPageFrame>;
      case NavItem.ACTIVITY:
        return <StudioPageFrame className="studio-classic-bridge"><ActivityPage onNavigate={props.onNavigate} initialTab={props.selectedActivityTab} /></StudioPageFrame>;
      case NavItem.MESSAGES:
        return <StudioPageFrame className="studio-messages-bridge max-w-none px-0 md:px-4"><MessagesPage onMovieSelect={props.onMovieSelect} initialConversationId={props.selectedMessageConversationId} onConversationChange={props.onConversationChange} /></StudioPageFrame>;
      case NavItem.ANNOUNCEMENTS:
        return <StudioPageFrame className="studio-classic-bridge"><AnnouncementsPage /></StudioPageFrame>;
      case NavItem.STATS:
        return <StudioPageFrame className="studio-classic-bridge">{props.canStream ? <StatsDashboard /> : null}</StudioPageFrame>;
      case NavItem.NEWS:
        return <StudioNewsPage onMovieSelect={props.onMovieSelect} />;
      case NavItem.SPORTS:
        return props.canStream ? <StudioSportsPage canStream={props.canStream} /> : renderHome();
      case NavItem.REQUESTS:
        return <StudioPageFrame className="studio-classic-bridge">{props.canStream ? <RequestsPage /> : null}</StudioPageFrame>;
      case NavItem.CURATOR:
        return <StudioPageFrame className="studio-classic-bridge"><CuratorLabPage onMovieSelect={props.onMovieSelect} onPlaylistSelect={props.onPlaylistSelect} /></StudioPageFrame>;
      case NavItem.ANIME:
        return <StudioPageFrame className="studio-classic-bridge"><AnimePage onMovieSelect={props.onMovieSelect} onViewAll={props.openViewAll} /></StudioPageFrame>;
      case NavItem.ASIAN_DRAMA:
        return <StudioPageFrame className="studio-classic-bridge"><AsianDramaPage onMovieSelect={props.onMovieSelect} onViewAll={props.openViewAll} /></StudioPageFrame>;
      case NavItem.FOR_YOU:
        return <StudioPageFrame className="studio-classic-bridge"><ForYouPage onMovieSelect={props.onMovieSelect} /></StudioPageFrame>;
      case NavItem.DOWNLOAD_QUEST:
        return <StudioDownloadsPage onSelectGroup={props.onOfflineGroupSelect} />;
      default:
        return renderHome();
    }
  };

  return (
    <StudioThemeProvider>
      <div className="min-h-screen overflow-x-hidden bg-black pb-20 selection:bg-white selection:text-black md:pb-0">
        <StudioHeader
          activeTab={props.activeTab}
          setActiveTab={props.setActiveTab}
          onSearchClick={props.openSearch}
          messageUnreadCount={props.messageUnreadCount}
          profile={props.profile}
          canStream={props.canStream}
        />
        <StudioBottomDock activeTab={props.activeTab} setActiveTab={props.setActiveTab} messageUnreadCount={props.messageUnreadCount} />

        <main className={drawerOpen ? 'studio-shell-main studio-shell-main--drawer-open' : 'studio-shell-main'}>
          {renderActivePage()}
        </main>

        <StudioMediaDrawer
          movie={props.selectedMovie}
          open={drawerOpen}
          onOpenChange={(open) => {
            if (!open) props.closeDetail();
          }}
          onPlay={studioPlay}
          onAddToPlaylist={props.openPlaylistModal}
          onMovieSelect={props.onMovieSelect}
        />

        {props.isSearchOpen && (
          <StudioSearchOverlay onClose={props.closeSearch} onMovieSelect={props.onSearchMovieSelect} onNavigate={props.onNavigate} />
        )}

        {props.playlistModalMovie && (
          <StudioAddToPlaylistSheet movie={props.playlistModalMovie} onClose={props.closePlaylistModal} />
        )}

        <div className="pointer-events-none fixed inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black to-transparent" />
      </div>
    </StudioThemeProvider>
  );
};
