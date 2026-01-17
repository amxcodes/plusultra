import React, { useState, useEffect, useRef } from 'react';
import { useWatchHistory } from './useWatchHistory';
import { useSkipData } from './useSkipData';
import { Settings, Check, Users, Download, ExternalLink, ThumbsUp } from 'lucide-react';
import { CommunityService, RequestReply } from '../lib/community';
import { TmdbService } from '../services/tmdb';
import { WatchPartyModal } from './WatchPartyModal';
import { StatsService } from '../services/stats';
import { ServerVotingModal } from './ServerVotingModal';

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

export type Provider = 'zxcplayer' | 'zxcembed' | 'cinemaos' | 'cinezo' | 'rive' | 'vidora' | 'aeon';

export const PROVIDERS: { id: Provider; name: string; hasEvents: boolean; tags?: string[]; bestFor?: string }[] = [
    // ZXCStream variants (Best - No redirects)
    { id: 'zxcplayer', name: 'Server 1', hasEvents: false, tags: ['Fast', 'No Ads'], bestFor: 'Best Quality' },
    { id: 'zxcembed', name: 'Server 2', hasEvents: false, tags: ['Fast', 'No Ads'], bestFor: 'Alternative Player' },

    // Premium servers (Clean)
    { id: 'cinemaos', name: 'Server 3', hasEvents: false, tags: ['Reliable'], bestFor: 'Backup' },
    { id: 'aeon', name: 'Server 4', hasEvents: false, tags: ['Reliable'], bestFor: 'Backup' },
    { id: 'cinezo', name: 'Server 5', hasEvents: false, tags: ['Reliable'], bestFor: 'Backup' },

    // Premium servers with redirect issues (Moved down)
    { id: 'rive', name: 'Server 6', hasEvents: false, tags: ['Redirects'], bestFor: 'All Content' },
    { id: 'vidora', name: 'Server 7', hasEvents: true, tags: ['Redirects'], bestFor: 'All Content' },
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
    // ... existing state ...

    // ... inside component
    const [provider, setProvider] = useState<Provider>('zxcplayer');
    const [lastTime, setLastTime] = useState(0);
    const [showServers, setShowServers] = useState(false);
    const [showCommunity, setShowCommunity] = useState(false);
    const [communityLinks, setCommunityLinks] = useState<RequestReply[]>([]);

    // ... rest state

    // Fetch Community Links
    useEffect(() => {
        const fetchLinks = async () => {
            try {
                const links = await CommunityService.getLinksForMovie(tmdbId);
                setCommunityLinks(links);
            } catch (e) {
                console.error("Failed to load community links", e);
            }
        };
        if (tmdbId) fetchLinks();
    }, [tmdbId, showCommunity]); // Refresh when menu opens to get latest upvotes? Or just once. Added showCommunity to refresh on open.

    const handleVote = async (replyId: string, vote: 1 | -1) => {
        try {
            await CommunityService.voteReply(replyId, vote);
            // Optimistic update logic could go here, or just re-fetch
            const links = await CommunityService.getLinksForMovie(tmdbId);
            setCommunityLinks(links);
        } catch (e) {
            console.error("Failed to vote", e);
        }
    };
    const [showWatchPartyModal, setShowWatchPartyModal] = useState(false);
    const [showVotingModal, setShowVotingModal] = useState(false);
    const [genres, setGenres] = useState<string[]>([]);

    // Fetch genres from TMDB for stats tracking
    useEffect(() => {
        const fetchGenres = async () => {
            try {
                const details = await TmdbService.getDetails(tmdbId, mediaType);
                if (details.genre && Array.isArray(details.genre)) {
                    setGenres(details.genre);
                }
            } catch (err) {
                console.error('[Genres] Failed to fetch:', err);
            }
        };
        fetchGenres();
    }, [tmdbId, mediaType]);

    // Auto-Connect to Best Server & Voting Timer
    useEffect(() => {
        // 1. Try to connect to best-voted server
        StatsService.getBestServer(tmdbId, mediaType, season, episode).then(vote => {
            if (vote && vote.vote_count > 5) { // Threshold to prevent fluctuation from low votes
                const availableProvider = PROVIDERS.find(p => p.id === vote.provider_id);
                if (availableProvider) {
                    setProvider(availableProvider.id);
                }
            }
        });

        // 2. Voting Prompt Timer (15 minutes)
        const checkVote = localStorage.getItem(`voted_${tmdbId}_${mediaType}_${season}_${episode}`);
        if (!checkVote) {
            const timer = setTimeout(() => {
                setShowVotingModal(true);
            }, 1000 * 60 * 15); // 15 Minutes
            return () => clearTimeout(timer);
        }
    }, [tmdbId, mediaType, season, episode]);

    const { updateProgress } = useWatchHistory();
    const { skipData } = useSkipData(title, season, episode);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Fetch specific episode image (screenshot) if TV
    const [currentEpisodeImage, setCurrentEpisodeImage] = useState<string>(episodeImage || '');
    // Fetch specific backdrop if Movie (sometimes we only get posterUrl passed in)
    const [currentMovieBackdrop, setCurrentMovieBackdrop] = useState<string>(backdropUrl || '');

    useEffect(() => {
        if (mediaType === 'tv' && season && episode) {
            TmdbService.getEpisodeDetails(tmdbId, season, episode).then(details => {
                if (details?.still_path) {
                    setCurrentEpisodeImage(details.still_path);
                }
            });
        }
        if (mediaType === 'movie') {
            TmdbService.getDetails(tmdbId, 'movie').then(details => {
                // If we get a good backdrop, use it (sometimes passed backdropUrl is actually a poster fallback)
                // TmdbService.getDetails.backdropUrl is a full URL.
                if (details?.backdropUrl) {
                    setCurrentMovieBackdrop(details.backdropUrl);
                } else if (details?.screenshots && details.screenshots.length > 0) {
                    // Fallback to screenshots array if available
                    setCurrentMovieBackdrop(`https://image.tmdb.org/t/p/original${details.screenshots[0]}`);
                }
            });
        }
    }, [tmdbId, mediaType, season, episode]);





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
            // ZXCStream variants (Best quality, no redirects)
            case 'zxcplayer':
                if (mediaType === 'movie') {
                    return `https://zxcstream.xyz/player/movie/${tmdbId}/en?autoplay=false&back=true&server=0`;
                }
                return `https://zxcstream.xyz/player/tv/${tmdbId}/${season}/${episode}/en?autoplay=false&back=true&server=0`;

            case 'zxcembed':
                if (mediaType === 'movie') {
                    return `https://zxcstream.xyz/embed/movie/${tmdbId}`;
                }
                return `https://zxcstream.xyz/embed/tv/${tmdbId}/${season}/${episode}`;

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

                            backdropUrl: currentMovieBackdrop || backdropUrl,
                            episodeImage: currentEpisodeImage || episodeImage,
                            genres: genres.length > 0 ? genres : undefined
                        });


                    }
                }
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [provider, tmdbId, mediaType, season, episode, title, posterUrl, voteAverage, backdropUrl, episodeImage, currentEpisodeImage, currentMovieBackdrop]);



    // Robust progress tracking - Polls actual video position
    useEffect(() => {
        let progressInterval: NodeJS.Timeout;
        let fallbackTime = 0; // Only used if we can't access video element

        const saveProgress = () => {
            let currentPosition = 0;
            let videoDuration = 0;

            // Try to access the actual video element in iframe
            try {
                const iframe = iframeRef.current;
                if (iframe && iframe.contentDocument) {
                    const videoElement = iframe.contentDocument.querySelector('video');
                    if (videoElement) {
                        // SUCCESS: Got real video position!
                        currentPosition = videoElement.currentTime || 0;
                        videoDuration = videoElement.duration || 0;
                        console.log(`[Progress] Real position: ${Math.round(currentPosition)}s / ${Math.round(videoDuration)}s`);
                    } else {
                        // No video element found, use fallback
                        fallbackTime += 30;
                        currentPosition = fallbackTime;
                        console.log(`[Progress] Fallback timer: ${fallbackTime}s`);
                    }
                } else {
                    // Can't access iframe (cross-origin), use fallback
                    fallbackTime += 30;
                    currentPosition = fallbackTime;
                }
            } catch (error) {
                // Cross-origin error, use fallback
                fallbackTime += 30;
                currentPosition = fallbackTime;
            }

            // Only save if we have meaningful progress (>10s)
            if (currentPosition >= 10) {
                updateProgress({
                    tmdbId,
                    type: mediaType,
                    season,
                    episode,
                    time: currentPosition,
                    duration: videoDuration, // Will be 0 for servers without access
                    lastUpdated: Date.now(),
                    provider,
                    title,
                    posterUrl,
                    voteAverage,
                    year: new Date().getFullYear(),

                    backdropUrl: currentMovieBackdrop || backdropUrl,
                    episodeImage: currentEpisodeImage || episodeImage,
                    genres: genres.length > 0 ? genres : undefined
                });
            }
        };

        progressInterval = setInterval(saveProgress, 15000); // Poll every 15 seconds (reduced from 30s)

        return () => {
            if (progressInterval) {
                clearInterval(progressInterval);
            }
            // Don't call saveProgress() here - it triggers setState during unmount!
            // Progress will be auto-saved to localStorage by useWatchHistory cleanup
        };
    }, [tmdbId, mediaType, season, episode, provider, title, posterUrl, voteAverage, updateProgress, backdropUrl, episodeImage, currentEpisodeImage, currentMovieBackdrop]);


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

                {/* Community / Downloads Button */}
                <div className="relative">
                    <button
                        onClick={() => setShowCommunity(!showCommunity)}
                        className={`flex items-center gap-2 p-2 md:px-4 md:py-2 rounded-full border border-white/10 backdrop-blur-md transition-all
                        ${showCommunity ? 'bg-white text-black' : 'bg-black/50 text-white hover:bg-white/20'}`}
                    >
                        <Download size={16} />
                        <span className="text-sm font-medium hidden md:inline">Downloads</span>
                        {communityLinks.length > 0 && (
                            <span className={`text-[10px] font-bold px-1.5 rounded-full ${showCommunity ? 'bg-black/10 text-black' : 'bg-white/20 text-white'}`}>
                                {communityLinks.length}
                            </span>
                        )}
                    </button>

                    {showCommunity && (
                        <div className="absolute right-0 top-full mt-2 w-80 bg-[#0f1014]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-200 max-h-[400px] overflow-y-auto custom-scrollbar flex flex-col gap-2 z-[60]">
                            {communityLinks.length === 0 ? (
                                <div className="text-center py-8 px-4">
                                    <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-2 text-zinc-600">
                                        <Download size={20} />
                                    </div>
                                    <p className="text-sm text-zinc-400">No community links yet.</p>
                                    <p className="text-xs text-zinc-600 mt-1">Request this movie on the Requests page!</p>
                                </div>
                            ) : (
                                communityLinks.map(link => (
                                    <div key={link.id} className="bg-white/5 rounded-xl p-3 border border-white/5 hover:border-white/10 transition-colors group">
                                        <div className="flex items-start justify-between gap-3 mb-2">
                                            <div className="flex flex-col gap-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <LinkTypeBadge type={link.link_type} />
                                                    <span className="text-xs text-zinc-500">{new Date(link.created_at).toLocaleDateString()}</span>
                                                </div>
                                                {link.instructions && (
                                                    <p className="text-xs text-zinc-400 line-clamp-2 mt-1 italic">"{link.instructions}"</p>
                                                )}
                                            </div>
                                            <div className="flex flex-col items-center gap-1">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleVote(link.id, 1);
                                                    }}
                                                    className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors ${link.user_vote === 1 ? 'text-green-400 bg-green-400/10' : 'text-zinc-500'}`}
                                                >
                                                    <ThumbsUp size={14} />
                                                </button>
                                                <span className="text-[10px] font-bold text-zinc-500">{link.upvotes}</span>
                                            </div>
                                        </div>

                                        <a
                                            href={link.content}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white text-white hover:text-black py-2 rounded-lg text-xs font-bold transition-colors"
                                        >
                                            <ExternalLink size={12} />
                                            Open Link
                                        </a>
                                    </div>
                                ))
                            )}
                            <div className="mt-2 pt-2 border-t border-white/5 text-center">
                                <p className="text-[10px] text-zinc-600">Links are community submitted. Use with caution.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Watch Together Button - Synclify Redirect */}
                <button
                    onClick={() => setShowWatchPartyModal(true)}
                    className="flex items-center gap-2 p-2 md:px-4 md:py-2 rounded-full border border-white/10 backdrop-blur-md transition-all bg-black/50 text-white hover:bg-white/20"
                >
                    <Users size={16} />
                    <span className="text-sm font-medium hidden md:inline">Watch Together</span>
                </button>

                <div className="relative" id="server-menu">
                    <button
                        onClick={() => setShowServers(!showServers)}
                        className={`flex items-center gap-2 p-2 md:px-4 md:py-2 rounded-full border border-white/10 backdrop-blur-md transition-all
                        ${showServers ? 'bg-white text-black' : 'bg-black/50 text-white hover:bg-white/20'}`}
                    >
                        <Settings size={16} />
                        <span className="text-sm font-medium hidden md:inline">Servers</span>
                    </button>

                    {showServers && (
                        <div className="absolute right-0 top-full mt-2 w-64 md:w-72 bg-[#0f1014]/90 backdrop-blur-2xl border border-white/5 rounded-2xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-200 max-h-[400px] overflow-y-auto custom-scrollbar flex flex-col gap-1">
                            {PROVIDERS.map((p) => {
                                const isActive = provider === p.id;
                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => {
                                            setProvider(p.id);
                                            setShowServers(false);
                                        }}
                                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all border border-transparent
                                        ${isActive
                                                ? 'bg-white text-black shadow-lg shadow-white/10'
                                                : 'text-zinc-400 hover:bg-white/5 hover:border-white/5 hover:text-white'}`}
                                    >
                                        <div className="flex flex-col gap-0.5 items-start">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm font-bold ${isActive ? 'text-black' : 'text-zinc-200'}`}>
                                                    {p.name}
                                                </span>
                                                {p.tags && p.tags[0] && (
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold ${isActive
                                                        ? 'bg-black/10 text-black/70'
                                                        : p.tags[0].includes('Redirect') || p.tags[0].includes('Ads')
                                                            ? 'bg-red-500/20 text-red-400'
                                                            : 'bg-white/10 text-zinc-500'
                                                        }`}>
                                                        {p.tags[0].replace('Redirect Issues', 'Redirects')}
                                                    </span>
                                                )}
                                            </div>
                                            <span className={`text-[10px] ${isActive ? 'text-black/60' : 'text-zinc-600'}`}>
                                                {p.bestFor}
                                            </span>
                                        </div>

                                        {isActive && <div className="bg-black text-white rounded-full p-0.5"><Check size={10} /></div>}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {showWatchPartyModal && (
                <WatchPartyModal isOpen={true} onClose={() => setShowWatchPartyModal(false)} />
            )}

            {/* Skip Intro Button */}
            {showSkipIntro && (
                <button
                    className="absolute bottom-20 right-4 md:bottom-24 md:right-8 px-4 py-2 md:px-6 md:py-2 bg-white text-black text-sm md:text-base font-bold rounded-full shadow-lg 
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

            <ServerVotingModal
                isOpen={showVotingModal}
                onClose={() => setShowVotingModal(false)}
                tmdbId={tmdbId}
                mediaType={mediaType}
                season={season}
                episode={episode}
                currentProvider={provider}
            />

        </div>
    );
};

// --- Helper Icon for Badges ---
const LinkTypeBadge: React.FC<{ type: string }> = ({ type }) => {
    const colors: Record<string, string> = {
        gdrive: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        mega: 'bg-red-500/20 text-red-400 border-red-500/30',
        magnet: 'bg-green-500/20 text-green-400 border-green-500/30',
        stream: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        other: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
    };

    return (
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${colors[type] || colors.other}`}>
            {type}
        </span>
    );
};
