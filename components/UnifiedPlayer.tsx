import React, { useState, useEffect, useRef } from 'react';
import { useWatchHistory } from './useWatchHistory';
import { Settings, Check, Users, Download, ExternalLink, ThumbsUp, X } from 'lucide-react';
import { CommunityService, RequestReply } from '../lib/community';
import { TmdbService } from '../services/tmdb';
import { WatchPartyModal } from './WatchPartyModal';
import { StatsService } from '../services/stats';
import { ServerVotingModal } from './ServerVotingModal';
import { VIEW_SESSION_HEARTBEAT_SECONDS } from '../lib/sessionTracking';
import { DirectMediaPlayer } from './DirectMediaPlayer';
import { getProviderAdapter, PLAYER_PROVIDER_DEFAULTS, Provider, ProviderContext } from '../lib/playerProviders';
import { usePlayerProviders } from '../hooks/usePlayerProviders';

interface UnifiedPlayerProps {
    tmdbId: string;
    mediaType: 'movie' | 'tv';
    season?: number;
    episode?: number;
    title?: string;
    posterUrl?: string;
    voteAverage?: number;
    backdropUrl?: string;
    episodeImage?: string;
}

export type { Provider } from '../lib/playerProviders';
export const PROVIDERS = PLAYER_PROVIDER_DEFAULTS;

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
    const sessionIdRef = useRef<string>('');
    const providerAttemptIdRef = useRef<string>('');
    const providerAttemptStartedAtRef = useRef<number>(0);
    const providerAttemptFinishedRef = useRef(false);
    const providerReadyMarkedRef = useRef(false);
    const directVideoRef = useRef<HTMLVideoElement>(null);
    const { providers } = usePlayerProviders();

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
                const availableProvider = providers.find(p => p.id === vote.provider_id);
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
    }, [tmdbId, mediaType, season, episode, providers]);

    useEffect(() => {
        sessionIdRef.current = crypto.randomUUID();
    }, [tmdbId, mediaType, season, episode]);

    const providerContext: ProviderContext = {
        tmdbId,
        mediaType,
        season,
        episode,
    };

    const enabledProviders = providers.filter(item => item.enabled);
    const availableProviders = enabledProviders.length > 0 ? enabledProviders : PLAYER_PROVIDER_DEFAULTS;
    const currentProvider = getProviderAdapter(availableProviders, provider);
    const directSources = currentProvider.renderMode === 'direct'
        ? currentProvider.getDirectSources?.(providerContext) || []
        : [];
    const currentEmbedUrl = currentProvider.getEmbedUrl?.(providerContext) || '';
    const playbackTargetKey = `${currentProvider.id}:${tmdbId}:${mediaType}:${season}:${episode}`;

    useEffect(() => {
        if (!availableProviders.some(item => item.id === provider)) {
            setProvider(availableProviders[0].id);
        }
    }, [availableProviders, provider]);

    useEffect(() => {
        if (!import.meta.env.DEV) return;

        console.info('[UnifiedPlayer] Playback target', {
            provider: currentProvider.id,
            tmdbId,
            mediaType,
            season,
            episode,
            url: currentProvider.renderMode === 'direct'
                ? directSources[0]?.src || ''
                : currentEmbedUrl,
        });
    }, [currentProvider.id, currentProvider.renderMode, currentEmbedUrl, directSources, tmdbId, mediaType, season, episode]);

    const finishProviderAttempt = (reason: string) => {
        if (providerAttemptFinishedRef.current) return;
        providerAttemptFinishedRef.current = true;
        void StatsService.finishProviderAttempt(providerAttemptIdRef.current, reason);
    };

    useEffect(() => {
        providerAttemptIdRef.current = crypto.randomUUID();
        providerAttemptStartedAtRef.current = Date.now();
        providerAttemptFinishedRef.current = false;
        providerReadyMarkedRef.current = false;

        void StatsService.startProviderAttempt({
            attemptId: providerAttemptIdRef.current,
            sessionId: sessionIdRef.current,
            tmdbId,
            mediaType,
            season,
            episode,
            providerId: currentProvider.id,
        });

        const timeout = window.setTimeout(() => {
            if (!providerReadyMarkedRef.current) {
                finishProviderAttempt('no_ready_timeout');
            }
        }, 20000);

        return () => {
            window.clearTimeout(timeout);
            if (!providerAttemptFinishedRef.current) {
                finishProviderAttempt(
                    providerReadyMarkedRef.current ? 'provider_exit' : 'provider_exit_before_ready'
                );
            }
        };
    }, [tmdbId, mediaType, season, episode, currentProvider.id]);

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
    // Event Listener for PostMessage (P-Stream / Vidora)
    const [isProviderReady, setIsProviderReady] = useState(false);

    // Reset ready state whenever the playback target changes.
    useEffect(() => {
        setIsProviderReady(false);
    }, [provider, currentEmbedUrl, tmdbId, mediaType, season, episode]);

    const markProviderReady = () => {
        if (providerReadyMarkedRef.current) return;
        providerReadyMarkedRef.current = true;
        setIsProviderReady(true);
        void StatsService.markProviderAttemptReady(providerAttemptIdRef.current);
    };

    const handleProviderSwitch = (nextProviderId: Provider) => {
        if (nextProviderId === provider) {
            setShowServers(false);
            return;
        }

        const elapsed = Date.now() - providerAttemptStartedAtRef.current;
        finishProviderAttempt(elapsed < 45000 ? 'switched_provider_early' : 'switched_provider');
        setProvider(nextProviderId);
        setShowServers(false);
    };

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            let expectedOrigin: string | null = null;
            try {
                expectedOrigin = currentEmbedUrl ? new URL(currentEmbedUrl).origin : null;
            } catch {
                expectedOrigin = null;
            }

            const isTrustedSource = event.source === iframeRef.current?.contentWindow;
            const isTrustedOrigin = expectedOrigin !== null && event.origin === expectedOrigin;

            if (!isTrustedSource || !isTrustedOrigin) {
                return;
            }

            if (currentProvider.id === 'vidora' && event.data?.type === 'MEDIA_DATA') {
                // Provider is ready once we start getting data
                if (!isProviderReady) {
                    markProviderReady();
                }

                const { progress, duration } = event.data.data || {};
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
                        posterPath: posterUrl,
                        voteAverage,
                        backdropUrl: currentMovieBackdrop || backdropUrl,
                        episodeImage: currentEpisodeImage || episodeImage,
                        genres: genres.length > 0 ? genres : undefined
                    });
                    if (!providerAttemptFinishedRef.current) {
                        void StatsService.heartbeatProviderAttempt(providerAttemptIdRef.current, progress, 15);
                    }
                }
                return;
            }

            if (currentProvider.id === 'cinesrc') {
                const eventType = event.data?.type;

                if (eventType === 'cinesrc:error') {
                    finishProviderAttempt('media_error');
                    return;
                }

                if (eventType === 'cinesrc:ready' || eventType === 'cinesrc:play' || eventType === 'cinesrc:timeupdate') {
                    if (!isProviderReady) {
                        markProviderReady();
                    }
                }

                if (eventType === 'cinesrc:timeupdate' && typeof event.data?.currentTime === 'number') {
                    const progress = event.data.currentTime;
                    const duration = typeof event.data?.duration === 'number' ? event.data.duration : 0;

                    setLastTime(progress);
                    updateProgress({
                        tmdbId,
                        type: mediaType,
                        season,
                        episode,
                        time: progress,
                        duration,
                        lastUpdated: Date.now(),
                        provider: 'cinesrc',
                        title,
                        posterPath: posterUrl,
                        voteAverage,
                        backdropUrl: currentMovieBackdrop || backdropUrl,
                        episodeImage: currentEpisodeImage || episodeImage,
                        genres: genres.length > 0 ? genres : undefined
                    });
                    if (!providerAttemptFinishedRef.current) {
                        void StatsService.heartbeatProviderAttempt(providerAttemptIdRef.current, progress, 15);
                    }
                }
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [currentProvider.id, currentEmbedUrl, isProviderReady, tmdbId, mediaType, season, episode, title, posterUrl, voteAverage, backdropUrl, episodeImage, currentEpisodeImage, currentMovieBackdrop]);



    // Robust progress tracking - Polls actual video position
    useEffect(() => {
        let progressInterval: NodeJS.Timeout;
        let fallbackTime = 0; // Only used if we can't access video element

        const saveProgress = () => {
            let currentPosition = 0;
            let videoDuration = 0;

            if (currentProvider.renderMode === 'direct') {
                const videoElement = directVideoRef.current;
                if (videoElement) {
                    currentPosition = videoElement.currentTime || 0;
                    videoDuration = videoElement.duration || 0;
                }
            } else {
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
                    posterPath: posterUrl,
                    voteAverage,
                    year: new Date().getFullYear(),

                    backdropUrl: currentMovieBackdrop || backdropUrl,
                    episodeImage: currentEpisodeImage || episodeImage,
                    genres: genres.length > 0 ? genres : undefined
                });
            }

            if (!providerAttemptFinishedRef.current) {
                void StatsService.heartbeatProviderAttempt(providerAttemptIdRef.current, currentPosition > 0 ? currentPosition : undefined, 15);
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
    }, [tmdbId, mediaType, season, episode, provider, title, posterUrl, voteAverage, updateProgress, backdropUrl, episodeImage, currentEpisodeImage, currentMovieBackdrop, currentProvider.renderMode]);

    useEffect(() => {
        const heartbeat = () => {
            if (document.hidden || !document.hasFocus()) {
                return;
            }
            if (providerAttemptFinishedRef.current) {
                return;
            }

            void StatsService.trackViewSession({
                sessionId: sessionIdRef.current,
                tmdbId,
                mediaType,
                season,
                episode,
                providerId: provider,
                title,
                genres: genres.length > 0 ? genres : undefined,
            });
        };

        const interval = setInterval(heartbeat, VIEW_SESSION_HEARTBEAT_SECONDS * 1000);

        return () => {
            clearInterval(interval);
        };
    }, [tmdbId, mediaType, season, episode, provider, title, genres]);



    return (
        <div className="w-full h-full relative bg-black group">

            {currentProvider.renderMode === 'direct' ? (
                <DirectMediaPlayer
                    key={`${playbackTargetKey}:direct`}
                    sources={directSources}
                    title={`${title || tmdbId} - ${currentProvider.name}`}
                    videoRef={directVideoRef}
                    onReady={markProviderReady}
                    onError={() => {
                        finishProviderAttempt('media_error');
                    }}
                />
            ) : (
                <iframe
                    key={currentEmbedUrl || `${playbackTargetKey}:embed`}
                    ref={iframeRef}
                    src={currentEmbedUrl}
                    width="100%"
                    height="100%"
                    allowFullScreen
                    allow="fullscreen; encrypted-media; picture-in-picture"
                    className="w-full h-full border-none"
                    title={`Player - ${provider}`}
                    id="unified-iframe"
                    onLoad={markProviderReady}
                    referrerPolicy="no-referrer"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
                />
            )}





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

                    {/* Mobile Backdrop */}
                    {showCommunity && (
                        <div
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden animate-in fade-in duration-200"
                            onClick={() => setShowCommunity(false)}
                        />
                    )}

                    {showCommunity && (
                        <div className="fixed md:absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 md:translate-x-0 md:translate-y-0 md:left-auto md:top-full md:right-0 
                                            w-[90vw] md:w-80 mt-0 md:mt-2 bg-[#0f1014] md:bg-[#0f1014]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl 
                                            p-2 animate-in fade-in zoom-in-95 duration-200 max-h-[60vh] md:max-h-[400px] overflow-y-auto custom-scrollbar flex flex-col gap-2 z-[70] md:z-[60]">

                            {/* Mobile Header */}
                            <div className="flex items-center justify-between px-2 pt-2 pb-1 md:hidden">
                                <h3 className="text-white font-bold text-lg">Downloads</h3>
                                <button
                                    onClick={() => setShowCommunity(false)}
                                    className="p-1 text-zinc-400 hover:text-white bg-white/5 rounded-full"
                                >
                                    <X size={20} />
                                </button>
                            </div>

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
                            {availableProviders.map((p) => {
                                const isActive = provider === p.id;
                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => {
                                            handleProviderSwitch(p.id);
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
                                                {(p.tags?.[0] || p.renderMode === 'direct') && (
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold ${isActive
                                                        ? 'bg-black/10 text-black/70'
                                                        : (p.tags?.[0] || '').includes('Redirect') || (p.tags?.[0] || '').includes('Ads')
                                                            ? 'bg-red-500/20 text-red-400'
                                                            : p.renderMode === 'direct'
                                                                ? 'bg-green-500/20 text-green-400'
                                                            : 'bg-white/10 text-zinc-500'
                                                        }`}>
                                                        {(p.tags?.[0] || (p.renderMode === 'direct' ? 'Direct' : 'Embed')).replace('Redirect Issues', 'Redirects')}
                                                    </span>
                                                )}
                                            </div>
                                            <span className={`text-[10px] ${isActive ? 'text-black/60' : 'text-zinc-600'}`}>
                                                {p.bestFor}{p.renderMode === 'direct' ? ' · Direct playback' : ''}
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

            {/* Provider Watermark (Fades out) */}
            <div className="absolute bottom-6 right-6 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full text-[10px] text-white/30 uppercase tracking-widest pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                {currentProvider.name}
            </div>

            <ServerVotingModal
                isOpen={showVotingModal}
                onClose={() => setShowVotingModal(false)}
                tmdbId={tmdbId}
                mediaType={mediaType}
                season={season}
                episode={episode}
                currentProvider={provider}
                providers={availableProviders}
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
