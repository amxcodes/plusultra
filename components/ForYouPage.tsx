import React, { useMemo } from 'react';
import { TmdbService } from '../services/tmdb';
import { Movie } from '../types';
import { CategoryRow } from './CategoryRow';
import { useWatchHistory, WatchProgress } from './useWatchHistory';

interface ForYouPageProps {
    onMovieSelect: (movie: Movie) => void;
}

export const ForYouPage: React.FC<ForYouPageProps> = ({ onMovieSelect }) => {
    const { history } = useWatchHistory();

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

            {/* Personalized Recommendations */}
            {recommendations.map(item => (
                <CategoryRow
                    key={item.tmdbId}
                    title={`Because you watched ${item.title}`}
                    fetcher={() => TmdbService.getRecommendations(item.tmdbId, item.type)}
                    onMovieSelect={onMovieSelect}
                />
            ))}

            {/* Now Playing (Large) */}
            <CategoryRow
                title="Now Playing In Theaters"
                fetcher={TmdbService.getNowPlaying}
                onMovieSelect={onMovieSelect}
                isLarge={recommendations.length === 0} // Only show large header if no recommendations exist
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
