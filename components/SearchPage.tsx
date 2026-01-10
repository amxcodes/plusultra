import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Movie } from '../types';
import { MovieCard } from './MovieCard';
import { TmdbService } from '../services/tmdb';

interface SearchPageProps {
  movies?: Movie[]; // Kept for type compatibility but unused
  onMovieSelect: (movie: Movie) => void;
}

export const SearchPage: React.FC<SearchPageProps> = ({ onMovieSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Movie[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.trim() === '') {
        setResults([]);
        return;
      }

      setIsSearching(true);
      const searchResults = await TmdbService.search(query);
      setResults(searchResults);
      setIsSearching(false);
    }, 500); // 500ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const hasQuery = query.length > 0;

  // Filter out items without proper images to avoid ugly gaps/broken cards
  const filteredResults = results.filter(m => m.imageUrl && !m.imageUrl.includes('null'));

  return (
    <div className="min-h-screen w-full bg-[#0f1014] relative overflow-hidden pl-24 pr-8">

      <div className={`
        relative w-full max-w-7xl mx-auto flex flex-col transition-all duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)]
        ${hasQuery ? 'pt-12 items-start' : 'h-screen items-center justify-center -mt-20'}
      `}>

        {/* Search Input Container - Centered and limited width for focus */}
        <div className="w-full max-w-3xl mx-auto">
          <div className={`
            relative flex items-center bg-[#151518] border transition-colors duration-200 rounded-xl overflow-hidden
            ${isFocused ? 'border-white/40' : 'border-white/10'}
          `}>
            <div className="pl-5 text-white/30">
              <Search size={22} className={isFocused ? 'text-white' : ''} />
            </div>
            <input
              autoFocus
              type="text"
              placeholder="Search movies, TV shows, people..."
              className="w-full bg-transparent text-white px-5 py-4 outline-none text-xl placeholder:text-white/20 font-medium"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
            />
            {hasQuery && (
              <button
                onClick={() => setQuery('')}
                className="pr-5 text-white/30 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Results Grid */}
        <div className={`w-full transition-all duration-500 ${hasQuery ? 'opacity-100 translate-y-0 mt-12' : 'opacity-0 translate-y-10 mt-0 h-0'}`}>

          {isSearching ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white/20"></div>
            </div>
          ) : filteredResults.length > 0 ? (
            <>
              <h3 className="text-white/50 text-sm font-semibold uppercase tracking-wider mb-8 px-2">
                Top Results
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 pb-20">
                {filteredResults.map((movie) => (
                  <div key={movie.id} onClick={() => onMovieSelect(movie)} className="cursor-pointer">
                    <MovieCard movie={movie} />
                  </div>
                ))}
              </div>
            </>
          ) : hasQuery && !isSearching ? (
            <div className="text-center text-white/30 py-20">
              No results found for "{query}"
            </div>
          ) : null}
        </div>

      </div>
    </div>
  );
};