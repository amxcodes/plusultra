import React from 'react';
import { X } from 'lucide-react';
import { Movie } from '../../../types';
import { SearchPage } from '../../SearchPage';
import { StudioButton } from '../system/StudioButton';

interface StudioSearchOverlayProps {
  onClose: () => void;
  onMovieSelect: (movie: Movie) => void;
  onNavigate: (page: string, params?: any) => void;
}

export const StudioSearchOverlay: React.FC<StudioSearchOverlayProps> = ({ onClose, onMovieSelect, onNavigate }) => (
  <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/96 text-white">
    <div className="pointer-events-none fixed inset-x-0 top-0 h-52 bg-[radial-gradient(circle_at_top,var(--studio-accent-soft),transparent_58%)]" />
    <div className="sticky top-0 z-10 flex justify-end p-4">
      <StudioButton size="icon" variant="glass" onClick={onClose} aria-label="Close search">
        <X size={18} />
      </StudioButton>
    </div>
    <div className="mx-auto max-w-[1400px] px-2 pb-12">
      <SearchPage onMovieSelect={onMovieSelect} onNavigate={onNavigate} />
    </div>
  </div>
);
