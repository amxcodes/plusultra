
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
    const getOfflineStorageKey = (targetUrl: string) => {
        try {
            const pathname = new URL(targetUrl).pathname;
            const downloadId = pathname.split('/').filter(Boolean).pop();
            return downloadId ? `amx_offline_resume:${downloadId}` : `amx_offline_resume:${targetUrl}`;
        } catch {
            return `amx_offline_resume:${targetUrl}`;
        }
    };

    const offlineSubtitle = movie.mediaType === 'tv'
        ? `Offline playback for S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`
        : 'Offline playback saved on this device';

    return (
        <div className="fixed inset-0 z-[100] bg-black animate-in fade-in duration-500">
            {/* Back Button */}
            <button
                onClick={onBack}
                className="absolute left-1/2 top-0 z-[120] flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-b-2xl border border-t-0 border-white/10 bg-black/54 px-3 text-xs font-semibold text-white/78 shadow-[0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Exit player"
            >
                <ChevronLeft size={15} />
                Exit
            </button>

            {/* Player Container */}
            <div className="w-full h-full flex items-center justify-center">
                <div className="w-full h-full">
                    {offlinePlaybackUrl ? (
                        <DirectMediaPlayer
                            sources={[{ src: offlinePlaybackUrl }]}
                            title={`${movie.title} - Offline`}
                            badge="Offline Ready"
                            subtitle={offlineSubtitle}
                            progressContext={{
                                storageKey: getOfflineStorageKey(offlinePlaybackUrl),
                                tmdbId: movie.id.toString(),
                                mediaType: movie.mediaType || 'movie',
                                season,
                                episode,
                                provider: 'offline',
                                progressSource: 'direct_exact',
                                title: movie.title,
                                posterUrl: movie.imageUrl,
                                backdropUrl: movie.backdropUrl || movie.imageUrl,
                                year: movie.year,
                                genres: movie.genre,
                                voteAverage: movie.match / 10,
                            }}
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
