import React from 'react';
import { requests } from '../services/tmdb';
import { Movie } from '../types';
import { Row } from './Row';
import { MobileRow } from './MobileRow';

interface AnimePageProps {
    onMovieSelect: (movie: Movie) => void;
    onViewAll: (category: { title: string; fetchUrl: string; forcedMediaType?: 'movie' | 'tv' }) => void;
}

export const AnimePage: React.FC<AnimePageProps> = ({ onMovieSelect, onViewAll }) => {
    return (
        <div className="pb-20 space-y-2">

            {/* Featured Anime */}
            <div className="hidden md:block">
                <Row
                    title="Trending Anime"
                    fetchUrl={requests.fetchAnimeTrending}
                    onMovieSelect={onMovieSelect}
                    isLarge
                    forcedMediaType="tv"
                    onViewAll={() => onViewAll({ title: "Trending Anime", fetchUrl: requests.fetchAnimeTrending, forcedMediaType: 'tv' })}
                />
            </div>
            <div className="md:hidden">
                <MobileRow
                    title="Trending Anime"
                    fetchUrl={requests.fetchAnimeTrending}
                    onMovieSelect={onMovieSelect}
                    isLarge
                    forcedMediaType="tv"
                    onViewAll={() => onViewAll({ title: "Trending Anime", fetchUrl: requests.fetchAnimeTrending, forcedMediaType: 'tv' })}
                />
            </div>

            {/* Anime Movies */}
            <div className="hidden md:block">
                <Row
                    title="Anime Movies"
                    fetchUrl={requests.fetchAnimeMovies}
                    onMovieSelect={onMovieSelect}
                    forcedMediaType="movie"
                    onViewAll={() => onViewAll({ title: "Anime Movies", fetchUrl: requests.fetchAnimeMovies, forcedMediaType: 'movie' })}
                />
            </div>
            <div className="md:hidden">
                <MobileRow
                    title="Anime Movies"
                    fetchUrl={requests.fetchAnimeMovies}
                    onMovieSelect={onMovieSelect}
                    forcedMediaType="movie"
                    onViewAll={() => onViewAll({ title: "Anime Movies", fetchUrl: requests.fetchAnimeMovies, forcedMediaType: 'movie' })}
                />
            </div>

            {/* Action Anime */}
            <div className="hidden md:block">
                <Row
                    title="Action Anime"
                    fetchUrl={requests.fetchAnimeAction}
                    onMovieSelect={onMovieSelect}
                    forcedMediaType="tv"
                    onViewAll={() => onViewAll({ title: "Action Anime", fetchUrl: requests.fetchAnimeAction, forcedMediaType: 'tv' })}
                />
            </div>
            <div className="md:hidden">
                <MobileRow
                    title="Action Anime"
                    fetchUrl={requests.fetchAnimeAction}
                    onMovieSelect={onMovieSelect}
                    forcedMediaType="tv"
                    onViewAll={() => onViewAll({ title: "Action Anime", fetchUrl: requests.fetchAnimeAction, forcedMediaType: 'tv' })}
                />
            </div>

            {/* Romance Anime */}
            <div className="hidden md:block">
                <Row
                    title="Romance Anime"
                    fetchUrl={requests.fetchAnimeRomance}
                    onMovieSelect={onMovieSelect}
                    forcedMediaType="tv"
                    onViewAll={() => onViewAll({ title: "Romance Anime", fetchUrl: requests.fetchAnimeRomance, forcedMediaType: 'tv' })}
                />
            </div>
            <div className="md:hidden">
                <MobileRow
                    title="Romance Anime"
                    fetchUrl={requests.fetchAnimeRomance}
                    onMovieSelect={onMovieSelect}
                    forcedMediaType="tv"
                    onViewAll={() => onViewAll({ title: "Romance Anime", fetchUrl: requests.fetchAnimeRomance, forcedMediaType: 'tv' })}
                />
            </div>
        </div>
    );
};
