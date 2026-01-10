import React from 'react';
import { TmdbService } from '../services/tmdb';
import { Movie } from '../types';
import { CategoryRow } from './CategoryRow';

interface LatestPageProps {
    onMovieSelect: (movie: Movie) => void;
}

export const LatestPage: React.FC<LatestPageProps> = ({ onMovieSelect }) => {
    return (
        <div className="pb-20 space-y-2">

            {/* Now Playing (Large) */}
            <CategoryRow
                title="Now Playing In Theaters"
                fetcher={TmdbService.getNowPlaying}
                onMovieSelect={onMovieSelect}
                isLarge
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
