import React from 'react';
import { requests } from '../services/tmdb';
import { Movie } from '../types';
import { Row } from './Row';
import { MobileRow } from './MobileRow';

interface AsianDramaPageProps {
    onMovieSelect: (movie: Movie) => void;
    onViewAll: (category: { title: string; fetchUrl: string; forcedMediaType?: 'movie' | 'tv' }) => void;
}

export const AsianDramaPage: React.FC<AsianDramaPageProps> = ({ onMovieSelect, onViewAll }) => {
    return (
        <div className="pb-20 space-y-2">

            {/* Top Picks / Trending */}
            <div className="hidden md:block">
                <Row
                    title="Trending Asian Dramas"
                    fetchUrl={requests.fetchAsianDramas}
                    onMovieSelect={onMovieSelect}
                    isLarge
                    forcedMediaType="tv"
                    onViewAll={() => onViewAll({ title: "Trending Asian Dramas", fetchUrl: requests.fetchAsianDramas, forcedMediaType: 'tv' })}
                />
            </div>
            <div className="md:hidden">
                <MobileRow
                    title="Trending Asian Dramas"
                    fetchUrl={requests.fetchAsianDramas}
                    onMovieSelect={onMovieSelect}
                    isLarge
                    forcedMediaType="tv"
                    onViewAll={() => onViewAll({ title: "Trending Asian Dramas", fetchUrl: requests.fetchAsianDramas, forcedMediaType: 'tv' })}
                />
            </div>

            {/* K-Dramas */}
            <div className="hidden md:block">
                <Row
                    title="K-Dramas (Korean)"
                    fetchUrl={requests.fetchKDramas}
                    onMovieSelect={onMovieSelect}
                    forcedMediaType="tv"
                    onViewAll={() => onViewAll({ title: "K-Dramas", fetchUrl: requests.fetchKDramas, forcedMediaType: 'tv' })}
                />
            </div>
            <div className="md:hidden">
                <MobileRow
                    title="K-Dramas (Korean)"
                    fetchUrl={requests.fetchKDramas}
                    onMovieSelect={onMovieSelect}
                    forcedMediaType="tv"
                    onViewAll={() => onViewAll({ title: "K-Dramas", fetchUrl: requests.fetchKDramas, forcedMediaType: 'tv' })}
                />
            </div>

            {/* C-Dramas */}
            <div className="hidden md:block">
                <Row
                    title="C-Dramas (Chinese)"
                    fetchUrl={requests.fetchCDramas}
                    onMovieSelect={onMovieSelect}
                    forcedMediaType="tv"
                    onViewAll={() => onViewAll({ title: "C-Dramas", fetchUrl: requests.fetchCDramas, forcedMediaType: 'tv' })}
                />
            </div>
            <div className="md:hidden">
                <MobileRow
                    title="C-Dramas (Chinese)"
                    fetchUrl={requests.fetchCDramas}
                    onMovieSelect={onMovieSelect}
                    forcedMediaType="tv"
                    onViewAll={() => onViewAll({ title: "C-Dramas", fetchUrl: requests.fetchCDramas, forcedMediaType: 'tv' })}
                />
            </div>

            {/* J-Dramas */}
            <div className="hidden md:block">
                <Row
                    title="J-Dramas (Japanese)"
                    fetchUrl={requests.fetchJDramas}
                    onMovieSelect={onMovieSelect}
                    forcedMediaType="tv"
                    onViewAll={() => onViewAll({ title: "J-Dramas", fetchUrl: requests.fetchJDramas, forcedMediaType: 'tv' })}
                />
            </div>
            <div className="md:hidden">
                <MobileRow
                    title="J-Dramas (Japanese)"
                    fetchUrl={requests.fetchJDramas}
                    onMovieSelect={onMovieSelect}
                    forcedMediaType="tv"
                    onViewAll={() => onViewAll({ title: "J-Dramas", fetchUrl: requests.fetchJDramas, forcedMediaType: 'tv' })}
                />
            </div>
        </div>
    );
};
