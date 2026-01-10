import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { MovieDetail } from './components/MovieDetail';
import { SearchPage } from './components/SearchPage';
import { AnimePage } from './components/AnimePage';
import { Row } from './components/Row';
import { HeroMovie, Movie, NavItem } from './types';
import { TmdbService, requests } from './services/tmdb';
import { useMyList } from './hooks/useMyList';
import { useWatchHistory } from './components/useWatchHistory';

import { CategoryRow } from './components/CategoryRow';
import { AsianDramaPage } from './components/AsianDramaPage';
import { LatestPage } from './components/LatestPage';
import { Footer } from './components/Footer';
import { SettingsPage } from './components/SettingsPage';
import { LibraryBig } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState<NavItem>(NavItem.DASHBOARD);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);

  // Data State
  const [heroMovie, setHeroMovie] = useState<HeroMovie | null>(null);
  const { list: myList } = useMyList();
  const { getContinueWatching } = useWatchHistory();
  const [continueWatching, setContinueWatching] = useState<Movie[]>([]);

  // Load Hero and Initial Data
  useEffect(() => {
    const loadHero = async () => {
      const trending = await TmdbService.getTrending();
      if (trending.length > 0) {
        // Pick random trending movie
        const random = trending[Math.floor(Math.random() * trending.length)];
        // Fetch details for full hero data
        const details = await TmdbService.getDetails(random.id.toString(), random.mediaType || 'movie');

        setHeroMovie({
          ...random,
          ...details,
          tagline: details.tagline || "",
          genre: details.genre || random.genre || [],
          duration: details.duration || "",
          director: details.director || "",
          cast: details.cast || []
        } as HeroMovie);
      }
    };
    loadHero();
  }, []);

  // Hydrate Continue Watching from History
  useEffect(() => {
    const historyItems = getContinueWatching();
    // Map history items to minimal Movie objects for the Row
    const movies: Movie[] = historyItems.map(h => ({
      id: parseInt(h.tmdbId), // Ensure ID is number
      tmdbId: parseInt(h.tmdbId),
      title: h.title || "Untitled",
      year: h.year || new Date().getFullYear(),
      match: h.voteAverage ? Math.round(h.voteAverage * 10) : 0,
      imageUrl: h.mediaType === 'tv' && h.episodeImage
        ? h.episodeImage
        : (h.backdropUrl || h.posterUrl || ""), // Use landscape image for CW card
      mediaType: h.type,
      // Inject extra metadata for CW Card
      // We rely on type casting in the Card component or could extend type properly.
      // For now, we attach these properties which exist on the object but maybe not on the interface strict subset.
      // But standard JS object allows this.
      ...({
        progress: h.duration > 0 ? h.time / h.duration : 0,
        season: h.season,
        episode: h.episode
      } as any)
    }));
    setContinueWatching(movies);
  }, [getContinueWatching, activeTab]); // Reload when tab changes just in case

  const handleMovieSelect = (movie: Movie) => {
    setSelectedMovie(movie);
  };

  const handleCloseDetail = () => {
    setSelectedMovie(null);
  };

  const handleTabChange = (tab: NavItem) => {
    setActiveTab(tab);
    setIsSearchOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#0f1014] text-white selection:bg-white/30 selection:text-white font-sans overflow-x-hidden">
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onSearchClick={() => setIsSearchOpen(true)}
      />

      {/* Detail Page Overlay */}
      {selectedMovie && (
        <MovieDetail
          movie={selectedMovie}
          onClose={handleCloseDetail}
          similarMovies={[]}
        />
      )}

      {/* Main Content */}
      <div className={`transition-opacity duration-300 ${selectedMovie ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {isSearchOpen ? (
          <div className="animate-in fade-in duration-500 pl-24 pt-8">
            <SearchPage
              onMovieSelect={handleMovieSelect}
            />
          </div>
        ) : (
          <div>
            {/* Hero Section - Only on Dashboard */}
            {activeTab === NavItem.DASHBOARD && (
              <Hero movie={heroMovie || {
                id: 0,
                title: "Loading...",
                year: 2024,
                match: 0,
                imageUrl: "",
                backdropUrl: "",
                description: ""
              }} />
            )}

            <div className={`${activeTab === NavItem.DASHBOARD ? '-mt-32' : 'pt-20'} relative z-20 pl-4 md:pl-10 space-y-2`}>

              {/* DASHBOARD VIEW */}
              {activeTab === NavItem.DASHBOARD && (
                <>
                  {continueWatching.length > 0 && (
                    <Row
                      title="Continue Watching"
                      movies={continueWatching}
                      onMovieSelect={handleMovieSelect}
                      variant="continue-watching" // ENABLE NEW CARD
                    />
                  )}
                  <Row title="Trending Now" fetchUrl={requests.fetchTrending} onMovieSelect={handleMovieSelect} isLarge />
                  <Row title="Top Rated" fetchUrl={requests.fetchTopRated} onMovieSelect={handleMovieSelect} />
                  <Row title="Action Blockbusters" fetchUrl={requests.fetchActionMovies} onMovieSelect={handleMovieSelect} />
                  <Row title="Comedy Hits" fetchUrl={requests.fetchComedyMovies} onMovieSelect={handleMovieSelect} />
                  <Row title="Scary Movies" fetchUrl={requests.fetchHorrorMovies} onMovieSelect={handleMovieSelect} />
                  <Row title="Romance" fetchUrl={requests.fetchRomanceMovies} onMovieSelect={handleMovieSelect} />
                  <Row title="Documentaries" fetchUrl={requests.fetchDocumentaries} onMovieSelect={handleMovieSelect} />
                </>
              )}

              {/* MOVIES ONLY VIEW */}
              {activeTab === NavItem.MOVIES && (
                <>
                  <Row title="Trending Movies" fetchUrl={requests.fetchTrending} forcedMediaType='movie' onMovieSelect={handleMovieSelect} isLarge />
                  <Row title="Top Rated Movies" fetchUrl={requests.fetchTopRated} forcedMediaType='movie' onMovieSelect={handleMovieSelect} />
                  <Row title="Action" fetchUrl={requests.fetchActionMovies} forcedMediaType='movie' onMovieSelect={handleMovieSelect} />
                  <Row title="Comedy" fetchUrl={requests.fetchComedyMovies} forcedMediaType='movie' onMovieSelect={handleMovieSelect} />
                  <Row title="Horror" fetchUrl={requests.fetchHorrorMovies} forcedMediaType='movie' onMovieSelect={handleMovieSelect} />
                  <Row title="Romance" fetchUrl={requests.fetchRomanceMovies} forcedMediaType='movie' onMovieSelect={handleMovieSelect} />
                </>
              )}

              {/* TV SERIES ONLY VIEW */}
              {activeTab === NavItem.SERIES && (
                <>
                  <Row title="Trending TV" fetchUrl={requests.fetchNetflixOriginals} forcedMediaType='tv' onMovieSelect={handleMovieSelect} isLarge />
                  <Row title="Top Rated TV" fetchUrl={requests.fetchTopRated} forcedMediaType='tv' onMovieSelect={handleMovieSelect} />
                  <Row title="Action & Adventure" fetchUrl={requests.fetchActionMovies} forcedMediaType='tv' onMovieSelect={handleMovieSelect} />
                  <Row title="Comedy Series" fetchUrl={requests.fetchComedyMovies} forcedMediaType='tv' onMovieSelect={handleMovieSelect} />
                  <Row title="Documentary Series" fetchUrl={requests.fetchDocumentaries} forcedMediaType='tv' onMovieSelect={handleMovieSelect} />
                </>
              )}

              {/* ANIME VIEW */}
              {activeTab === NavItem.ANIME && (
                <AnimePage onMovieSelect={handleMovieSelect} />
              )}

              {/* ASIAN DRAMA VIEW */}
              {activeTab === NavItem.ASIAN_DRAMA && (
                <AsianDramaPage onMovieSelect={handleMovieSelect} />
              )}

              {/* LATEST VIEW */}
              {activeTab === NavItem.LATEST && (
                <LatestPage onMovieSelect={handleMovieSelect} />
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

              <Footer />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;