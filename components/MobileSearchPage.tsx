
import React, { useState, useEffect } from 'react';
import { Search, X, Users, Disc, Film, Sparkles, TrendingUp, Clock, Trash, ChevronDown, ArrowUpDown } from 'lucide-react';
import { Movie, Profile, Playlist } from '../types';
import { MovieCard } from './MovieCard';
import { TmdbService } from '../services/tmdb';
import { SocialService } from '../lib/social';
import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../lib/AuthContext';

enum SearchTab {
    MOVIES = 'Movies',
    USERS = 'Users',
    PLAYLISTS = 'Lists'
}

interface MobileSearchPageProps {
    onMovieSelect: (movie: Movie) => void;
    onNavigate?: (page: string, params?: any) => void;
    onClose?: () => void;
}

export const MobileSearchPage: React.FC<MobileSearchPageProps> = ({ onMovieSelect, onNavigate, onClose }) => {
    const [query, setQuery] = useState('');
    const [activeTab, setActiveTab] = useState<SearchTab>(SearchTab.MOVIES);
    const [filterType, setFilterType] = useState<'multi' | 'movie' | 'tv'>('multi');
    const [filterYear, setFilterYear] = useState('');
    const [filterGenres, setFilterGenres] = useState<string[]>([]);
    const [sortBy, setSortBy] = useState<'relevance' | 'rating' | 'year' | 'popularity'>('relevance');

    // Mobile UI States
    const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

    const [dynamicTerms, setDynamicTerms] = useState<string[]>([]);
    const [suggestion, setSuggestion] = useState<string>('');

    const debouncedQuery = useDebounce(query, 500);

    const [results, setResults] = useState<Movie[]>([]);
    const [userResults, setUserResults] = useState<Profile[]>([]);
    const [playlistResults, setPlaylistResults] = useState<Playlist[]>([]);

    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);

    const { user } = useAuth();

    const sanitizeRecentSearches = (value: unknown): string[] => {
        if (!Array.isArray(value)) return [];

        return value
            .filter((entry): entry is string => typeof entry === 'string')
            .map(entry => entry.trim())
            .filter(entry => entry.length > 0);
    };

    // Load Recents
    useEffect(() => {
        const loadRecents = async () => {
            const storageKey = user ? `recentSearches_${user.id}` : 'recentSearches_guest';
            const localRecents = sanitizeRecentSearches(JSON.parse(localStorage.getItem(storageKey) || '[]'));

            if (user) {
                try {
                    const dbRecents = sanitizeRecentSearches(await SocialService.getRecentSearches(user.id));
                    const merged = [...dbRecents];
                    localRecents.forEach(search => {
                        if (!merged.find(s => s.toLowerCase() === search.toLowerCase())) {
                            merged.push(search);
                        }
                    });
                    setRecentSearches(merged.slice(0, 10));
                } catch (e) {
                    setRecentSearches(localRecents.slice(0, 10));
                }
            } else {
                setRecentSearches(localRecents.slice(0, 10));
            }
        };
        loadRecents();
    }, [user]);

    // Fetch Trending
    useEffect(() => {
        const fetchTrendingTerms = async () => {
            // ... same logic as desktop
            const CACHE_KEY = 'fuzzySearchCache';
            try {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    const { terms, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < 86400000) {
                        setDynamicTerms(terms);
                        return;
                    }
                }
                const trending = await TmdbService.getTrending();
                const titles = trending.map(m => m.title.toLowerCase()).filter(t => t.length > 2);
                setDynamicTerms(titles);
                localStorage.setItem(CACHE_KEY, JSON.stringify({ terms: titles, timestamp: Date.now() }));
            } catch (e) {
                console.error(e);
            }
        };
        fetchTrendingTerms();
    }, []);

    const saveSearch = async (query: string) => {
        if (!query.trim() || query.length < 2) return;
        const storageKey = user ? `recentSearches_${user.id}` : 'recentSearches_guest';
        const localRecents = sanitizeRecentSearches(JSON.parse(localStorage.getItem(storageKey) || '[]'));
        const updated = [query, ...localRecents.filter(s => s.toLowerCase() !== query.toLowerCase())].slice(0, 10);
        localStorage.setItem(storageKey, JSON.stringify(updated));
        setRecentSearches(updated);
        if (user) await SocialService.saveRecentSearch(user.id, query).catch(console.error);
    };

    useEffect(() => {
        const performSearch = async () => {
            if (debouncedQuery.trim() === '') {
                setResults([]); setUserResults([]); setPlaylistResults([]); return;
            }
            setPage(1); setHasMore(true); setIsSearching(true);
            try {
                if (activeTab === SearchTab.MOVIES) {
                    const searchResults = await TmdbService.search(debouncedQuery, { type: filterType, year: filterYear.length === 4 ? filterYear : undefined, page: 1 });
                    setResults(searchResults);
                    setHasMore(searchResults.length === 20);
                    if (searchResults.length > 0) saveSearch(debouncedQuery);
                } else if (activeTab === SearchTab.USERS) {
                    setUserResults(await SocialService.searchUsers(debouncedQuery));
                } else if (activeTab === SearchTab.PLAYLISTS) {
                    setPlaylistResults(await SocialService.searchPlaylists(debouncedQuery));
                }
            } catch (e) { console.error(e); } finally { setIsSearching(false); }
        };
        performSearch();
    }, [debouncedQuery, activeTab, filterType, filterYear]);

    const loadMore = async () => {
        if (isLoadingMore || !hasMore || activeTab !== SearchTab.MOVIES) return;
        setIsLoadingMore(true);
        try {
            const moreResults = await TmdbService.search(debouncedQuery, { type: filterType, page: page + 1 });
            if (moreResults.length === 0) setHasMore(false);
            else { setResults(prev => [...prev, ...moreResults]); setPage(p => p + 1); setHasMore(moreResults.length === 20); }
        } catch (e) { console.error(e); } finally { setIsLoadingMore(false); }
    };

    const hasQuery = query.length > 0;

    // Sorting
    const sortedResults = React.useMemo(() => {
        if (activeTab !== SearchTab.MOVIES || results.length === 0) return results;
        let filtered = results;
        switch (sortBy) {
            case 'rating': return filtered.sort((a, b) => (b.match || 0) - (a.match || 0));
            case 'year': return filtered.sort((a, b) => b.year - a.year);
            case 'popularity': return filtered.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
            default: return filtered;
        }
    }, [results, sortBy]);

    return (
        <div className="min-h-screen w-full bg-[#0f1014] flex flex-col pb-20 safe-area-bottom">

            {/* Mobile Header: Input & Close */}
            <div className="pt-4 px-4 pb-2 bg-[#0f1014] z-50 sticky top-0">
                <div className="flex items-center gap-3">
                    <div className="flex-1 relative flex items-center bg-[#1a1a1e] rounded-xl border border-white/10 h-12">
                        <Search size={18} className="ml-4 text-zinc-500" />
                        <input
                            autoFocus
                            type="text"
                            placeholder="Search..."
                            className="flex-1 bg-transparent text-white px-3 text-sm font-medium outline-none placeholder:text-zinc-600"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                        {hasQuery && (
                            <button onClick={() => setQuery('')} className="p-3 text-zinc-500 active:text-white"><X size={16} /></button>
                        )}
                    </div>
                    {onClose && (
                        <button onClick={onClose} className="text-white text-sm font-bold">Done</button>
                    )}
                </div>

                {/* Quick Filter Tabs */}
                {hasQuery && (
                    <div className="flex gap-2 mt-4 overflow-x-auto no-scrollbar scrollbar-hide py-1">
                        {Object.values(SearchTab).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${activeTab === tab ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-500 border border-white/5'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}

                        {/* Add Filter Toggle if Movies */}
                        {activeTab === SearchTab.MOVIES && (
                            <button
                                onClick={() => setSortBy(sortBy === 'relevance' ? 'year' : sortBy === 'year' ? 'rating' : 'relevance')}
                                className="px-3 py-2 rounded-lg text-xs font-bold bg-zinc-900 text-zinc-400 border border-white/5 flex items-center gap-1"
                            >
                                <TrendingUp size={12} /> {sortBy === 'relevance' ? 'Sort' : sortBy}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-4 pt-4 pb-20 custom-scrollbar">

                {/* 1. Empty State / Recent Searches */}
                {!hasQuery && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h1 className="text-2xl font-black text-white mb-2 tracking-tight">Search</h1>
                        <p className="text-zinc-500 text-sm mb-8">Find movies, people, and playlists.</p>

                        {recentSearches.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Recent</h3>
                                    <button onClick={() => setRecentSearches([])} className="text-zinc-700 hover:text-red-500"><Trash size={14} /></button>
                                </div>
                                <div className="space-y-1">
                                    {recentSearches.map((term, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setQuery(term)}
                                            className="w-full flex items-center gap-3 p-3 bg-zinc-900/50 rounded-xl border border-white/5 active:bg-zinc-800 transition-colors"
                                        >
                                            <Clock size={14} className="text-zinc-600" />
                                            <span className="text-zinc-300 text-sm font-medium">{term}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="mt-8">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Trending</h3>
                            <div className="flex flex-wrap gap-2">
                                {["Anime", "Action", "Romance", "Top Rated", "New Releases"].map(tag => (
                                    <button key={tag} onClick={() => setQuery(tag)} className="px-4 py-2 bg-zinc-900 border border-white/5 rounded-full text-xs font-bold text-zinc-400">
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Loading State */}
                {isSearching && (
                    <div className="grid grid-cols-2 gap-4">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="aspect-[2/3] bg-zinc-900 rounded-xl animate-pulse" />
                        ))}
                    </div>
                )}

                {/* 3. Results */}
                {!isSearching && hasQuery && (
                    <div className="animate-in fade-in duration-300">

                        {/* Movies */}
                        {activeTab === SearchTab.MOVIES && results.length > 0 && (
                            <div className="grid grid-cols-2 gap-4 pb-12">
                                {sortedResults.filter(m => m.imageUrl && !m.imageUrl.includes('placeholder')).map((movie, idx) => (
                                    <div key={movie.id} onClick={() => onMovieSelect(movie)} className="active:scale-95 transition-transform" style={{ animationDelay: `${idx * 50}ms` }}>
                                        <MovieCard movie={movie} />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Users */}
                        {activeTab === SearchTab.USERS && userResults.length > 0 && (
                            <div className="space-y-3 pb-12">
                                {userResults.map(u => (
                                    <div key={u.id} onClick={() => onNavigate && onNavigate('profile', { id: u.id })} className="flex items-center gap-3 p-3 bg-zinc-900 rounded-xl border border-white/5 active:bg-zinc-800">
                                        <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}`} className="w-10 h-10 rounded-full" />
                                        <div>
                                            <div className="text-sm font-bold text-white">{u.username}</div>
                                            <div className="text-[10px] text-zinc-500 uppercase">{u.role}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Load More */}
                        {hasMore && activeTab === SearchTab.MOVIES && !isSearching && results.length > 0 && (
                            <div className="flex justify-center pb-8 pt-4">
                                <button onClick={loadMore} disabled={isLoadingMore} className="bg-zinc-800 text-white px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                    {isLoadingMore ? 'Loading...' : 'Load More'}
                                </button>
                            </div>
                        )}

                        {/* No Results */}
                        {!isSearching && ((activeTab === SearchTab.MOVIES && results.length === 0) || (activeTab === SearchTab.USERS && userResults.length === 0)) && (
                            <div className="text-center py-20 text-zinc-500">
                                <Search size={48} className="mx-auto mb-4 opacity-20" />
                                <p>No results found for "{query}"</p>
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
};
