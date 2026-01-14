import React, { useState, useEffect } from 'react';
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

import { CategoryRow } from './components/CategoryRow';
import { AsianDramaPage } from './components/AsianDramaPage';
import { ForYouPage } from './components/ForYouPage';

// ... lines 16-391 (implicit context, will use multiple replace chunks if tool allows, or separate calls. Since this tool call is single replace, I will do import first or usage. Wait, user wants me to fix App.tsx errors.)

// Actually, I'll use multi_replace for App.tsx to handle import and usage at once.
// For this tool call, I will stick to fixing types.ts and Navbar.tsx as defined in arguments?
// No, the prompt allows parallel tool calls. I will use multi_replace for App.tsx in a separate tool call below.
import { Footer } from './components/Footer';
import { SettingsPage } from './components/SettingsPage';
import { LibraryBig } from 'lucide-react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { AuthPage } from './components/AuthPage';
import { ProfilePage } from './components/ProfilePage';
import { PlaylistPage } from './components/PlaylistPage';
import { AdminDashboard } from './components/AdminDashboard';
import { SocialService } from './lib/social';
import { PlaylistRow } from './components/PlaylistRow';
import { AddToPlaylistModal } from './components/AddToPlaylistModal';
import { AnnouncementsPage } from './components/AnnouncementsPage';
import { ViewAllPage } from './components/ViewAllPage';
import { PlayerPage } from './components/PlayerPage';
import { ActivityPage } from './components/ActivityPage';
import { WatchTogetherService } from './lib/watchTogether';
import { PlaylistsPage } from './components/PlaylistsPage';

import { supabase } from './lib/supabase';

