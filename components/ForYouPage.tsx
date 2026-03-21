import React, { useMemo } from 'react';
import { TmdbService } from '../services/tmdb';
import { Movie } from '../types';
import { CategoryRow } from './CategoryRow';
import { useWatchHistory, WatchProgress } from './useWatchHistory';

interface ForYouPageProps {
    onMovieSelect: (movie: Movie) => void;
}

export const ForYouPage: React.FC<ForYouPageProps> = ({ onMovieSelect }) => {
    const { history, isLoading } = useWatchHistory();

    const recommendations = useMemo(() => {
        // Get all history items
        const items = Object.values(history) as WatchProgress[];

        // Sort by lastUpdated (descending) and take top 5
        return items
            .sort((a, b) => b.lastUpdated - a.lastUpdated)
            .slice(0, 5);
    }, [history]);

    return (
        <div className="pb-20 space-y-2">

            {/* Loading Skeletons - Prevent glitch/pop-in */}
            {isLoading && (
                <>
                    <div className="pl-4 md:pl-12 my-8 relative z-10 animate-pulse">
                        <div className="h-6 w-48 bg-white/5 rounded mb-4 ml-2" />
                        <div className="flex items-center space-x-4 overflow-hidden px-4 py-8">
                            {[1, 2, 3, 4, 5].map(i => <div key={i} className="bg-zinc-900 rounded-lg min-w-[180px] md:min-w-[220px] aspect-[2/3]" />)}
                        </div>
                    </div>
                    <div className="pl-4 md:pl-12 my-8 relative z-10 animate-pulse">
                        <div className="h-6 w-48 bg-white/5 rounded mb-4 ml-2" />
                        <div className="flex items-center space-x-4 overflow-hidden px-4 py-8">
                            {[1, 2, 3, 4, 5].map(i => <div key={i} className="bg-zinc-900 rounded-lg min-w-[180px] md:min-w-[220px] aspect-[2/3]" />)}
                        </div>
                    </div>
                </>
            )}

            {/* Personalized Recommendations */}
            {!isLoading && recommendations.map(item => (
                <CategoryRow
                    key={item.tmdbId}
                    title={`Because you recently opened ${item.title}`}
                    fetcher={() => TmdbService.getRecommendations(item.tmdbId, item.type)}
                    onMovieSelect={onMovieSelect}
                />
            ))}

            {/* Now Playing (Large) */}
            <CategoryRow
                title="Now Playing In Theaters"
                fetcher={TmdbService.getNowPlaying}
                onMovieSelect={onMovieSelect}
                isLarge={!isLoading && recommendations.length === 0} // Only show large header if loaded + no reqs
            />

            {/* Upcoming */}
            <CategoryRow
                title="Coming Soon"
                fetcher={TmdbService.getUpcoming}
                onMovieSelect={onMovieSelect}
            />

            {/* Trending */}
            <CategoryRow
                title="Trending This Week"
                fetcher={TmdbService.getTrending}
                onMovieSelect={onMovieSelect}
            />
        </div>
    );
};
