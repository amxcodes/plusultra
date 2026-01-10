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

            {/* Featured / Trending Row (Large) */}
            <CategoryRow
                title="Trending Asian Dramas"
                fetcher={TmdbService.getAsianDramas}
                onMovieSelect={onMovieSelect}
                isLarge
            />

            {/* K-Drama */}
            <CategoryRow
                title="Korean Dramas (K-Drama)"
                fetcher={TmdbService.getKDramas}
                onMovieSelect={onMovieSelect}
            />

            {/* C-Drama */}
            <CategoryRow
                title="Chinese Dramas (C-Drama)"
                fetcher={TmdbService.getCDramas}
                onMovieSelect={onMovieSelect}
            />

            {/* J-Drama */}
            <CategoryRow
                title="Japanese Dramas (Live Action)"
                fetcher={TmdbService.getJDramas}
                onMovieSelect={onMovieSelect}
            />
        </div>
    );
};
