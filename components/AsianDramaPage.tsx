import React from 'react';
import { TmdbService } from '../services/tmdb';
import { Movie } from '../types';
import { CategoryRow } from './CategoryRow';

interface AsianDramaPageProps {
    onMovieSelect: (movie: Movie) => void;
}

export const AsianDramaPage: React.FC<AsianDramaPageProps> = ({ onMovieSelect }) => {
    return (
        <div className="pb-20 space-y-2">

            {/* Top Picks / Trending */}
            <CategoryRow
                title="Trending Asian Dramas"
                fetcher={TmdbService.getAsianDramas}
                onMovieSelect={onMovieSelect}
                isLarge
            />

            {/* K-Dramas */}
            <CategoryRow
                title="K-Dramas (Korean)"
                fetcher={TmdbService.getKDramas}
                onMovieSelect={onMovieSelect}
            />

            {/* C-Dramas */}
            <CategoryRow
                title="C-Dramas (Chinese)"
                fetcher={TmdbService.getCDramas}
                onMovieSelect={onMovieSelect}
            />

            {/* J-Dramas */}
            <CategoryRow
                title="J-Dramas (Japanese)"
                fetcher={TmdbService.getJDramas}
                onMovieSelect={onMovieSelect}
            />
        </div>
    );
};
