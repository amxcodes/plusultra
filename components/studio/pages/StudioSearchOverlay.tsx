import React from 'react';
import { Movie } from '../../../types';
import { StudioSearchPage } from './StudioSearchPage';

interface StudioSearchOverlayProps {
  onClose: () => void;
  onMovieSelect: (movie: Movie) => void;
  onNavigate: (page: string, params?: any) => void;
}

export const StudioSearchOverlay: React.FC<StudioSearchOverlayProps> = ({ onClose, onMovieSelect }) => (
  <StudioSearchPage onClose={onClose} onMovieSelect={onMovieSelect} />
);
