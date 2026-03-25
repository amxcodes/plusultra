
import React, { useState, useEffect } from 'react';
import { Search, X, Users, Disc, Film, Sparkles, TrendingUp, Clock, Trash, ChevronDown, ArrowUpDown } from 'lucide-react';
import { Movie, Profile, Playlist } from '../types';
import { MovieCard } from './MovieCard';
import { TmdbService } from '../services/tmdb';
import { SocialService } from '../lib/social';
import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../lib/AuthContext';

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
  const [filterType, setFilterType] = useState<'multi' | 'movie' | 'tv'>('multi');
  const [filterYear, setFilterYear] = useState('');
  const [filterGenres, setFilterGenres] = useState<string[]>([]); // Multi-select array
  const [isGenreOpen, setIsGenreOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'relevance' | 'rating' | 'year' | 'popularity'>('relevance');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [minRating, setMinRating] = useState<number>(0); // 0 = All ratings
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [dynamicTerms, setDynamicTerms] = useState<string[]>([]); // Trending movies for fuzzy search
  const [suggestion, setSuggestion] = useState<string>(''); // "Did you mean" suggestion

  // Debounce query to prevent rapid API calls
  const debouncedQuery = useDebounce(query, 500);

  const [results, setResults] = useState<Movie[]>([]);
  const [userResults, setUserResults] = useState<Profile[]>([]);
  const [playlistResults, setPlaylistResults] = useState<Playlist[]>([]);

  const [isFocused, setIsFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecents, setShowRecents] = useState(false);
  const { user } = useAuth();

  // Load recent searches on mount
  useEffect(() => {
    const loadRecents = async () => {
      // Get user-specific localStorage key
      const storageKey = user ? `recentSearches_${user.id}` : 'recentSearches_guest';
      const localRecents = JSON.parse(localStorage.getItem(storageKey) || '[]') as string[];

      if (user) {
        // If logged in, merge with DB searches (DB takes priority)
        try {
          const dbRecents = await SocialService.getRecentSearches(user.id);
          // Merge: DB first, then local (dedupe)
          const merged = [...dbRecents];
          localRecents.forEach(search => {
            if (!merged.find(s => s.toLowerCase() === search.toLowerCase())) {
              merged.push(search);
            }
          });
          setRecentSearches(merged.slice(0, 10));
        } catch (e) {
          console.error('Failed to load DB searches', e);
          setRecentSearches(localRecents.slice(0, 10));
        }
      } else {
        setRecentSearches(localRecents.slice(0, 10));
      }
    };
    loadRecents();
  }, [user]);

  // Fetch trending movies for dynamic fuzzy search dictionary (cached for 24h)
  useEffect(() => {
    const fetchTrendingTerms = async () => {
      const CACHE_KEY = 'fuzzySearchCache';
      const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

      try {
        // Check cache first
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { terms, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DURATION) {
            setDynamicTerms(terms);
            return;
          }
        }

        // Fetch fresh trending movies from TMDB
        const trending = await TmdbService.getTrending();
        const titles = trending
          .map(m => m.title.toLowerCase())
          .filter(t => t.length > 2); // Filter out very short titles

        // Cache for 24h
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          terms: titles,
          timestamp: Date.now()
        }));

        setDynamicTerms(titles);
      } catch (e) {
        console.error('Failed to fetch trending terms:', e);
      }
    };

    fetchTrendingTerms();
  }, []);

  // Save search helper
  const saveSearch = async (query: string) => {
    if (!query.trim() || query.length < 2) return;

    // Get user-specific localStorage key
    const storageKey = user ? `recentSearches_${user.id}` : 'recentSearches_guest';
    const localRecents = JSON.parse(localStorage.getItem(storageKey) || '[]') as string[];
    const updated = [query, ...localRecents.filter(s => s.toLowerCase() !== query.toLowerCase())].slice(0, 10);
    localStorage.setItem(storageKey, JSON.stringify(updated));

    // Save to DB if logged in (top 3)
    if (user) {
      try {
        await SocialService.saveRecentSearch(user.id, query);
      } catch (e) {
        console.error('Failed to save search to DB', e);
      }
    }

    // Update state
    setRecentSearches(updated);
  };

  // Effect handles search logic
  useEffect(() => {
    const performSearch = async () => {
      if (debouncedQuery.trim() === '') {
        setResults([]);
        setUserResults([]);
        setPlaylistResults([]);
        return;
      }

      // Reset page on new search
      setPage(1);
      setHasMore(true);
      setIsSearching(true);

      try {
        if (activeTab === SearchTab.MOVIES) {
          // Clean query: remove years since they'll be applied as filters
          const cleanedQuery = cleanSearchQuery(debouncedQuery);

          const searchResults = await TmdbService.search(cleanedQuery, {
            type: filterType,
            year: filterYear.length === 4 ? filterYear : undefined,
            page: 1
          });
          setResults(searchResults);
          setHasMore(searchResults.length === 20); // TMDB returns 20 per page
          // Save successful search
          if (searchResults.length > 0) {
            saveSearch(debouncedQuery);
          }
        } else if (activeTab === SearchTab.USERS) {
          const users = await SocialService.searchUsers(debouncedQuery);
          setUserResults(users);
        } else if (activeTab === SearchTab.PLAYLISTS) {
          const lists = await SocialService.searchPlaylists(debouncedQuery);
          setPlaylistResults(lists);
        }
      } catch (e) {
        console.error("❌ Search failed", e);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [debouncedQuery, activeTab, filterType, filterYear, user]);

  const hasQuery = query.length > 0;

  // Smart Intent Detection
  const parseIntent = (query: string) => {
    const lower = query.toLowerCase();

    // Smart year detection - only extract if it's clearly a FILTER, not a movie title
    // Extract year if it appears with filter keywords like "best", "top", "movies", "action", etc.
    const hasFilterContext = /\b(best|top|good|new|latest|movies?|shows?|series|action|comedy|drama|horror|thriller)\b/.test(lower);
    const yearMatch = lower.match(/\b(19\d{2}|20\d{2})\b/);

    // Only extract year if:
    // 1. There are filter keywords nearby (e.g., "best action movies 2024")
    // 2. The year is at the END of the query (e.g., "romantic comedies 2023")
    // 3. The query is longer than just the year (prevents extracting from "2012" search)
    if (yearMatch && hasFilterContext && lower.trim().length > 4) {
      setFilterYear(yearMatch[1]);
    }

    // Genre detection
    const genreMap: { [key: string]: string } = {
      'action': '28', 'adventure': '12', 'animation': '16', 'anime': '16',
      'comedy': '35', 'crime': '80', 'documentary': '99', 'drama': '18',
      'family': '10751', 'fantasy': '14', 'history': '36', 'horror': '27',
      'music': '10402', 'mystery': '9648', 'romance': '10749', 'sci-fi': '878',
      'scifi': '878', 'thriller': '53', 'war': '10752', 'western': '37'
    };

    for (const [name, id] of Object.entries(genreMap)) {
      if (lower.includes(name)) {
        setFilterGenres(prev => prev.includes(id) ? prev : [...prev, id]);
      }
    }
  };

  // Clean query by removing years ONLY if they were extracted as filters
  const cleanSearchQuery = (query: string): string => {
    const lower = query.toLowerCase();
    const hasFilterContext = /\b(best|top|good|new|latest|movies?|shows?|series|action|comedy|drama|horror|thriller)\b/.test(lower);

    // Only remove year from query if it was detected as a filter
    if (hasFilterContext && lower.trim().length > 4) {
      return query.replace(/\b(19\d{2}|20\d{2})\b/g, '').trim().replace(/\s+/g, ' ');
    }

    // Otherwise keep the query as-is (year might be part of movie title)
    return query.trim();
  };

  // Apply intent detection on query change
  useEffect(() => {
    if (debouncedQuery.length > 3) {
      parseIntent(debouncedQuery);
    }
  }, [debouncedQuery]);

  // Levenshtein distance for fuzzy matching
  const levenshtein = (a: string, b: string): number => {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  };

  // Common movie/search terms for fuzzy matching
  const commonTerms = [
    "avatar", "avengers", "inception", "interstellar", "titanic", "gladiator",
    "matrix", "batman", "joker", "spiderman", "superman", "ironman",
    "action", "comedy", "horror", "thriller", "romance", "drama", "anime"
  ];

  // Check for typos and suggest corrections
  useEffect(() => {
    // Trigger on any search with results.length === 0 (not just when !isSearching)
    if (debouncedQuery.length > 2 && results.length === 0 && !isSearching) {
      const lower = debouncedQuery.toLowerCase();
      let bestMatch = '';
      let minDistance = Infinity;

      for (const term of commonTerms) {
        const distance = levenshtein(lower, term);

        // More lenient: accept distance up to 3, and any distance under minDistance
        if (distance > 0 && distance <= 3 && distance < minDistance) {
          minDistance = distance;
          bestMatch = term;
        }
      }

      setSuggestion(bestMatch || '');
    } else {
      setSuggestion('');
    }
  }, [debouncedQuery, results, isSearching, dynamicTerms]);

  // Handlers
  const handleUserClick = (userId: string) => {
    if (onNavigate) onNavigate('profile', { id: userId });
  };

  const handlePlaylistClick = (playlistId: string) => {
    if (onNavigate) onNavigate('playlist', { id: playlistId });
  };

  const loadMore = async () => {
    if (isLoadingMore || !hasMore || activeTab !== SearchTab.MOVIES) return;

    setIsLoadingMore(true);
    const nextPage = page + 1;

    try {
      const moreResults = await TmdbService.search(debouncedQuery, {
        type: filterType,
        year: filterYear.length === 4 ? filterYear : undefined,
        page: nextPage
      });

      if (moreResults.length === 0) {
        setHasMore(false);
      } else {
        setResults(prev => [...prev, ...moreResults]);
        setPage(nextPage);
        setHasMore(moreResults.length === 20);
      }
    } catch (e) {
      console.error("Failed to load more", e);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Quick suggestions for empty state
  const quickTags = ["Anime", "Action", "Romance", "4K HDR", "Studio Ghibli"];

  // Sort and filter results based on selected options
  const sortedResults = React.useMemo(() => {
    if (activeTab !== SearchTab.MOVIES || results.length === 0) return results;

    // First filter by rating
    let filtered = minRating > 0
      ? results.filter(m => (m.match || 0) >= minRating * 10) // match is out of 100, rating is 0-10
      : results;

    // Then sort
    switch (sortBy) {
      case 'rating':
        return filtered.sort((a, b) => (b.match || 0) - (a.match || 0));
      case 'year':
        return filtered.sort((a, b) => b.year - a.year);
      case 'popularity':
        return filtered.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      case 'relevance':
      default:
        return filtered; // Keep TMDB's default relevance order
    }
  }, [results, sortBy, minRating, activeTab]);

  return (
    <div className="min-h-screen w-full bg-[#0f1014] relative overflow-hidden px-4 md:pl-24 md:pr-8 selection:bg-white/20">

      <div className={`
        relative w-full max-w-7xl mx-auto flex flex-col transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1)
        ${hasQuery ? 'pt-8 items-start' : 'h-[80vh] items-center justify-center'}
      `}>

        {/* Search Input Container */}
        <div className={`w-full transition-all duration-700 ${hasQuery ? 'max-w-7xl' : 'max-w-2xl scale-110'}`}>

          {!hasQuery && (
            <div className="text-center mb-8 space-y-2 animate-in fade-in zoom-in-95 duration-700">
              <h1 className="text-4xl font-black tracking-tighter text-white">Find your next obsession</h1>
              <p className="text-zinc-500">Search for movies, shows, people, or community lists.</p>
            </div>
          )}

          <div className={`
            relative flex items-center bg-[#151518] ring-1 transition-all duration-300 rounded-2xl overflow-hidden shadow-2xl
            ${isFocused ? 'ring-white/30 bg-[#1a1a1e]' : 'ring-white/10 hover:ring-white/20'}
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
              onBlur={() => setTimeout(() => setIsFocused(false), 200)} // Delay to allow click
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

          {/* Recent Searches Dropdown */}
          {recentSearches.length > 0 && !hasQuery && isFocused && (
            <div className="absolute top-full mt-2 w-full bg-[#151518] border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                  <Clock size={12} />
                  Recent Searches
                </div>
                <button
                  onClick={() => {
                    const storageKey = user ? `recentSearches_${user.id}` : 'recentSearches_guest';
                    localStorage.removeItem(storageKey);
                    setRecentSearches([]);
                  }}
                  className="text-zinc-600 hover:text-red-500 transition-colors"
                >
                  <Trash size={14} />
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto custom-scrollbar">
                {recentSearches.map((search, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setQuery(search);
                      setShowRecents(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-white/5 transition-colors flex items-center gap-3 border-b border-white/5 last:border-0 group"
                  >
                    <div className="p-2 rounded-full bg-white/5 text-zinc-500 group-hover:text-white group-hover:bg-white/10 transition-all">
                      <Clock size={14} />
                    </div>
                    <span className="text-zinc-400 font-medium group-hover:text-white transition-colors">{search}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* "Did You Mean" Suggestion Banner */}
        {suggestion && hasQuery && (
          <>
            <div className="w-full max-w-7xl mt-4 animate-in fade-in zoom-in-95 duration-300">
              <button
                onClick={() => setQuery(suggestion)}
                className="w-full bg-zinc-900/30 border border-white/5 rounded-lg px-4 py-2.5 flex items-center gap-2 hover:border-white/10 hover:bg-zinc-900/50 transition-all text-left"
              >
                <span className="text-zinc-500 text-xs">Did you mean:</span>
                <span className="text-white font-medium text-sm">{suggestion}</span>
              </button>
            </div>
          </>
        )}

        {/* Quick Tags (Only visible when empty) */}
        {!hasQuery && (
          <div className="flex justify-center gap-3 mt-8 animate-in fade-in zoom-in-95 duration-1000">
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
          <div className="flex gap-2 mt-6 animate-in fade-in zoom-in-95 duration-500">
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

        {/* Detailed Filters (Only for Movies & TV tab) */}
        {hasQuery && activeTab === SearchTab.MOVIES && (
          <div className="flex flex-wrap items-center gap-3 mt-6 animate-in fade-in zoom-in-95 duration-500 overflow-x-auto pb-4 md:pb-0 scrollbar-hide w-full flex-nowrap md:flex-wrap">

            {/* Sort Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsSortOpen(!isSortOpen)}
                className={`
                  flex items-center gap-2 bg-[#1a1a1e] text-zinc-300 text-xs font-bold px-4 py-2.5 rounded-xl border transition-all whitespace-nowrap
                  ${isSortOpen ? 'border-white/20 text-white' : 'border-white/5 hover:border-white/10 hover:text-white'}
                `}
              >
                <ArrowUpDown size={12} />
                <span>{sortBy === 'relevance' ? 'Relevance' : sortBy === 'rating' ? 'Top Rated' : sortBy === 'year' ? 'Newest' : 'Popular'}</span>
                <ChevronDown size={12} className={`transition-transform duration-200 ${isSortOpen ? 'rotate-180' : ''}`} />
              </button>

              {isSortOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsSortOpen(false)} />
                  <div className="absolute top-full left-0 mt-2 w-40 bg-[#1a1a1e] border border-white/10 rounded-xl shadow-2xl z-50 animate-in fade-in zoom-in-98 duration-150 overflow-hidden">
                    <div className="p-1.5 space-y-0.5">
                      {[
                        { id: 'relevance', name: 'Relevance' },
                        { id: 'rating', name: 'Top Rated' },
                        { id: 'year', name: 'Newest' },
                        { id: 'popularity', name: 'Popular' },
                      ].map(sort => (
                        <button
                          key={sort.id}
                          onClick={() => {
                            setSortBy(sort.id as any);
                            setIsSortOpen(false);
                          }}
                          className={`
                            w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-between
                            ${sortBy === sort.id
                              ? 'bg-white text-black'
                              : 'text-zinc-400 hover:text-white hover:bg-white/5'}
                          `}
                        >
                          {sort.name}
                          {sortBy === sort.id && <Sparkles size={10} className="text-black" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Genre Filter */}
            <div className="relative">
              <button
                onClick={() => setIsGenreOpen(!isGenreOpen)}
                className={`
                  flex items-center gap-2 bg-[#1a1a1e] text-zinc-300 text-xs font-bold px-4 py-2.5 rounded-xl border transition-all whitespace-nowrap
                  ${isGenreOpen ? 'border-white/20 text-white' : 'border-white/5 hover:border-white/10 hover:text-white'}
                `}
              >
                {filterGenres.length > 0 ? (
                  <>
                    <span className="text-white">
                      {filterGenres.length} Genre{filterGenres.length > 1 ? 's' : ''}
                    </span>
                    <X size={12} className="ml-1 text-zinc-500 hover:text-white" onClick={(e) => { e.stopPropagation(); setFilterGenres([]); }} />
                  </>
                ) : (
                  <>
                    <span>Genre</span>
                    <ChevronDown size={12} className={`transition-transform duration-200 ${isGenreOpen ? 'rotate-180' : ''}`} />
                  </>
                )}
              </button>

              {/* Dropdown Menu */}
              {isGenreOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsGenreOpen(false)} />
                  <div className="absolute top-full left-0 mt-2 w-48 bg-[#1a1a1e] border border-white/10 rounded-xl shadow-2xl z-50 animate-in fade-in zoom-in-98 duration-150 overflow-hidden">
                    <div className="max-h-80 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
                      {[
                        { id: '', name: 'All Genres' },
                        { id: '28', name: 'Action' },
                        { id: '12', name: 'Adventure' },
                        { id: '16', name: 'Animation' },
                        { id: '35', name: 'Comedy' },
                        { id: '80', name: 'Crime' },
                        { id: '99', name: 'Documentary' },
                        { id: '18', name: 'Drama' },
                        { id: '10751', name: 'Family' },
                        { id: '14', name: 'Fantasy' },
                        { id: '36', name: 'History' },
                        { id: '27', name: 'Horror' },
                        { id: '10402', name: 'Music' },
                        { id: '9648', name: 'Mystery' },
                        { id: '10749', name: 'Romance' },
                        { id: '878', name: 'Sci-Fi' },
                        { id: '53', name: 'Thriller' },
                        { id: '10752', name: 'War' },
                        { id: '37', name: 'Western' },
                      ].map(genre => (
                        <button
                          key={genre.id}
                          onClick={() => {
                            if (genre.id === '') {
                              setFilterGenres([]); // Clear all
                            } else {
                              setFilterGenres(prev =>
                                prev.includes(genre.id)
                                  ? prev.filter(g => g !== genre.id) // Remove
                                  : [...prev, genre.id] // Add
                              );
                            }
                          }}
                          className={`
                            w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-between
                            ${filterGenres.includes(genre.id) || (genre.id === '' && filterGenres.length === 0)
                              ? 'bg-white text-black'
                              : 'text-zinc-400 hover:text-white hover:bg-white/5'}
                          `}
                        >
                          {genre.name}
                          {(filterGenres.includes(genre.id) || (genre.id === '' && filterGenres.length === 0)) && <Sparkles size={10} className="text-black" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Rating Filter (New Dropdown) */}
            <div className="relative">
              <button
                onClick={() => setIsRatingOpen(!isRatingOpen)}
                className={`
                  flex items-center gap-2 bg-[#1a1a1e] text-zinc-300 text-xs font-bold px-4 py-2.5 rounded-xl border transition-all whitespace-nowrap
                  ${isRatingOpen ? 'border-white/20 text-white' : 'border-white/5 hover:border-white/10 hover:text-white'}
                `}
              >
                <span>{minRating === 0 ? 'Any Rating' : `${minRating}+ Stars`}</span>
                <ChevronDown size={12} className={`transition-transform duration-200 ${isRatingOpen ? 'rotate-180' : ''}`} />
              </button>

              {isRatingOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsRatingOpen(false)} />
                  <div className="absolute top-full left-0 mt-2 w-32 bg-[#1a1a1e] border border-white/10 rounded-xl shadow-2xl z-50 animate-in fade-in zoom-in-98 duration-150 overflow-hidden">
                    <div className="p-1.5 space-y-0.5">
                      {[0, 6, 7, 8, 9].map(rating => (
                        <button
                          key={rating}
                          onClick={() => {
                            setMinRating(rating);
                            setIsRatingOpen(false);
                          }}
                          className={`
                            w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-between
                            ${minRating === rating
                              ? 'bg-white text-black'
                              : 'text-zinc-400 hover:text-white hover:bg-white/5'}
                          `}
                        >
                          {rating === 0 ? 'Any Rating' : `${rating}.0+`}
                          {minRating === rating && <Sparkles size={10} className="text-black" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Year Filter */}
            <div className="relative group">
              <input
                type="text"
                placeholder="Year"
                value={filterYear}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setFilterYear(val);
                }}
                className="w-20 bg-[#1a1a1e] border border-white/5 text-white text-xs font-bold px-3 py-2.5 rounded-xl outline-none focus:border-white/20 transition-all placeholder:text-zinc-600 text-center hover:border-white/10"
              />
            </div>

            <div className="flex-1" /> {/* Spacer */}

            {/* Type Filter */}
            <div className="flex bg-[#1a1a1e] rounded-xl p-1 border border-white/5">
              {(['multi', 'movie', 'tv'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all uppercase tracking-wider ${filterType === type
                    ? 'bg-white text-black shadow-lg'
                    : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                >
                  {type === 'multi' ? 'All' : type}
                </button>
              ))}
            </div>

            {/* Result Count Badge */}
            {!isSearching && results.length > 0 && (
              <div className="animate-in fade-in duration-500">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 bg-zinc-900/50 px-3 py-1.5 rounded-lg border border-white/5">
                  {sortedResults.length}{hasMore ? '+' : ''} Found
                </span>
              </div>
            )}

          </div>
        )}


      </div>

      {/* Results Grid */}
      <div className={`w-full transition-all duration-700 ease-out ${hasQuery ? 'opacity-100 translate-y-0 mt-8' : 'opacity-0 translate-y-20 mt-0 h-0 pointer-events-none'}`}>

        {isSearching ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="aspect-[2/3] bg-zinc-900/50 rounded-xl animate-pulse ring-1 ring-white/5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* MOVIE RESULTS */}
            {activeTab === SearchTab.MOVIES && sortedResults.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 pb-20 animate-in fade-in zoom-in-95 duration-500">
                {sortedResults
                  .filter(m => m.imageUrl && !m.imageUrl.includes('placeholder'))
                  .filter(m => filterGenres.length === 0 || (m.genreIds && m.genreIds.some(id => filterGenres.includes(id.toString())))) // Multi-genre filter
                  .map((movie, idx) => (
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

            {/* Load More Trigger */}
            {hasMore && activeTab === SearchTab.MOVIES && (
              <div className="flex justify-center pb-20">
                <button
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white px-8 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoadingMore ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </button>
              </div>
            )}

            {/* USER RESULTS */}
            {activeTab === SearchTab.USERS && userResults.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
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
  );
};
