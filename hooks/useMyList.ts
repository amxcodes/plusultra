import { useState, useEffect } from 'react';
import { Movie } from '../types';

const STORAGE_KEY = 'my_list_v1';

export const useMyList = () => {
    const [list, setList] = useState<Movie[]>([]);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            setList(JSON.parse(stored));
        }
    }, []);

    const addToList = (movie: Movie) => {
        setList(prev => {
            if (prev.find(m => m.id === movie.id)) return prev;
            const newList = [movie, ...prev];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
            return newList;
        });
    };

    const removeFromList = (movieId: number) => {
        setList(prev => {
            const newList = prev.filter(m => m.id !== movieId);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
            return newList;
        });
    };

    const isInList = (movieId: number) => {
        return list.some(m => m.id === movieId);
    };

    return { list, addToList, removeFromList, isInList };
};
