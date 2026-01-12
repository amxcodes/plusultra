import React from 'react';
import { requests } from '../services/tmdb';
import { Movie } from '../types';
import { Row } from './Row';

interface AnimePageProps {
    onMovieSelect: (movie: Movie) => void;
    onViewAll: (category: { title: string; fetchUrl: string; forcedMediaType?: 'movie' | 'tv' }) => void;
}

export const AnimePage: React.FC<AnimePageProps> = ({ onMovieSelect, onViewAll }) => {
    return (
        <div className="pb-20 space-y-2">

            {/* Featured Anime */}
            <Row
                title="Trending Anime"
                fetchUrl={requests.fetchAnimeTrending}
                onMovieSelect={onMovieSelect}
                isLarge
                forcedMediaType="tv"
                onViewAll={() => onViewAll({ title: "Trending Anime", fetchUrl: requests.fetchAnimeTrending, forcedMediaType: 'tv' })}
            />

            {/* Anime Movies */}
            <Row
                title="Anime Movies"
                fetchUrl={requests.fetchAnimeMovies}
                onMovieSelect={onMovieSelect}
                forcedMediaType="movie"
                onViewAll={() => onViewAll({ title: "Anime Movies", fetchUrl: requests.fetchAnimeMovies, forcedMediaType: 'movie' })}
            />

            {/* Action Anime */}
            <Row
                title="Action Anime"
                fetchUrl={requests.fetchAnimeAction}
                onMovieSelect={onMovieSelect}
                forcedMediaType="tv"
                onViewAll={() => onViewAll({ title: "Action Anime", fetchUrl: requests.fetchAnimeAction, forcedMediaType: 'tv' })}
            />

            {/* Romance Anime */}
            <Row
                title="Romance Anime"
                fetchUrl={requests.fetchAnimeRomance}
                onMovieSelect={onMovieSelect}
                forcedMediaType="tv"
                onViewAll={() => onViewAll({ title: "Romance Anime", fetchUrl: requests.fetchAnimeRomance, forcedMediaType: 'tv' })}
            />
        </div>
    );
};
