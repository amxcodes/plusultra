
import React, { useState, useEffect } from 'react';
import { Search, X, Users, Disc, Film, Sparkles, TrendingUp } from 'lucide-react';
import { Movie, Profile, Playlist } from '../types';
import { MovieCard } from './MovieCard';
import { TmdbService } from '../services/tmdb';
import { SocialService } from '../lib/social';
import { useDebounce } from '../hooks/useDebounce';

enum SearchTab {
  MOVIES = 'Movies & TV',
  USERS = 'People',
  PLAYLISTS = 'Playlists'
}

interface SearchPageProps {
  onMovieSelect: (movie: Movie) => void;
  onNavigate?: (page: string, params?: any) => void;
}

export const SearchPage: React.FC<SearchPageProps> = ({ onMovieSelect, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>(SearchTab.MOVIES);

  // Debounce query to prevent rapid API calls
  const debouncedQuery = useDebounce(query, 500);

  const [results, setResults] = useState<Movie[]>([]);
  const [userResults, setUserResults] = useState<Profile[]>([]);
  const [playlistResults, setPlaylistResults] = useState<Playlist[]>([]);

  const [isFocused, setIsFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Effect handles search logic
  useEffect(() => {
    const performSearch = async () => {
      if (debouncedQuery.trim() === '') {
        setResults([]);
        setUserResults([]);
        setPlaylistResults([]);
        return;
      }

      setIsSearching(true);
      try {
        if (activeTab === SearchTab.MOVIES) {
          const searchResults = await TmdbService.search(debouncedQuery);
          setResults(searchResults);
        } else if (activeTab === SearchTab.USERS) {
          const users = await SocialService.searchUsers(debouncedQuery);
          setUserResults(users);
        } else if (activeTab === SearchTab.PLAYLISTS) {
          const lists = await SocialService.searchPlaylists(debouncedQuery);
          setPlaylistResults(lists);
        }
      } catch (e) {
        console.error("Search failed", e);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [debouncedQuery, activeTab]);

  const hasQuery = query.length > 0;

  // Handlers
  const handleUserClick = (userId: string) => {
    if (onNavigate) onNavigate('profile', { id: userId });
  };

  const handlePlaylistClick = (playlistId: string) => {
    if (onNavigate) onNavigate('playlist', { id: playlistId });
  };

  // Quick suggestions for empty state
  const quickTags = ["Anime", "Action", "Romance", "4K HDR", "Studio Ghibli"];

  return (
    <div className="min-h-screen w-full bg-[#0f1014] relative overflow-hidden pl-24 pr-8 selection:bg-white/20">

      <div className={`
        relative w-full max-w-7xl mx-auto flex flex-col transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1)
        ${hasQuery ? 'pt-8 items-start' : 'h-[80vh] items-center justify-center'}
      `}>

        {/* Search Input Container */}
        <div className={`w-full transition-all duration-700 ${hasQuery ? 'max-w-4xl' : 'max-w-2xl scale-110'}`}>

          {!hasQuery && (
            <div className="text-center mb-8 space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <h1 className="text-4xl font-black tracking-tighter text-white">Find your next obsession</h1>
              <p className="text-zinc-500">Search for movies, shows, people, or community lists.</p>
            </div>
          )}

          <div className={`
            relative flex items-center bg-[#151518] ring-1 transition-all duration-300 rounded-2xl overflow-hidden shadow-2xl
            ${isFocused ? 'ring-white/30 bg-[#1a1a1e] scale-[1.02]' : 'ring-white/10 hover:ring-white/20'}
          `}>
            <div className="pl-6 text-zinc-500">
              <Search size={24} className={`transition-colors duration-300 ${isFocused ? 'text-white' : ''}`} />
            </div>
            <input
              autoFocus
              type="text"
              placeholder={`Search ${activeTab.toLowerCase()}...`}
              className="w-full bg-transparent text-white px-5 py-5 outline-none text-xl placeholder:text-zinc-600 font-medium tracking-tight"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
            />
            {hasQuery && (
              <button
                onClick={() => setQuery('')}
                className="pr-6 text-zinc-500 hover:text-white transition-colors p-2"
              >
                <X size={20} />
              </button>
            )}
          </div>

          {/* Quick Tags (Only visible when empty) */}
          {!hasQuery && (
            <div className="flex justify-center gap-3 mt-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
              {quickTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setQuery(tag)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-full text-sm font-medium transition-all border border-white/5 hover:border-white/20"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Tabs (Visible when has query) */}
          {hasQuery && (
            <div className="flex gap-2 mt-6 animate-in fade-in slide-in-from-left-4 duration-500">
              {Object.values(SearchTab).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border
                            ${activeTab === tab
                      ? 'bg-white text-black border-white'
                      : 'bg-transparent text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-white/5'}
                        `}
                >
                  {tab === SearchTab.MOVIES && <Film size={16} />}
                  {tab === SearchTab.USERS && <Users size={16} />}
                  {tab === SearchTab.PLAYLISTS && <Disc size={16} />}
                  {tab}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results Grid */}
        <div className={`w-full transition-all duration-700 ease-out ${hasQuery ? 'opacity-100 translate-y-0 mt-8' : 'opacity-0 translate-y-20 mt-0 h-0 pointer-events-none'}`}>

          {isSearching ? (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-zinc-800 border-t-white"></div>
              <p className="text-zinc-500 text-sm animate-pulse">Searching the cosmos...</p>
            </div>
          ) : (
            <>
              {/* MOVIE RESULTS */}
              {activeTab === SearchTab.MOVIES && results.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 pb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
                  {results.filter(m => m.imageUrl && !m.imageUrl.includes('placeholder')).map((movie, idx) => (
                    <div
                      key={movie.id}
                      onClick={() => onMovieSelect(movie)}
                      className="cursor-pointer"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <MovieCard movie={movie} />
                    </div>
                  ))}
                </div>
              )}

              {/* USER RESULTS */}
              {activeTab === SearchTab.USERS && userResults.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
                  {userResults.map(user => (
                    <div
                      key={user.id}
                      onClick={() => handleUserClick(user.id)}
                      className="bg-black/40 border border-white/5 p-4 rounded-2xl flex items-center gap-4 hover:bg-white/5 hover:border-white/10 transition-all cursor-pointer group duration-200"
                    >
                      <img
                        src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}&background=random`}
                        className="w-14 h-14 rounded-full border-2 border-transparent group-hover:border-white/20 transition-all"
                      />
                      <div>
                        <h3 className="font-bold text-white transition-colors">{user.username}</h3>
                        <p className="text-xs text-zinc-500 capitalize flex items-center gap-1">
                          {user.role} {user.role === 'admin' && <Sparkles size={10} className="text-amber-400" />}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* PLAYLIST RESULTS */}
              {activeTab === SearchTab.PLAYLISTS && playlistResults.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
                  {playlistResults.map(list => (
                    <div
                      key={list.id}
                      onClick={() => handlePlaylistClick(list.id)}
                      className="bg-[#151518] border border-white/5 rounded-3xl overflow-hidden hover:border-white/20 transition-all cursor-pointer group hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50 duration-500"
                    >
                      <div className="aspect-video bg-zinc-900 group-hover:bg-zinc-800 transition-colors flex items-center justify-center relative overflow-hidden">
                        {/* Placeholder Art */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-20 text-[100px] font-black text-white mix-blend-overlay select-none">
                          {list.name[0]}
                        </div>
                        <Disc size={48} className="text-zinc-700 group-hover:text-white transition-colors relative z-10" />
                      </div>
                      <div className="p-6">
                        <h3 className="font-bold text-lg text-white truncate">{list.name}</h3>
                        <div className="flex items-center gap-2 mt-3">
                          <img
                            src={list.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${list.profiles?.username}&background=random`}
                            className="w-5 h-5 rounded-full"
                          />
                          <span className="text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors">By {list.profiles?.username || 'Unknown'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Not Found State */}
              {!isSearching && debouncedQuery && (
                (activeTab === SearchTab.MOVIES && results.length === 0) ||
                (activeTab === SearchTab.USERS && userResults.length === 0) ||
                (activeTab === SearchTab.PLAYLISTS && playlistResults.length === 0)
              ) && (
                  <div className="flex flex-col items-center justify-center py-24 text-center animate-in fade-in zoom-in-95 duration-500">
                    <div className="bg-zinc-900 p-6 rounded-full mb-6 relative">
                      <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full"></div>
                      <Search size={48} className="text-zinc-600 relative z-10" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">No results found</h3>
                    <p className="text-zinc-500 max-w-sm">
                      We couldn't find anything matching "{query}". Try different keywords or check your spelling.
                    </p>
                  </div>
                )}
            </>
          )}

        </div>

      </div>
    </div>
  );
};