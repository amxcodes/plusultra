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
import { StudioPageFrame } from './system/StudioPageFrame';
import { StudioSurface } from './system/StudioSurface';
import { StudioButton } from './system/StudioButton';
import { ViewAllPage } from '../ViewAllPage';
import { PlaylistPage } from '../PlaylistPage';
import { PlaylistsPage } from '../PlaylistsPage';
import { ProfilePage } from '../ProfilePage';
import { AdminDashboard } from '../AdminDashboard';
import { ActivityPage } from '../ActivityPage';
import { MessagesPage } from '../MessagesPage';
import { AnnouncementsPage } from '../AnnouncementsPage';
import { StatsDashboard } from '../StatsDashboard';
import { NewsFeed } from '../NewsFeed';
import { RequestsPage } from '../RequestsPage';
import { CuratorLabPage } from '../CuratorLabPage';
import { AnimePage } from '../AnimePage';
import { AsianDramaPage } from '../AsianDramaPage';
import { ForYouPage } from '../ForYouPage';
import { DownloadQuestPage, type OfflineDownloadGroup } from '../DownloadQuestPage';
import { AddToPlaylistModal } from '../AddToPlaylistModal';
import { PlaylistRow } from '../PlaylistRow';
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
}

const useStudioSmoothScroll = (preferences: UiPreferences, disabled: boolean) => {
  useEffect(() => {
    if (disabled || !preferences.smoothScroll || preferences.reduceMotion) return;

    let lenis: any;
    let frame = 0;
    let cancelled = false;

    import('lenis').then(({ default: Lenis }) => {
      if (cancelled) return;
      lenis = new Lenis({
        duration: 0.92,
        smoothWheel: true,
        wheelMultiplier: 0.85,
      });

      const raf = (time: number) => {
        lenis?.raf(time);
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

  const playTitle = (movie: Movie) => {
    if (movie.mediaType === 'tv') {
      props.onPlay(movie, movie.season || 1, movie.episode || 1);
      return;
    }

    props.onPlay(movie);
  };

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
        onPlay={playTitle}
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
            onViewAll={() => props.openViewAll({ title: 'Continue Watching', movies: props.continueWatching })}
          />
        )}
        {props.featuredMovies.length > 0 && (
          <StudioRow
            title="Featured Movies"
            movies={props.featuredMovies}
            onMovieSelect={props.onMovieSelect}
            onPlay={playTitle}
            onViewAll={() => props.openViewAll({ title: 'Featured Movies', movies: props.featuredMovies })}
          />
        )}
        {props.featuredPlaylists.length > 0 && (
          <div className="mx-auto max-w-[1500px] px-4 py-4 md:px-8">
            <PlaylistRow title="Featured Playlists" playlists={props.featuredPlaylists} onPlaylistSelect={props.onPlaylistSelect} />
          </div>
        )}
        {props.communityTrending.length > 0 && (
          <StudioRow
            title="Trending With Users"
            movies={props.communityTrending}
            onMovieSelect={props.onMovieSelect}
            onPlay={playTitle}
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
            onPlay={playTitle}
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
            <StudioMediaCard key={`${movie.mediaType || 'movie'}-${movie.id}`} movie={movie} onSelect={props.onMovieSelect} onPlay={playTitle} />
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
          <PlaylistPage playlistId={props.selectedPlaylistId} onMovieSelect={props.onMovieSelect} onBack={() => props.setActiveTab(NavItem.DASHBOARD)} />
        </StudioPageFrame>
      );
    }

    if (props.viewAllCategory) {
      return (
        <StudioPageFrame>
          <ViewAllPage
            title={props.viewAllCategory.title}
            fetchUrl={props.viewAllCategory.fetchUrl}
            initialMovies={props.viewAllCategory.movies}
            forcedMediaType={props.viewAllCategory.forcedMediaType}
            onBack={props.closeViewAll}
            onMovieSelect={props.viewAllCategory.title === 'Continue Watching' ? props.onContinueWatchingSelect : props.onMovieSelect}
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
            <StudioRow title="Now Playing" fetchUrl={requests.fetchNowPlaying} forcedMediaType="movie" onMovieSelect={props.onMovieSelect} onPlay={playTitle} />
            <StudioRow title="Top Rated Movies" fetchUrl={requests.fetchTopRated} forcedMediaType="movie" onMovieSelect={props.onMovieSelect} onPlay={playTitle} />
            <StudioRow title="Action" fetchUrl={requests.fetchActionMovies} forcedMediaType="movie" onMovieSelect={props.onMovieSelect} onPlay={playTitle} />
          </StudioPageFrame>
        );
      case NavItem.SERIES:
        return (
          <StudioPageFrame title="Series" subtitle="Browse">
            <StudioRow title="Popular Series" fetchUrl={requests.fetchTvPopular} forcedMediaType="tv" onMovieSelect={props.onMovieSelect} onPlay={playTitle} />
            <StudioRow title="Airing Today" fetchUrl={requests.fetchAiringToday} forcedMediaType="tv" onMovieSelect={props.onMovieSelect} onPlay={playTitle} />
            <StudioRow title="On The Air" fetchUrl={requests.fetchOnTheAir} forcedMediaType="tv" onMovieSelect={props.onMovieSelect} onPlay={playTitle} />
          </StudioPageFrame>
        );
      case NavItem.MY_LIST:
        return renderGrid('My List', props.myList, 'Your list is empty');
      case NavItem.SETTINGS:
        return <StudioSettingsPage />;
      case NavItem.PLAYLISTS:
        return <StudioPageFrame title="Playlists"><PlaylistsPage onBack={() => props.setActiveTab(NavItem.DASHBOARD)} onPlaylistSelect={props.onPlaylistSelect} /></StudioPageFrame>;
      case NavItem.PROFILE:
        return <StudioPageFrame><ProfilePage userId={props.selectedProfileId} onNavigate={props.onNavigate} onMovieSelect={props.onMovieSelect} /></StudioPageFrame>;
      case NavItem.ADMIN:
        return <StudioPageFrame><AdminDashboard onNavigate={props.onNavigate} /></StudioPageFrame>;
      case NavItem.ACTIVITY:
        return <StudioPageFrame><ActivityPage onNavigate={props.onNavigate} initialTab={props.selectedActivityTab} /></StudioPageFrame>;
      case NavItem.MESSAGES:
        return <StudioPageFrame className="max-w-none px-0 md:px-4"><MessagesPage onMovieSelect={props.onMovieSelect} initialConversationId={props.selectedMessageConversationId} onConversationChange={props.onConversationChange} /></StudioPageFrame>;
      case NavItem.ANNOUNCEMENTS:
        return <StudioPageFrame><AnnouncementsPage /></StudioPageFrame>;
      case NavItem.STATS:
        return <StudioPageFrame>{props.canStream ? <StatsDashboard /> : null}</StudioPageFrame>;
      case NavItem.NEWS:
        return <StudioPageFrame><NewsFeed onMovieSelect={props.onMovieSelect} /></StudioPageFrame>;
      case NavItem.REQUESTS:
        return <StudioPageFrame>{props.canStream ? <RequestsPage /> : null}</StudioPageFrame>;
      case NavItem.CURATOR:
        return <StudioPageFrame><CuratorLabPage onMovieSelect={props.onMovieSelect} onPlaylistSelect={props.onPlaylistSelect} /></StudioPageFrame>;
      case NavItem.ANIME:
        return <StudioPageFrame><AnimePage onMovieSelect={props.onMovieSelect} onViewAll={props.openViewAll} /></StudioPageFrame>;
      case NavItem.ASIAN_DRAMA:
        return <StudioPageFrame><AsianDramaPage onMovieSelect={props.onMovieSelect} onViewAll={props.openViewAll} /></StudioPageFrame>;
      case NavItem.FOR_YOU:
        return <StudioPageFrame><ForYouPage onMovieSelect={props.onMovieSelect} /></StudioPageFrame>;
      case NavItem.DOWNLOAD_QUEST:
        return <StudioPageFrame><DownloadQuestPage onSelectGroup={props.onOfflineGroupSelect} /></StudioPageFrame>;
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

        <main>{renderActivePage()}</main>

        <StudioMediaDrawer
          movie={props.selectedMovie}
          open={drawerOpen}
          onOpenChange={(open) => {
            if (!open) props.closeDetail();
          }}
          onPlay={playTitle}
          onAddToPlaylist={props.openPlaylistModal}
        />

        {props.isSearchOpen && (
          <StudioSearchOverlay onClose={props.closeSearch} onMovieSelect={props.onMovieSelect} onNavigate={props.onNavigate} />
        )}

        {props.playlistModalMovie && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <AddToPlaylistModal movie={props.playlistModalMovie} onClose={props.closePlaylistModal} />
          </div>
        )}

        <div className="pointer-events-none fixed inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black to-transparent" />
      </div>
    </StudioThemeProvider>
  );
};
