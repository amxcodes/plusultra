
import React, { useState, useEffect, useRef } from 'react';
import { useWatchHistory } from './useWatchHistory';
import { useSkipData } from './useSkipData';
import { Settings, Check, Users } from 'lucide-react';

type MediaType = 'movie' | 'tv';

interface UnifiedPlayerProps {
    tmdbId: string;
    mediaType: MediaType;
    season?: number;
    episode?: number;
    title?: string;
    posterUrl?: string;
    voteAverage?: number;
    backdropUrl?: string;
    episodeImage?: string;
    autoJoinCode?: string;
}

type Provider = 'cinemaos' | 'vidora' | 'rive' | 'aeon' | 'cinezo';

const PROVIDERS: { id: Provider; name: string; hasEvents: boolean }[] = [
    { id: 'cinemaos', name: 'Server 1 (Best)', hasEvents: false },
    { id: 'vidora', name: 'Server 2 (Backup)', hasEvents: true },
    { id: 'rive', name: 'Server 3', hasEvents: false },
    { id: 'aeon', name: 'Server 4', hasEvents: false },
    { id: 'cinezo', name: 'Server 5', hasEvents: false },
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
    episodeImage = '',
    autoJoinCode
}) => {
    // ... existing state ...
    const [provider, setProvider] = useState<Provider>('cinemaos');
    const [lastTime, setLastTime] = useState(0);
    const [showServers, setShowServers] = useState(false);
    const { updateProgress } = useWatchHistory();
    const { skipData } = useSkipData(title, season, episode);
    const iframeRef = useRef<HTMLIFrameElement>(null);





    // Close server menu on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (showServers && !(e.target as Element).closest('#server-menu')) {
                setShowServers(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showServers]);




    // Construct URL based on provider
    const getUrl = () => {
        switch (provider) {
            case 'cinemaos':
                const baseUrl = 'https://zxcstream.xyz/player';
                const commonQuery = 'autoplay=false&back=true&server=0';
                if (mediaType === 'movie') {
                    return `${baseUrl}/movie/${tmdbId}/en?${commonQuery}`;
                }
                return `${baseUrl}/tv/${tmdbId}/${season}/${episode}/en?${commonQuery}`;

            case 'vidora':
                if (mediaType === 'movie') {
                    return `https://vidora.su/movie/${tmdbId}?autoplay=false`;
                }
                return `https://vidora.su/tv/${tmdbId}/${season}/${episode}?autoplay=false`;

            case 'rive':
                if (mediaType === 'movie') {
                    return `https://rivestream.org/embed?type=movie&id=${tmdbId}`;
                }
                return `https://rivestream.org/embed?type=tv&id=${tmdbId}&season=${season}&episode=${episode}`;

            case 'aeon':
                if (mediaType === 'movie') {
                    return `https://thisiscinema.pages.dev/?type=movie&version=v3&id=${tmdbId}`;
                }
                return `https://thisiscinema.pages.dev/?type=tv&version=v3&id=${tmdbId}&season=${season}&episode=${episode}`;

            case 'cinezo':
                if (mediaType === 'movie') {
                    return `https://api.cinezo.net/embed/tmdb-movie-${tmdbId}`;
                }
                return `https://api.cinezo.net/embed/tmdb-tv-${tmdbId}/${season}/${episode}`;

            default:
                return '';
        }
    };

    // Event Listener for PostMessage (P-Stream / Vidora)
    const [isProviderReady, setIsProviderReady] = useState(false);

    // Reset ready state when provider changes
    useEffect(() => {
        setIsProviderReady(false);
    }, [provider]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.origin.includes("vidora.su") && provider === 'vidora') {
                if (event.data?.type === 'MEDIA_DATA') {
                    // Provider is ready once we start getting data
                    if (!isProviderReady) setIsProviderReady(true);

                    const { progress, duration, isPlaying } = event.data.data || {};
                    if (progress) {
                        setLastTime(progress);
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



    // Automatic progress tracking
    useEffect(() => {
        let progressInterval: NodeJS.Timeout;
        let elapsedTime = 0;

        const saveProgress = () => {
            elapsedTime += 30;
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
        };

        progressInterval = setInterval(saveProgress, 30000);

        return () => {
            if (progressInterval) {
                clearInterval(progressInterval);
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


    const showSkipIntro = skipData?.intro?.start && skipData?.intro?.end &&
        lastTime >= skipData.intro.start && lastTime < skipData.intro.end;


    return (
        <div className="w-full h-full relative bg-black group">

            {/* Iframe spans entire container */}
            <iframe
                ref={iframeRef}
                src={getUrl()}
                width="100%"
                height="100%"
                allowFullScreen
                className="w-full h-full border-none"
                title={`Player - ${provider}`}
                id="unified-iframe"
            />





            {/* Controls Overlay (Top Right) */}
            <div className="absolute top-6 right-6 z-50 flex gap-4">
                {/* Watch Together Button - Synclify Redirect */}
                <a
                    href="https://synclify.party"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md transition-all bg-black/50 text-white hover:bg-white/20"
                >
                    <Users size={16} />
                    <span className="text-sm font-medium">Watch Together</span>
                </a>

                <div className="relative" id="server-menu">
                    <button
                        onClick={() => setShowServers(!showServers)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md transition-all
                        ${showServers ? 'bg-white text-black' : 'bg-black/50 text-white hover:bg-white/20'}`}
                    >
                        <Settings size={16} />
                        <span className="text-sm font-medium">Servers</span>
                    </button>

                    {showServers && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-[#0f1014] border border-white/10 rounded-xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-200">
                            {PROVIDERS.map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => {
                                        setProvider(p.id);
                                        setShowServers(false);

                                    }}
                                    className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center justify-between group/item transition-colors
                                    ${provider === p.id
                                            ? 'bg-white text-black'
                                            : 'text-zinc-400 hover:bg-white/10 hover:text-white'}`}
                                >
                                    {p.name}
                                    {provider === p.id && <Check size={14} />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Skip Intro Button */}
            {showSkipIntro && (
                <button
                    className="absolute bottom-24 right-8 px-6 py-2 bg-white text-black font-bold rounded-full shadow-lg 
                            hover:bg-gray-200 transition-transform hover:scale-105 z-50 animate-in fade-in slide-in-from-bottom-4"
                    onClick={() => {
                        console.log("Skip clicked");
                    }}
                >
                    Skip Intro
                </button>
            )}



            {/* Provider Watermark (Fades out) */}
            <div className="absolute bottom-6 right-6 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full text-[10px] text-white/30 uppercase tracking-widest pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                {PROVIDERS.find(p => p.id === provider)?.name}
            </div>

        </div>
    );
};
