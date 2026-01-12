import React from 'react';
import { TmdbService } from '../services/tmdb';
import { Movie } from '../types';
import { CategoryRow } from './CategoryRow';

interface AnimePageProps {
    onMovieSelect: (movie: Movie) => void;
}

export const AnimePage: React.FC<AnimePageProps> = ({ onMovieSelect }) => {
    return (
        <div className="pb-20 space-y-2">

            {/* Featured Anime (Using general anime fetcher as featured for now) */}
            <CategoryRow
                title="Trending Anime"
                fetcher={TmdbService.getAnime}
                onMovieSelect={onMovieSelect}
                isLarge
            />

            {/* Anime Movies */}
            <CategoryRow
                title="Anime Movies"
                fetcher={TmdbService.getAnimeMovies}
                onMovieSelect={onMovieSelect}
            />

            {/* Action Anime */}
            <CategoryRow
                title="Action Anime"
                fetcher={TmdbService.getActionAnime}
                onMovieSelect={onMovieSelect}
            />

            {/* Romance Anime */}
            <CategoryRow
                title="Romance Anime"
                fetcher={TmdbService.getRomanceAnime}
                onMovieSelect={onMovieSelect}
            />
        </div>
    );
};
