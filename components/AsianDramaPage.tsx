import React from 'react';
import { requests } from '../services/tmdb';
import { Movie } from '../types';
import { Row } from './Row';

interface AsianDramaPageProps {
    onMovieSelect: (movie: Movie) => void;
    onViewAll: (category: { title: string; fetchUrl: string; forcedMediaType?: 'movie' | 'tv' }) => void;
}

export const AsianDramaPage: React.FC<AsianDramaPageProps> = ({ onMovieSelect, onViewAll }) => {
    return (
        <div className="pb-20 space-y-2">

            {/* Top Picks / Trending */}
            <Row
                title="Trending Asian Dramas"
                fetchUrl={requests.fetchAsianDramas}
                onMovieSelect={onMovieSelect}
                isLarge
                forcedMediaType="tv"
                onViewAll={() => onViewAll({ title: "Trending Asian Dramas", fetchUrl: requests.fetchAsianDramas, forcedMediaType: 'tv' })}
            />

            {/* K-Dramas */}
            <Row
                title="K-Dramas (Korean)"
                fetchUrl={requests.fetchKDramas}
                onMovieSelect={onMovieSelect}
                forcedMediaType="tv"
                onViewAll={() => onViewAll({ title: "K-Dramas", fetchUrl: requests.fetchKDramas, forcedMediaType: 'tv' })}
            />

            {/* C-Dramas */}
            <Row
                title="C-Dramas (Chinese)"
                fetchUrl={requests.fetchCDramas}
                onMovieSelect={onMovieSelect}
                forcedMediaType="tv"
                onViewAll={() => onViewAll({ title: "C-Dramas", fetchUrl: requests.fetchCDramas, forcedMediaType: 'tv' })}
            />

            {/* J-Dramas */}
            <Row
                title="J-Dramas (Japanese)"
                fetchUrl={requests.fetchJDramas}
                onMovieSelect={onMovieSelect}
                forcedMediaType="tv"
                onViewAll={() => onViewAll({ title: "J-Dramas", fetchUrl: requests.fetchJDramas, forcedMediaType: 'tv' })}
            />
        </div>
    );
};
