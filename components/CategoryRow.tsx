import React, { useState, useEffect } from 'react';
import { Row } from './Row';
import { Movie } from '../types';

interface CategoryRowProps {
    title: string;
    fetcher: () => Promise<Movie[]>;
    onMovieSelect: (movie: Movie) => void;
    isLarge?: boolean;
    forcedMediaType?: 'movie' | 'tv';
}

export const CategoryRow: React.FC<CategoryRowProps> = ({ title, fetcher, onMovieSelect, isLarge, forcedMediaType }) => {
    const [movies, setMovies] = useState<Movie[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const data = await fetcher();
            setMovies(data);
            setLoading(false);
        };
        load();
    }, [fetcher]);

    if (!loading && (!movies || movies.length === 0)) return null;

    return <Row title={title} movies={movies} onMovieSelect={onMovieSelect} isLarge={isLarge} forcedMediaType={forcedMediaType} isLoading={loading} />;
};
