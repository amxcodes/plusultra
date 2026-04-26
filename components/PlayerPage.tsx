
import React from 'react';
import { UnifiedPlayer } from './UnifiedPlayer';
import { ChevronLeft } from 'lucide-react';
import { Movie } from '../types';
import { DirectMediaPlayer } from './DirectMediaPlayer';

interface PlayerPageProps {
    movie: Movie;
    season?: number;
    episode?: number;
    onBack: () => void;
    onPlayEpisode?: (season: number, episode: number) => void;
    offlinePlaybackUrl?: string | null;
}

export const PlayerPage: React.FC<PlayerPageProps> = ({ movie, season = 1, episode = 1, onBack, onPlayEpisode, offlinePlaybackUrl = null }) => {
    return (
        <div className="fixed inset-0 z-[100] bg-black animate-in fade-in duration-500">
            {/* Back Button */}
            {/* Back Button */}
            <button
                onClick={onBack}
                className="absolute top-4 left-4 md:top-6 md:left-6 z-[110] flex items-center gap-2 p-2 md:px-4 md:py-2 rounded-full bg-black/50 hover:bg-white/10 text-white backdrop-blur-md border border-white/10 transition-all group"
            >
                <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                <span className="font-medium hidden md:inline">Exit Player</span>
            </button>

            {/* Player Container */}
            <div className="w-full h-full flex items-center justify-center">
                <div className="w-full h-full">
                    {offlinePlaybackUrl ? (
                        <DirectMediaPlayer
                            sources={[{ src: offlinePlaybackUrl }]}
                            title={`${movie.title} - Offline`}
                        />
                    ) : (
                        <UnifiedPlayer
                            tmdbId={movie.id.toString()}
                            mediaType={movie.mediaType || "movie"}
                            season={season}
                            episode={episode}
                            onPlayEpisode={onPlayEpisode}
                            title={movie.title}
                            posterUrl={movie.imageUrl}
                            voteAverage={movie.match / 10}
                            backdropUrl={movie.backdropUrl || movie.imageUrl}
                            description={movie.description}
                            year={movie.year}
                            genre={movie.genre}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
