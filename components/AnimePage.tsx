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

            {/* Featured / Trending Row (Large) */}
            <CategoryRow
                title="Trending Anime"
                fetcher={TmdbService.getAnime}
                onMovieSelect={onMovieSelect}
                isLarge
            />

            {/* Anime Movies */}
            <CategoryRow
                title="Top Rated Anime Movies"
                fetcher={TmdbService.getAnimeMovies}
                onMovieSelect={onMovieSelect}
            />

            {/* Action Anime */}
            <CategoryRow
                title="Action & Adventure Lists"
                fetcher={TmdbService.getActionAnime}
                onMovieSelect={onMovieSelect}
            />

            {/* Romance Anime */}
            <CategoryRow
                title="Romance Series"
                fetcher={TmdbService.getRomanceAnime}
                onMovieSelect={onMovieSelect}
            />
        </div>
    );
};
