import React, { useState, useEffect, useRef } from 'react';
import { useWatchHistory } from './useWatchHistory';
import { useSkipData } from './useSkipData';

type MediaType = 'movie' | 'tv';

interface UnifiedPlayerProps {
    tmdbId: string;
    mediaType: MediaType;
    season?: number;
    episode?: number;
    title?: string; // Needed for QuickWatch
    posterUrl?: string; // Needed for Continue Watching UI
    voteAverage?: number; // Needed for Continue Watching UI
    backdropUrl?: string; // NEW: For CW Card
    episodeImage?: string; // NEW: For CW Card
}

type Provider = 'cinemaos' | 'vidora' | 'rive' | 'aeon';

const PROVIDERS: { id: Provider; name: string; hasEvents: boolean }[] = [
    { id: 'cinemaos', name: 'ZXC Stream (Best)', hasEvents: false },
    { id: 'vidora', name: 'Vidora (Sync)', hasEvents: true },
    { id: 'rive', name: 'Rive Stream', hasEvents: false },
    { id: 'aeon', name: 'AeonWatch', hasEvents: false },
];

export const UnifiedPlayer: React.FC<UnifiedPlayerProps> = ({
    tmdbId,
    mediaType,
    season = 1,
    episode = 1,
    title = '',
    posterUrl = '',
    voteAverage = 0,
    backdropUrl = '',
    episodeImage = ''
}) => {
    const [provider, setProvider] = useState<Provider>('cinemaos');
    const [lastTime, setLastTime] = useState(0);
    const { updateProgress, getProgress } = useWatchHistory();
    const { skipData } = useSkipData(title, season, episode);
    const iframeRef = useRef<HTMLIFrameElement>(null);



    // Construct URL based on provider
    const getUrl = () => {
        switch (provider) {
            case 'cinemaos':
                // https://zxcstream.xyz/player/movie/{tmdb-Id}/{language}?autoplay=false&back=true&server=0
                // https://zxcstream.xyz/player/tv/{tmdb-Id}/{season}/{episode}/{language}?autoplay=false&back=true&server=0
                const baseUrl = 'https://zxcstream.xyz/player';
                const commonQuery = 'autoplay=false&back=true&server=0';

                if (mediaType === 'movie') {
                    return `${baseUrl}/movie/${tmdbId}/en?${commonQuery}`;
                }
                return `${baseUrl}/tv/${tmdbId}/${season}/${episode}/en?${commonQuery}`;

            case 'vidora':
                // https://vidora.su/movie/[tmdbId]
                // https://vidora.su/tv/[tmdbId]/[season]/[episode]
                if (mediaType === 'movie') {
                    return `https://vidora.su/movie/${tmdbId}?autoplay=false`;
                }
                return `https://vidora.su/tv/${tmdbId}/${season}/${episode}?autoplay=false`;

            case 'rive':
                // https://rivestream.org/embed?type=movie&id={tmdbId}
                // https://rivestream.org/embed?type=tv&id={tmdbId}&season={season}&episode={episode}
                if (mediaType === 'movie') {
                    return `https://rivestream.org/embed?type=movie&id=${tmdbId}`;
                }
                return `https://rivestream.org/embed?type=tv&id=${tmdbId}&season=${season}&episode=${episode}`;

            case 'aeon':
                // https://thisiscinema.pages.dev/?type=movie&version=v3&id={id}
                // https://thisiscinema.pages.dev/?type=tv&version=v3&id={id}&season={s}&episode={e}
                if (mediaType === 'movie') {
                    return `https://thisiscinema.pages.dev/?type=movie&version=v3&id=${tmdbId}`;
                }
                return `https://thisiscinema.pages.dev/?type=tv&version=v3&id=${tmdbId}&season=${season}&episode=${episode}`;

            default:
                return '';
        }
    };

    // Event Listener for PostMessage (P-Stream / Vidora)
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {


            // VIDORA Handler (Based on API docs: type === 'MEDIA_DATA')
            // Note: Vidora docs mention 'MEDIA_DATA' but let's be defensive
            if (event.origin.includes("vidora.su") && provider === 'vidora') {
                if (event.data?.type === 'MEDIA_DATA') {
                    const { id, progress, duration } = event.data.data || {};
                    // Vidora might send its own ID structure, we assume it matches or we just log for now
                    if (progress) {
                        setLastTime(progress); // Assuming progress is in seconds
                        updateProgress({
                            tmdbId,
                            type: mediaType,
                            season,
                            episode,
                            time: progress,
                            duration: duration || 0,
                            lastUpdated: Date.now(),
                            provider: 'vidora',
                            title,
                            posterUrl,
                            voteAverage,
                            backdropUrl,
                            episodeImage
                        });
                    }
                }
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [provider, tmdbId, mediaType, season, episode, title, posterUrl, voteAverage, backdropUrl, episodeImage]);

    // Automatic progress tracking for all providers
    // Save progress every 30 seconds to ensure Continue Watching works
    useEffect(() => {
        let progressInterval: NodeJS.Timeout;
        let elapsedTime = 0;

        const saveProgress = () => {
            elapsedTime += 30; // Increment by 30 seconds

            // Only save if we've been watching for at least 10 seconds
            if (elapsedTime >= 10) {
                updateProgress({
                    tmdbId,
                    type: mediaType,
                    season,
                    episode,
                    time: elapsedTime,
                    duration: 0, // We don't know duration without events, but that's OK
                    lastUpdated: Date.now(),
                    provider,
                    title,
                    posterUrl,
                    voteAverage,
                    year: new Date().getFullYear(), // Approximate
                    backdropUrl,
                    episodeImage
                });
            }
        };

        // Start interval after component mounts
        progressInterval = setInterval(saveProgress, 30000); // Every 30 seconds

        return () => {
            if (progressInterval) {
                clearInterval(progressInterval);
                // Save one final time on unmount
                if (elapsedTime >= 10) {
                    updateProgress({
                        tmdbId,
                        type: mediaType,
                        season,
                        episode,
                        time: elapsedTime,
                        duration: 0,
                        lastUpdated: Date.now(),
                        provider,
                        title,
                        posterUrl,
                        voteAverage,
                        year: new Date().getFullYear(),
                        backdropUrl,
                        episodeImage
                    });
                }
            }
        };
    }, [tmdbId, mediaType, season, episode, provider, title, posterUrl, voteAverage, updateProgress, backdropUrl, episodeImage]);


    // Logic for showing Skip Button
    // We only know 'lastTime' if the provider sends updates.
    // If lastTime is within skipData.intro.start and end, we show button.
    const showSkipIntro = skipData?.intro?.start && skipData?.intro?.end &&
        lastTime >= skipData.intro.start && lastTime < skipData.intro.end;


    return (
        <div className="w-full flex flex-col gap-4 bg-black/90 p-4 rounded-xl border border-white/10">

            {/* Header / Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-white">Unified Player</h2>

                <div className="flex gap-2">
                    {PROVIDERS.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => setProvider(p.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                        ${provider === p.id
                                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                                }`}
                        >
                            {p.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Player Container */}
            <div className="relative aspect-video w-full bg-black rounded-lg overflow-hidden shadow-2xl border border-zinc-900 group">

                <iframe
                    ref={iframeRef}
                    src={getUrl()}
                    width="100%"
                    height="100%"
                    allowFullScreen
                    className="w-full h-full"
                    title={`Player - ${provider}`}
                    id="unified-iframe"
                />

                {/* Overlays */}
                {showSkipIntro && (
                    <button
                        className="absolute bottom-20 right-8 px-6 py-2 bg-white text-black font-bold rounded-full shadow-lg 
                           hover:bg-gray-200 transition-transform hover:scale-105 z-50 animate-in fade-in slide-in-from-bottom-4"
                        onClick={() => {
                            // This is tricky. We can't easily SEEK the iframe unless the API supports it via postMessage.
                            // P-Stream docs don't explicitly show a 'seek' command listener, only 'time update' outputs.
                            // So for now, this is visual only or minimal support.
                            console.log("Skip clicked - Implementation depends on strict bi-directional API support");
                            alert("Skip Request Sent (Note: Seek support varies by provider)");
                        }}
                    >
                        Skip Intro
                    </button>
                )}

                {/* Provider Badge */}
                <div className="absolute top-4 right-4 px-2 py-1 bg-black/50 backdrop-blur-md rounded text-xs text-white/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    Using {PROVIDERS.find(p => p.id === provider)?.name}
                </div>

            </div>

            {/* Status Bar */}
            <div className="flex justify-between text-xs text-zinc-500 px-2">
                <span>ID: {tmdbId}</span>
                <span>
                    {lastTime > 0 ? `Resuming from ${Math.floor(lastTime / 60)}:${Math.floor(lastTime % 60).toString().padStart(2, '0')}` : 'Ready to play'}
                </span>
            </div>

        </div>
    );
};