function StreamApp() {
  const { user, loading } = useAuth();

  // Session Persistence Check
  useEffect(() => {
    const checkSession = async () => {
      const rememberMe = localStorage.getItem('AMX_REMEMBER_ME');
      const sessionActive = sessionStorage.getItem('AMX_SESSION_ACTIVE');

      // If 'Keep me logged in' was unchecked AND this is a fresh browser session
      if (rememberMe === 'false' && !sessionActive && user) {
        console.log('Session was not set to persist. Signing out.');
        await supabase.auth.signOut();
        return;
      }

      // Mark session as active for this tab/window
      sessionStorage.setItem('AMX_SESSION_ACTIVE', 'true');
    };
    checkSession();
  }, [user]);

  const [activeTab, setActiveTab] = useState<NavItem>(NavItem.DASHBOARD);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | undefined>(undefined);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | undefined>(undefined);
  const [playlistModalMovie, setPlaylistModalMovie] = useState<Movie | null>(null);
  const [viewAllCategory, setViewAllCategory] = useState<{ title: string; fetchUrl?: string; movies?: Movie[]; forcedMediaType?: 'movie' | 'tv' } | null>(null);

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
        setFeaturedMovies(fMovies.map((m: any) => ({
          ...m.metadata,
          // Ensure ID is number as Component expects
          id: parseInt(m.tmdb_id),
          mediaType: m.media_type
        })));
        setFeaturedPlaylists(fPlaylists);

        setFeaturedPlaylists(fPlaylists);
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
        const image = item.episodeImage || item.backdropUrl || item.posterUrl || "";

        // Ensure imageUrl is fully qualified if it's a relative path (though usually they are full URLs or TMDB paths)
        // Note: Our history saves them as full strings usually, but if relying on TMDB paths:
        const finalImage = image.startsWith('/') ? `https://image.tmdb.org/t/p/w500${image}` : image;

        return {
          ...item,
          id: parseInt(item.tmdbId),
          title: item.title || "Untitled",
          imageUrl: finalImage, // Critical fix for thumbnails
          year: item.year || new Date().getFullYear(),
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
  const [playerState, setPlayerState] = useState<{ movie: Movie; season?: number; episode?: number; autoJoinCode?: string } | null>(null);

  // Reset to Dashboard on logout so next login starts at Home
  useEffect(() => {
    if (!user) {
      setActiveTab(NavItem.DASHBOARD);
      setSelectedMovie(null);
      setPlayerState(null);
      setIsSearchOpen(false);
      setSelectedPlaylistId(undefined);
      setPlaylistModalMovie(null);
      setViewAllCategory(null);
    }
  }, [user]);

  // Auto-Join Logic
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');

    if (joinCode) {
      const handleAutoJoin = async () => {
        try {
          console.log('[Auto-Join] Attempting to join party with code:', joinCode);

          const party = await WatchTogetherService.getPartyDetails(joinCode);
          if (!party) {
            console.error('[Auto-Join] Party not found for code:', joinCode);
            alert('Watch party not found or has expired.');
            return;
          }

          console.log('[Auto-Join] Party found, fetching movie details...');

          // Fetch movie details to construct full object
          const details = await TmdbService.getDetails(party.tmdb_id, party.media_type);
          const movieReq = {
            id: parseInt(party.tmdb_id),
            tmdbId: parseInt(party.tmdb_id),
            mediaType: party.media_type,
            title: details.title,
            ...details
          };

          console.log('[Auto-Join] Starting player with movie:', details.title);

          setPlayerState({
            movie: movieReq as Movie,
            season: party.season,
            episode: party.episode,
            autoJoinCode: joinCode
          });

          // Clean URL
          window.history.replaceState({}, '', window.location.pathname);
        } catch (error) {
          console.error('[Auto-Join] Error:', error);
          alert('Failed to join watch party. Please try again.');
        }
      };
      handleAutoJoin();
    }
  }, []);

  // Playlist Deep Linking
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/\/playlist\/([a-zA-Z0-9-]+)/);
    if (match && match[1]) {
      setSelectedPlaylistId(match[1]);
    }
  }, []);


  const handleMovieSelect = (movie: Movie) => {
    setSelectedMovie(movie);
  };

  const handlePlay = (movie: Movie, season?: number, episode?: number) => {
    setPlayerState({ movie, season, episode });
  };

  const handlePlaylistSelect = (playlist: Playlist) => {
    setSelectedPlaylistId(playlist.id);
  };

  const handleCloseDetail = () => {
    setSelectedMovie(null);
  };

  const handleTabChange = (tab: NavItem, params?: any) => {
    if (tab !== NavItem.PROFILE) setSelectedProfileId(undefined);
    if (tab !== activeTab) setSelectedPlaylistId(undefined);
    setViewAllCategory(null);
    setSelectedMovie(null); // Close movie detail when navigating
    setPlayerState(null); // Close player on tab change
    setActiveTab(tab);
    setIsSearchOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigate = (page: string, params?: any) => {
    if (page === 'profile') {
      setSelectedProfileId(params?.id);
      setActiveTab(NavItem.PROFILE);
      setIsSearchOpen(false);
    } else if (page === 'playlist') {
      setSelectedPlaylistId(params?.id);
      setIsSearchOpen(false);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) return <div className="min-h-screen bg-[#0f1014] flex items-center justify-center text-white">Loading...</div>;
  if (!user) return <AuthPage />;

  // Render Player Page if active
  if (playerState) {
    return (
      <PlayerPage
        movie={playerState.movie}
        season={playerState.season}
        episode={playerState.episode}
        onBack={() => setPlayerState(null)}
        autoJoinCode={playerState.autoJoinCode}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1014] text-white selection:bg-white/30 selection:text-white font-sans overflow-x-hidden">
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onSearchClick={() => {
          setIsSearchOpen(true);
          setSelectedMovie(null);
        }}
      />

      {selectedMovie && (
        <MovieDetail
          movie={selectedMovie}
          onClose={handleCloseDetail}
          onPlay={handlePlay}
          similarMovies={[]}
          onMovieSelect={handleMovieSelect}
        />
      )}

      {/* Rest of the app... */}
      <div className={`transition-opacity duration-300 ${selectedMovie ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {isSearchOpen ? (
          <div className="fixed inset-0 z-50 bg-[#0f1014] animate-in fade-in duration-500 overflow-y-auto custom-scrollbar">
            <SearchPage
              onMovieSelect={handleMovieSelect}
              onNavigate={handleNavigate}
            />
          </div>
        ) : (
          <div>
            {activeTab === NavItem.DASHBOARD && !selectedPlaylistId && !viewAllCategory && (
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
                onAddToPlaylist={(m) => setPlaylistModalMovie(m as Movie)}
              />
            )}


            <div className={`${activeTab === NavItem.DASHBOARD && !viewAllCategory && !selectedPlaylistId ? '-mt-32' : 'pt-20'} relative z-20 pl-4 md:pl-10 space-y-2`}>

              {/* VIEW ALL PAGE */}
              {viewAllCategory && (
                <ViewAllPage
                  title={viewAllCategory.title}
                  fetchUrl={viewAllCategory.fetchUrl}
                  initialMovies={viewAllCategory.movies}
                  forcedMediaType={viewAllCategory.forcedMediaType}
                  onBack={() => setViewAllCategory(null)}
                  onMovieSelect={handleMovieSelect}
                />
              )}

              {/* DASHBOARD VIEW */}
              {activeTab === NavItem.DASHBOARD && !viewAllCategory && (
                <>
                  {continueWatching.length > 0 && (
                    <Row
                      title="Continue Watching"
                      movies={continueWatching}
                      onMovieSelect={handleMovieSelect}
                      variant="continue-watching"
                      onViewAll={() => setViewAllCategory({ title: "Continue Watching", movies: continueWatching })}
                    />
                  )}

                  {/* Featured Movies */}
                  {featuredMovies.length > 0 && (
                    <Row
                      title="Featured Movies"
                      movies={featuredMovies}
                      onMovieSelect={handleMovieSelect}
                      onViewAll={() => setViewAllCategory({ title: "Featured Movies", movies: featuredMovies })}
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







                  <Row title="Trending Now" fetchUrl={requests.fetchTrending} onMovieSelect={handleMovieSelect} isLarge onViewAll={() => setViewAllCategory({ title: "Trending Now", fetchUrl: requests.fetchTrending })} />
                  <Row title="Top Rated" fetchUrl={requests.fetchTopRated} onMovieSelect={handleMovieSelect} onViewAll={() => setViewAllCategory({ title: "Top Rated", fetchUrl: requests.fetchTopRated })} />
                  <Row title="Action Blockbusters" fetchUrl={requests.fetchActionMovies} onMovieSelect={handleMovieSelect} onViewAll={() => setViewAllCategory({ title: "Action Blockbusters", fetchUrl: requests.fetchActionMovies })} />
                  <Row title="Comedy Hits" fetchUrl={requests.fetchComedyMovies} onMovieSelect={handleMovieSelect} onViewAll={() => setViewAllCategory({ title: "Comedy Hits", fetchUrl: requests.fetchComedyMovies })} />
                  <Row title="Scary Movies" fetchUrl={requests.fetchHorrorMovies} onMovieSelect={handleMovieSelect} onViewAll={() => setViewAllCategory({ title: "Scary Movies", fetchUrl: requests.fetchHorrorMovies })} />
                  <Row title="Romance" fetchUrl={requests.fetchRomanceMovies} onMovieSelect={handleMovieSelect} onViewAll={() => setViewAllCategory({ title: "Romance", fetchUrl: requests.fetchRomanceMovies })} />
                  <Row title="Documentaries" fetchUrl={requests.fetchDocumentaries} onMovieSelect={handleMovieSelect} onViewAll={() => setViewAllCategory({ title: "Documentaries", fetchUrl: requests.fetchDocumentaries })} />
                </>
              )}

              {/* MOVIES ONLY VIEW */}
              {/* MOVIES ONLY VIEW */}
              {activeTab === NavItem.MOVIES && !viewAllCategory && (
                <>
                  <Row title="Trending Movies" fetchUrl={requests.fetchTrending} forcedMediaType='movie' onMovieSelect={handleMovieSelect} isLarge onViewAll={() => setViewAllCategory({ title: "Trending Movies", fetchUrl: requests.fetchTrending, forcedMediaType: 'movie' })} />
                  <Row title="Top Rated Movies" fetchUrl={requests.fetchTopRated} forcedMediaType='movie' onMovieSelect={handleMovieSelect} onViewAll={() => setViewAllCategory({ title: "Top Rated Movies", fetchUrl: requests.fetchTopRated, forcedMediaType: 'movie' })} />
                  <Row title="Action" fetchUrl={requests.fetchActionMovies} forcedMediaType='movie' onMovieSelect={handleMovieSelect} onViewAll={() => setViewAllCategory({ title: "Action", fetchUrl: requests.fetchActionMovies, forcedMediaType: 'movie' })} />
                  <Row title="Comedy" fetchUrl={requests.fetchComedyMovies} forcedMediaType='movie' onMovieSelect={handleMovieSelect} onViewAll={() => setViewAllCategory({ title: "Comedy", fetchUrl: requests.fetchComedyMovies, forcedMediaType: 'movie' })} />
                  <Row title="Horror" fetchUrl={requests.fetchHorrorMovies} forcedMediaType='movie' onMovieSelect={handleMovieSelect} onViewAll={() => setViewAllCategory({ title: "Horror", fetchUrl: requests.fetchHorrorMovies, forcedMediaType: 'movie' })} />
                  <Row title="Romance" fetchUrl={requests.fetchRomanceMovies} forcedMediaType='movie' onMovieSelect={handleMovieSelect} onViewAll={() => setViewAllCategory({ title: "Romance", fetchUrl: requests.fetchRomanceMovies, forcedMediaType: 'movie' })} />
                </>
              )}

              {/* TV SERIES ONLY VIEW */}
              {/* TV SERIES ONLY VIEW */}
              {activeTab === NavItem.SERIES && !viewAllCategory && (
                <>
                  <Row title="Trending TV" fetchUrl={requests.fetchNetflixOriginals} forcedMediaType='tv' onMovieSelect={handleMovieSelect} isLarge onViewAll={() => setViewAllCategory({ title: "Trending TV", fetchUrl: requests.fetchNetflixOriginals, forcedMediaType: 'tv' })} />
                  <Row title="Top Rated TV" fetchUrl={requests.fetchTopRated} forcedMediaType='tv' onMovieSelect={handleMovieSelect} onViewAll={() => setViewAllCategory({ title: "Top Rated TV", fetchUrl: requests.fetchTopRated, forcedMediaType: 'tv' })} />
                  <Row title="Action & Adventure" fetchUrl={requests.fetchActionMovies} forcedMediaType='tv' onMovieSelect={handleMovieSelect} onViewAll={() => setViewAllCategory({ title: "Action & Adventure", fetchUrl: requests.fetchActionMovies, forcedMediaType: 'tv' })} />
                  <Row title="Comedy Series" fetchUrl={requests.fetchComedyMovies} forcedMediaType='tv' onMovieSelect={handleMovieSelect} onViewAll={() => setViewAllCategory({ title: "Comedy Series", fetchUrl: requests.fetchComedyMovies, forcedMediaType: 'tv' })} />
                  <Row title="Documentary Series" fetchUrl={requests.fetchDocumentaries} forcedMediaType='tv' onMovieSelect={handleMovieSelect} onViewAll={() => setViewAllCategory({ title: "Documentary Series", fetchUrl: requests.fetchDocumentaries, forcedMediaType: 'tv' })} />
                </>
              )}

              {/* ANIME VIEW */}
              {activeTab === NavItem.ANIME && !viewAllCategory && (
                <AnimePage
                  onMovieSelect={handleMovieSelect}
                  onViewAll={setViewAllCategory}
                />
              )}

              {/* ASIAN DRAMA VIEW */}
              {activeTab === NavItem.ASIAN_DRAMA && !viewAllCategory && (
                <AsianDramaPage
                  onMovieSelect={handleMovieSelect}
                  onViewAll={setViewAllCategory}
                />
              )}

              {/* FOR YOU VIEW */}
              {activeTab === NavItem.FOR_YOU && (
                <ForYouPage onMovieSelect={handleMovieSelect} />
              )}


              {/* MY LIST VIEW */}
              {activeTab === NavItem.MY_LIST && (
                <div className="px-12">
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
              )}

              {/* SETTINGS VIEW */}
              {activeTab === NavItem.SETTINGS && (
                <SettingsPage />
              )}

              {/* ADMIN DASHBOARD VIEW */}
              {activeTab === NavItem.ADMIN && (
                <AdminDashboard onNavigate={handleNavigate} />
              )}

              {/* PROFILE VIEW */}
              {activeTab === NavItem.PROFILE && !selectedPlaylistId && (
                <ProfilePage
                  userId={selectedProfileId}
                  onNavigate={handleNavigate}
                  onMovieSelect={handleMovieSelect}
                />
              )}

              {/* ANNOUNCEMENTS VIEW */}
              {activeTab === NavItem.ANNOUNCEMENTS && (
                <AnnouncementsPage />
              )}

              {/* ACTIVITY VIEW */}
              {activeTab === NavItem.ACTIVITY && (
                <ActivityPage onNavigate={handleNavigate} />
              )}

              {/* PLAYLISTS VIEW */}
              {activeTab === NavItem.PLAYLISTS && !selectedPlaylistId && (
                <PlaylistsPage
                  onBack={() => setActiveTab(NavItem.DASHBOARD)}
                  onPlaylistSelect={handlePlaylistSelect}
                />
              )}

              {/* Add To Playlist Modal (Global generic overlay) */}
              {playlistModalMovie && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center">
                  <AddToPlaylistModal
                    movie={playlistModalMovie}
                    onClose={() => setPlaylistModalMovie(null)}
                  />
                </div>
              )}


              {/* PLAYLIST VIEW (Overrides others if active) */}
              {selectedPlaylistId && (
                <div className="absolute inset-0 bg-[#0f1014] z-30 min-h-screen">
                  <PlaylistPage
                    playlistId={selectedPlaylistId}
                    onMovieSelect={handleMovieSelect}
                    onBack={() => setSelectedPlaylistId(undefined)}
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
      <StreamApp />
    </AuthProvider>
  );
}

export default App;