import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useWatchHistory } from './useWatchHistory';
import { Settings, Check, Download, ExternalLink, ThumbsUp, X, SkipForward, Maximize2, PictureInPicture2 } from 'lucide-react';
import { CommunityService, RequestReply } from '../lib/community';
import { TmdbService } from '../services/tmdb';
import { StatsService } from '../services/stats';
import { ServerVotingModal } from './ServerVotingModal';
import { VIEW_SESSION_HEARTBEAT_SECONDS } from '../lib/sessionTracking';
import { DirectMediaPlayer } from './DirectMediaPlayer';
import { getProviderAdapter, PLAYER_PROVIDER_DEFAULTS, PlayerProviderAdapter, Provider, ProviderContext } from '../lib/playerProviders';
import { usePlayerProviders } from '../hooks/usePlayerProviders';
import { StreamDownloadPanel } from './StreamDownloadPanel';
import { getTrackingContext } from '../lib/activityTracking';
import { useAuth } from '../lib/AuthContext';
import { withTrustedPopup } from '../lib/popupGuard';
import { getUiPreferences, subscribeToUiPreferences, UiPreferences } from '../lib/uiPreferences';

interface UnifiedPlayerProps {
    tmdbId: string;
    mediaType: 'movie' | 'tv';
    season?: number;
    episode?: number;
    onPlayEpisode?: (season: number, episode: number) => void;
    title?: string;
    posterUrl?: string;
    voteAverage?: number;
    backdropUrl?: string;
    episodeImage?: string;
    description?: string;
    year?: number;
    genre?: string[];
}

export type { Provider } from '../lib/playerProviders';
export const PROVIDERS = PLAYER_PROVIDER_DEFAULTS;

const SERVER_FRUITS = [
    '\u{1F347}',
    '\u{1FAD0}',
    '\u{1F352}',
    '\u{1FAD1}',
    '\u{1F349}',
    '\u{1FAD0}',
    '\u{1F353}',
    '\u{1FAD2}',
    '\u{1F34E}',
    '\u{1F95D}',
    '\u{1F965}',
    '\u{1F34D}',
    '\u{1F34A}',
    '\u{1F350}',
    '\u{1F34B}',
    '\u{1F351}',
];

const getServerFruit = (value: string) => {
    const lower = value.toLowerCase();
    if (lower.includes('honey')) return '\u{1F347}';
    if (lower.includes('oreo')) return '\u{1FAD0}';
    if (lower.includes('galaxy')) return '\u{1FAD0}';
    if (lower.includes('kit')) return '\u{1F352}';
    if (lower.includes('ice')) return '\u{1F353}';
    const sum = value.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
    return SERVER_FRUITS[sum % SERVER_FRUITS.length];
};

const EMBED_SANDBOX_POLICY = [
    'allow-scripts',
    'allow-same-origin',
    'allow-forms',
    'allow-presentation',
].join(' ');

const EMBED_ALLOW_POLICY = [
    'autoplay',
    'fullscreen',
    'encrypted-media',
    'picture-in-picture',
].join('; ');

const EMBED_REFERRER_POLICY: React.IframeHTMLAttributes<HTMLIFrameElement>['referrerPolicy'] = 'no-referrer';

const SANDBOX_INCOMPATIBLE_PROVIDER_PATTERNS = [
    /honey/i,
    /ice[-\s_]*candy/i,
    /icecandy/i,
];

const requiresStrictEmbedSandbox = (provider: PlayerProviderAdapter) => {
    const providerKey = `${provider.id} ${provider.name}`;
    if (SANDBOX_INCOMPATIBLE_PROVIDER_PATTERNS.some(pattern => pattern.test(providerKey))) {
        return false;
    }

    const tags = (provider.tags || []).map(tag => tag.trim().toLowerCase());
    const hasRedirectTag = tags.some(tag => tag.includes('redirect'));
    const hasExplicitAdRiskTag = tags.some(tag => (
        tag === 'ads'
        || tag === 'ad risk'
        || tag === 'browser ads'
        || tag === 'popups'
        || tag === 'popup ads'
    ));

    return provider.riskLevel === 'high' || hasRedirectTag || hasExplicitAdRiskTag;
};

const getEmbedSandboxPolicy = (provider: PlayerProviderAdapter) => (
    requiresStrictEmbedSandbox(provider) ? EMBED_SANDBOX_POLICY : undefined
);

const buildIframeSandboxAttribute = (sandboxPolicy?: string) => (
    sandboxPolicy ? ` sandbox="${escapeHtml(sandboxPolicy)}"` : ''
);

export const UnifiedPlayer: React.FC<UnifiedPlayerProps> = ({
    tmdbId,
    mediaType,
    season = 1,
    episode = 1,
    onPlayEpisode,
    title = '',
    posterUrl = '',
    voteAverage = 0,
    backdropUrl = '',
    episodeImage = '',
    description = '',
    year,
    genre = [],
}) => {
    const { user } = useAuth();
    // ... existing state ...
    // ... existing state ...

    // ... inside component
    const [provider, setProvider] = useState<Provider>('zxcplayer');
    const [lastTime, setLastTime] = useState(0);
    const [showServers, setShowServers] = useState(false);
    const [showCommunity, setShowCommunity] = useState(false);
    const [communityLinks, setCommunityLinks] = useState<RequestReply[]>([]);
    const [uiPreferences, setUiPreferences] = useState<UiPreferences>(() => getUiPreferences());

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
    const [showVotingModal, setShowVotingModal] = useState(false);
    const [genres, setGenres] = useState<string[]>([]);
    const [nextEpisodeTarget, setNextEpisodeTarget] = useState<{ season: number; episode: number } | null>(null);
    const [isResolvingNextEpisode, setIsResolvingNextEpisode] = useState(false);
    const sessionIdRef = useRef<string>('');
    const providerAttemptIdRef = useRef<string>('');
    const providerAttemptStartedAtRef = useRef<number>(0);
    const providerAttemptFinishedRef = useRef(false);
    const providerReadyMarkedRef = useRef(false);
    const directVideoRef = useRef<HTMLVideoElement>(null);
    const { providers } = usePlayerProviders();
    const [desktopCaptureKey, setDesktopCaptureKey] = useState<string | null>(null);
    const lastLoggedPlaybackTargetRef = useRef<string | null>(null);

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
    const playerShellRef = useRef<HTMLDivElement>(null);
    const popoutWindowRef = useRef<Window | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [popoutError, setPopoutError] = useState<string | null>(null);

    // Fetch specific episode image (screenshot) if TV
    const [currentEpisodeImage, setCurrentEpisodeImage] = useState<string>(episodeImage || '');
    // Fetch specific backdrop if Movie (sometimes we only get posterUrl passed in)
    const [currentMovieBackdrop, setCurrentMovieBackdrop] = useState<string>(backdropUrl || '');

    useEffect(() => subscribeToUiPreferences(setUiPreferences), []);

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
        if (mediaType !== 'tv' || !onPlayEpisode) {
            setNextEpisodeTarget(null);
            setIsResolvingNextEpisode(false);
            return;
        }

        let cancelled = false;

        const resolveNextEpisode = async () => {
            setIsResolvingNextEpisode(true);

            try {
                const currentSeasonData = await TmdbService.getSeasonDetails(tmdbId, season);
                if (cancelled) return;

                const sortedCurrentEpisodes = (currentSeasonData?.episodes || [])
                    .slice()
                    .sort((left, right) => left.episode_number - right.episode_number);
                const nextInCurrentSeason = sortedCurrentEpisodes.find(item => item.episode_number > episode);

                if (nextInCurrentSeason) {
                    setNextEpisodeTarget({ season, episode: nextInCurrentSeason.episode_number });
                    return;
                }

                const showDetails = await TmdbService.getDetails(tmdbId, 'tv');
                if (cancelled) return;

                const upcomingSeasons = (showDetails.seasons || [])
                    .filter((item) => typeof item?.season_number === 'number' && typeof item?.episode_count === 'number')
                    .filter((item) => item.season_number > season && item.episode_count > 0)
                    .sort((left, right) => left.season_number - right.season_number);

                for (const nextSeason of upcomingSeasons) {
                    const nextSeasonData = await TmdbService.getSeasonDetails(tmdbId, nextSeason.season_number);
                    if (cancelled) return;

                    const firstEpisode = (nextSeasonData?.episodes || [])
                        .slice()
                        .sort((left, right) => left.episode_number - right.episode_number)[0];

                    if (firstEpisode) {
                        setNextEpisodeTarget({ season: nextSeason.season_number, episode: firstEpisode.episode_number });
                        return;
                    }
                }

                setNextEpisodeTarget(null);
            } catch (err) {
                if (!cancelled) {
                    setNextEpisodeTarget(null);
                }
            } finally {
                if (!cancelled) {
                    setIsResolvingNextEpisode(false);
                }
            }
        };

        void resolveNextEpisode();

        return () => {
            cancelled = true;
        };
    }, [tmdbId, mediaType, season, episode, onPlayEpisode]);

    useEffect(() => {
        sessionIdRef.current = crypto.randomUUID();
    }, [tmdbId, mediaType, season, episode]);

    const providerContext: ProviderContext = {
        tmdbId,
        mediaType,
        season,
        episode,
    };

    const isDesktopRuntime = Boolean(window.desktop?.isDesktop);
    const enabledProviders = providers.filter(item => item.enabled);
    const availableProviders = enabledProviders.length > 0 ? enabledProviders : PLAYER_PROVIDER_DEFAULTS;
    const currentProvider = getProviderAdapter(availableProviders, provider);
    const directSources = currentProvider.renderMode === 'direct'
        ? currentProvider.getDirectSources?.(providerContext) || []
        : [];
    const currentEmbedUrl = currentProvider.getEmbedUrl?.(providerContext) || '';
    const embedSandboxPolicy = getEmbedSandboxPolicy(currentProvider);
    const playbackTargetKey = `${currentProvider.id}:${tmdbId}:${mediaType}:${season}:${episode}`;
    const directProgressStorageKey = useMemo(
        () => `plusultra:direct-progress:${user?.id || 'guest'}:${tmdbId}:${mediaType}:${season}:${episode}`,
        [episode, mediaType, season, tmdbId, user?.id]
    );
    const directProgressContext = useMemo(() => ({
        storageKey: directProgressStorageKey,
        tmdbId,
        mediaType,
        season,
        episode,
        provider: currentProvider.id,
        progressSource: 'direct_exact' as const,
        title,
        posterUrl,
        backdropUrl: currentMovieBackdrop || backdropUrl,
        year,
        genres: genres.length > 0 ? genres : undefined,
        voteAverage,
        episodeImage: currentEpisodeImage || episodeImage,
    }), [
        backdropUrl,
        currentEpisodeImage,
        currentMovieBackdrop,
        currentProvider.id,
        directProgressStorageKey,
        episode,
        episodeImage,
        genres,
        mediaType,
        posterUrl,
        season,
        title,
        tmdbId,
        voteAverage,
        year,
    ]);

    useEffect(() => {
        if (!availableProviders.some(item => item.id === provider)) {
            setProvider(availableProviders[0].id);
        }
    }, [availableProviders, provider]);

    useEffect(() => {
        const syncFullscreenState = () => {
            setIsFullscreen(document.fullscreenElement === playerShellRef.current);
        };

        document.addEventListener('fullscreenchange', syncFullscreenState);
        return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
    }, []);

    useEffect(() => {
        if (!import.meta.env.DEV) return;

        const playbackTargetKey = JSON.stringify({
            provider: currentProvider.id,
            tmdbId,
            mediaType,
            season,
            episode,
            mode: currentProvider.renderMode,
            sandbox: embedSandboxPolicy ? 'strict' : 'compat',
            url: currentProvider.renderMode === 'direct'
                ? directSources[0]?.src || ''
                : currentEmbedUrl,
        });

        if (lastLoggedPlaybackTargetRef.current === playbackTargetKey) {
            return;
        }
        lastLoggedPlaybackTargetRef.current = playbackTargetKey;

        console.info('[UnifiedPlayer] Playback target', {
            provider: currentProvider.id,
            tmdbId,
            mediaType,
            season,
            episode,
            sandbox: embedSandboxPolicy ? 'strict' : 'compat',
            url: currentProvider.renderMode === 'direct'
                ? directSources[0]?.src || ''
                : currentEmbedUrl,
        });
    }, [currentProvider.id, currentProvider.renderMode, currentEmbedUrl, directSources, embedSandboxPolicy, tmdbId, mediaType, season, episode]);


    useEffect(() => {
        if (!window.desktop?.isDesktop) {
            return;
        }

        let active = true;
        let activeKey: string | null = null;
        setDesktopCaptureKey(null);

        window.desktop.startMediaCapture({
            tmdbId,
            mediaType,
            season,
            episode,
            providerId: currentProvider.id,
            providerName: currentProvider.name,
            title,
        }).then((result) => {
            if (!result.captureKey) {
                return;
            }

            if (!active) {
                void window.desktop?.stopMediaCapture(result.captureKey);
                return;
            }

            activeKey = result.captureKey;
            setDesktopCaptureKey(result.captureKey);
        }).catch(() => {
            // Desktop bridge is optional; web builds do not provide it.
        });

        return () => {
            active = false;
            if (activeKey) {
                void window.desktop?.stopMediaCapture(activeKey);
            }
        };
    }, [tmdbId, mediaType, season, episode, currentProvider.id, currentProvider.name, title]);

    const finishProviderAttempt = (reason: string) => {
        if (providerAttemptFinishedRef.current) return;
        providerAttemptFinishedRef.current = true;
        void StatsService.finishProviderAttempt(providerAttemptIdRef.current, reason);
    };

    useEffect(() => {
        const finishOnPageExit = () => {
            finishProviderAttempt(
                providerReadyMarkedRef.current ? 'page_unload' : 'page_unload_before_ready'
            );
        };

        window.addEventListener('pagehide', finishOnPageExit);
        window.addEventListener('beforeunload', finishOnPageExit);

        return () => {
            window.removeEventListener('pagehide', finishOnPageExit);
            window.removeEventListener('beforeunload', finishOnPageExit);
        };
    }, [tmdbId, mediaType, season, episode, currentProvider.id]);

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

            let eventData = event.data;
            if (typeof eventData === 'string') {
                try {
                    eventData = JSON.parse(eventData);
                } catch {
                    return;
                }
            }

            if (currentProvider.id === 'vidora' && eventData?.type === 'MEDIA_DATA') {
                // Provider is ready once we start getting data
                if (!isProviderReady) {
                    markProviderReady();
                }

                const { progress, duration } = eventData.data || {};
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
                        genres: genres.length > 0 ? genres : undefined,
                        progressSource: 'embed_estimated',
                    });
                    if (!providerAttemptFinishedRef.current) {
                        void StatsService.heartbeatProviderAttempt(providerAttemptIdRef.current, progress, 15);
                    }
                }
                return;
            }

            if (currentProvider.id === 'cinesrc') {
                const eventType = eventData?.type;

                if (eventType === 'cinesrc:error') {
                    finishProviderAttempt('media_error');
                    return;
                }

                if (eventType === 'cinesrc:ready' || eventType === 'cinesrc:play' || eventType === 'cinesrc:timeupdate') {
                    if (!isProviderReady) {
                        markProviderReady();
                    }
                }

                if (eventType === 'cinesrc:timeupdate' && typeof eventData?.currentTime === 'number') {
                    const progress = eventData.currentTime;
                    const duration = typeof eventData?.duration === 'number' ? eventData.duration : 0;

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
                        genres: genres.length > 0 ? genres : undefined,
                        progressSource: 'embed_estimated',
                    });
                    if (!providerAttemptFinishedRef.current) {
                        void StatsService.heartbeatProviderAttempt(providerAttemptIdRef.current, progress, 15);
                    }
                }
                return;
            }

            if (currentProvider.id === 'cinextream') {
                const eventType = eventData?.event;

                if (eventType === 'player_error') {
                    finishProviderAttempt('media_error');
                    return;
                }

                if (eventType === 'player_ready' || eventType === 'time') {
                    if (!isProviderReady) {
                        markProviderReady();
                    }
                }

                if (eventType === 'time' && typeof eventData?.time === 'number') {
                    const progress = eventData.time;
                    const duration = typeof eventData?.duration === 'number' ? eventData.duration : 0;

                    setLastTime(progress);
                    updateProgress({
                        tmdbId,
                        type: mediaType,
                        season,
                        episode,
                        time: progress,
                        duration,
                        lastUpdated: Date.now(),
                        provider: 'cinextream',
                        title,
                        posterPath: posterUrl,
                        voteAverage,
                        backdropUrl: currentMovieBackdrop || backdropUrl,
                        episodeImage: currentEpisodeImage || episodeImage,
                        genres: genres.length > 0 ? genres : undefined,
                        progressSource: 'embed_estimated',
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

        if (currentProvider.renderMode === 'direct') {
            return;
        }

        const saveProgress = () => {
            let currentPosition = 0;
            let videoDuration = 0;

            try {
                const iframe = iframeRef.current;
                if (iframe && iframe.contentDocument) {
                    const videoElement = iframe.contentDocument.querySelector('video');
                    if (videoElement) {
                        currentPosition = videoElement.currentTime || 0;
                        videoDuration = videoElement.duration || 0;
                    } else {
                        fallbackTime += 30;
                        currentPosition = fallbackTime;
                    }
                } else {
                    fallbackTime += 30;
                    currentPosition = fallbackTime;
                }
            } catch (error) {
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
                    posterPath: posterUrl,
                    voteAverage,
                    year: new Date().getFullYear(),

                    backdropUrl: currentMovieBackdrop || backdropUrl,
                    episodeImage: currentEpisodeImage || episodeImage,
                    genres: genres.length > 0 ? genres : undefined,
                    progressSource: 'embed_estimated',
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
            const context = getTrackingContext();
            if (!context.isVisible || !isProviderReady) {
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
                context: {
                    ...context,
                    resumeSource: currentProvider.renderMode === 'direct' ? 'direct_player' : 'embedded_player',
                },
            });
        };

        if (isProviderReady) {
            heartbeat();
        }

        const interval = setInterval(heartbeat, VIEW_SESSION_HEARTBEAT_SECONDS * 1000);
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                heartbeat();
            }
        };
        const handleFocus = () => {
            heartbeat();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
        };
    }, [tmdbId, mediaType, season, episode, provider, title, genres, isProviderReady, currentProvider.renderMode]);

    const handleFullscreen = async () => {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
                return;
            }

            await playerShellRef.current?.requestFullscreen({ navigationUI: 'hide' });
        } catch (err) {
            console.error('[UnifiedPlayer] Failed to toggle fullscreen', err);
        }
    };

    const handlePopout = async () => {
        setPopoutError(null);

        if (currentProvider.renderMode === 'direct') {
            const video = directVideoRef.current;
            if (video && 'requestPictureInPicture' in video && !video.disablePictureInPicture) {
                try {
                    await video.requestPictureInPicture();
                    return;
                } catch (err) {
                    console.warn('[UnifiedPlayer] Native PiP failed, opening popout window instead', err);
                }
            }
        }

        const popoutUrl = currentProvider.renderMode === 'direct'
            ? directSources[0]?.src
            : currentEmbedUrl;

        if (!popoutUrl) {
            setPopoutError('No stream URL is ready yet.');
            return;
        }

        const popout = withTrustedPopup(() => (
            window.open('', `plusultra-popout-${playbackTargetKey}`, 'popup=yes,width=960,height=540,resizable=yes,noopener=no')
        ));
        if (!popout) {
            setPopoutError('Popout was blocked by the browser.');
            return;
        }

        popoutWindowRef.current = popout;
        const popoutTitle = `${title || 'Plus Ultra Player'} - ${currentProvider.name}`;
        const content = currentProvider.renderMode === 'direct'
            ? `<video src="${escapeHtml(popoutUrl)}" controls autoplay playsinline style="width:100%;height:100%;background:#000;object-fit:contain"></video>`
            : `<iframe src="${escapeHtml(popoutUrl)}" allowfullscreen allow="${escapeHtml(EMBED_ALLOW_POLICY)}" referrerpolicy="${escapeHtml(EMBED_REFERRER_POLICY)}"${buildIframeSandboxAttribute(embedSandboxPolicy)} style="width:100%;height:100%;border:0"></iframe>`;

        popout.document.open();
        popout.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(popoutTitle)}</title>
<meta name="referrer" content="no-referrer" />
<style>
html, body { width: 100%; height: 100%; margin: 0; background: #000; overflow: hidden; }
</style>
<script>window.opener = null;</script>
</head>
<body>${content}</body>
</html>`);
        popout.document.close();
        popout.focus();
    };

    const useStudioChrome = uiPreferences.playerChrome === 'studio' || uiPreferences.layoutMode === 'studio';
    const compactControls = uiPreferences.playerControlDensity === 'compact';
    const showControlLabels = !useStudioChrome || uiPreferences.playerControlLabels;
    const controlIconSize = compactControls ? 16 : 18;
    const toolbarClassName = useStudioChrome
        ? `absolute right-4 top-3 z-50 flex items-center gap-2 rounded-full border border-white/12 bg-black/78 p-2 text-white shadow-[0_16px_46px_rgba(0,0,0,0.58)] backdrop-blur-2xl transition-opacity duration-200 ${uiPreferences.playerAutoHideControls ? 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100' : 'opacity-100'}`
        : 'absolute top-6 right-6 md:right-[calc(2cm+1.5rem)] z-50 flex gap-4 transition-opacity duration-200';
    const controlButtonClassName = (active = false, disabled = false) => useStudioChrome
        ? `${compactControls ? 'h-10 min-w-10 px-2.5' : 'h-11 min-w-11 px-3'} inline-flex items-center justify-center gap-1.5 rounded-full border text-xs font-semibold backdrop-blur-md transition-colors ${disabled
            ? 'cursor-not-allowed border-white/8 bg-white/[0.035] text-white/32'
            : active
                ? 'border-white/18 bg-white text-black'
                : 'border-white/10 bg-white/[0.055] text-white/82 hover:bg-white/[0.12] hover:text-white'}`
        : `flex items-center gap-2 p-2 md:px-4 md:py-2 rounded-full border border-white/10 backdrop-blur-md transition-all ${disabled
            ? 'bg-black/30 text-white/50 cursor-not-allowed'
            : active
                ? 'bg-white text-black'
                : 'bg-black/50 text-white hover:bg-white/20'}`;
    const panelClassName = useStudioChrome
        ? 'fixed md:absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 md:translate-x-0 md:translate-y-0 md:left-auto md:top-full md:right-0 w-[90vw] md:w-80 mt-0 md:mt-2 rounded-[24px] border border-white/10 bg-[#09090b]/92 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.62)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[60vh] md:max-h-[400px] overflow-y-auto custom-scrollbar flex flex-col gap-2 z-[70] md:z-[60]'
        : 'fixed md:absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 md:translate-x-0 md:translate-y-0 md:left-auto md:top-full md:right-0 w-[90vw] md:w-80 mt-0 md:mt-2 bg-[#0f1014] md:bg-[#0f1014]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-200 max-h-[60vh] md:max-h-[400px] overflow-y-auto custom-scrollbar flex flex-col gap-2 z-[70] md:z-[60]';


    return (
        <div ref={playerShellRef} className={`w-full h-full relative bg-black group ${useStudioChrome ? 'studio-player-shell' : ''}`}>

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
                    badge="Direct Playback"
                    progressContext={directProgressContext}
                />
            ) : (
                <iframe
                    key={currentEmbedUrl || `${playbackTargetKey}:embed`}
                    ref={iframeRef}
                    src={currentEmbedUrl}
                    width="100%"
                    height="100%"
                    allowFullScreen
                    allow={EMBED_ALLOW_POLICY}
                    className="w-full h-full border-none"
                    title={`Player - ${provider}`}
                    id="unified-iframe"
                    onLoad={markProviderReady}
                    referrerPolicy={EMBED_REFERRER_POLICY}
                    sandbox={embedSandboxPolicy}
                />
            )}





            {useStudioChrome && (
                <div className={`pointer-events-none absolute left-3 top-3 z-50 max-w-[min(680px,calc(100%-13rem))] transition-opacity duration-200 ${uiPreferences.playerAutoHideControls ? 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100' : 'opacity-100'}`}>
                    <div className="line-clamp-1 min-h-12 rounded-full border border-white/12 bg-black/82 px-5 py-3 text-sm font-bold text-white/86 shadow-[0_14px_38px_rgba(0,0,0,0.52)] backdrop-blur-2xl">
                        {title || tmdbId}
                        <span className="ml-2 text-white/42">{getServerFruit(currentProvider.name)} {currentProvider.name}</span>
                    </div>
                </div>
            )}

            {/* Controls Overlay (Top Right) */}
            <div className={toolbarClassName}>
                {isDesktopRuntime && (
                    <button
                        onClick={handlePopout}
                        className={controlButtonClassName()}
                        title={currentProvider.renderMode === 'direct' ? 'Open picture-in-picture' : 'Open popout player'}
                    >
                        <PictureInPicture2 size={controlIconSize} />
                        {showControlLabels && <span className="hidden text-sm font-medium md:inline">
                            {currentProvider.renderMode === 'direct' ? 'PiP' : 'Popout'}
                        </span>}
                    </button>
                )}

                <button
                    onClick={handleFullscreen}
                    className={controlButtonClassName()}
                    title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen player'}
                >
                    <Maximize2 size={controlIconSize} />
                    {showControlLabels && <span className="hidden text-sm font-medium md:inline">
                        {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                    </span>}
                </button>

                {mediaType === 'tv' && onPlayEpisode && (
                    <button
                        onClick={() => {
                            if (nextEpisodeTarget) {
                                onPlayEpisode(nextEpisodeTarget.season, nextEpisodeTarget.episode);
                            }
                        }}
                        disabled={isResolvingNextEpisode || !nextEpisodeTarget}
                        className={controlButtonClassName(false, isResolvingNextEpisode || !nextEpisodeTarget)}
                        title={nextEpisodeTarget
                            ? `Play S${nextEpisodeTarget.season} E${nextEpisodeTarget.episode}`
                            : 'No next episode available'}
                    >
                        <SkipForward size={controlIconSize} />
                        {showControlLabels && <span className="hidden text-sm font-medium md:inline">
                            {isResolvingNextEpisode
                                ? 'Finding Next'
                                : nextEpisodeTarget
                                    ? `Next S${nextEpisodeTarget.season}E${nextEpisodeTarget.episode}`
                                    : 'No Next'}
                        </span>}
                    </button>
                )}

                {/* Community / Downloads Button */}
                <div className="relative">
                    <button
                        onClick={() => setShowCommunity(!showCommunity)}
                        className={controlButtonClassName(showCommunity)}
                        title="Downloads"
                    >
                        <Download size={controlIconSize} />
                        {showControlLabels && <span className="hidden text-sm font-medium md:inline">Downloads</span>}
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
                        <div className={panelClassName}>

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

                            <StreamDownloadPanel
                                providerId={currentProvider.id}
                                providerName={currentProvider.name}
                                tmdbId={tmdbId}
                                mediaType={mediaType}
                                season={season}
                                episode={episode}
                                title={title}
                                imageUrl={posterUrl}
                                backdropUrl={backdropUrl}
                                description={description}
                                year={year}
                                genre={genre}
                                desktopCaptureKey={desktopCaptureKey}
                                currentEmbedUrl={currentEmbedUrl}
                                directSources={directSources}
                            />

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

                <div className="relative" id="server-menu">
                    <button
                        onClick={() => setShowServers(!showServers)}
                        className={controlButtonClassName(showServers)}
                        title="Servers"
                    >
                        <Settings size={controlIconSize} />
                        {showControlLabels && <span className="hidden text-sm font-medium md:inline">Servers</span>}
                    </button>

                    {showServers && (
                        <div className={`absolute right-0 top-full mt-2 ${useStudioChrome ? 'w-[min(20rem,calc(100vw-2rem))] rounded-[24px] border border-white/10 bg-[#070708]/92 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.68)]' : 'w-64 md:w-72 bg-[#0f1014]/90 border border-white/5 rounded-2xl shadow-2xl p-2'} backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[min(360px,calc(100vh-5.5rem))] overflow-hidden flex flex-col gap-1.5`}>
                            {useStudioChrome && (
                                <div className="shrink-0 px-2 pb-1.5 pt-1">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/34">Playback source</div>
                                            <div className="mt-1 text-sm font-black text-white">{getServerFruit(currentProvider.name)} {currentProvider.name}</div>
                                        </div>
                                        <span className="rounded-full border border-white/10 bg-white/[0.055] px-2 py-1 text-[10px] font-bold uppercase text-white/50">
                                            {currentProvider.renderMode === 'direct' ? 'Direct' : 'Embed'}
                                        </span>
                                    </div>
                                </div>
                            )}
                            <div className="studio-scrollbar min-h-0 space-y-1 overflow-y-auto pr-1">
                            {availableProviders.map((p) => {
                                const isActive = provider === p.id;
                                const providerTag = (p.tags?.[0] || (p.renderMode === 'direct' ? 'Direct' : 'Embed')).replace('Redirect Issues', 'Redirects');
                                const providerTags = (p.tags || []).map(tag => tag.trim().toLowerCase());
                                const hasWarningTag = providerTags.some(tag => (
                                    tag.includes('redirect')
                                    || tag === 'ads'
                                    || tag === 'ad risk'
                                    || tag === 'browser ads'
                                    || tag === 'popups'
                                    || tag === 'popup ads'
                                ));
                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => {
                                            handleProviderSwitch(p.id);
                                        }}
                                        className={useStudioChrome
                                            ? `group/server flex h-14 w-full items-center justify-between gap-3 overflow-hidden rounded-[16px] border px-3 text-left transition-colors ${isActive
                                                ? 'border-white/18 bg-white text-black shadow-[0_14px_38px_rgba(255,255,255,0.08)]'
                                                : 'border-white/[0.055] bg-white/[0.035] text-white/60 hover:border-white/12 hover:bg-white/[0.075] hover:text-white'}`
                                            : `w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all border border-transparent ${isActive
                                                ? 'bg-white text-black shadow-lg shadow-white/10'
                                                : 'text-zinc-400 hover:bg-white/5 hover:border-white/5 hover:text-white'}`}
                                    >
                                        <div className="flex min-w-0 flex-col gap-0.5 items-start">
                                            <div className="flex min-w-0 items-center gap-2">
                                                <span className={`truncate text-sm font-bold ${isActive ? 'text-black' : 'text-zinc-200'}`}>
                                                    {getServerFruit(p.name)} {p.name}
                                                </span>
                                                {(p.tags?.[0] || p.renderMode === 'direct') && (
                                                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${isActive
                                                        ? 'bg-black/10 text-black/70'
                                                        : hasWarningTag
                                                            ? 'bg-red-500/20 text-red-400'
                                                            : p.renderMode === 'direct'
                                                                ? 'bg-green-500/20 text-green-400'
                                                            : 'bg-white/10 text-zinc-500'
                                                        }`}>
                                                        {providerTag}
                                                    </span>
                                                )}
                                            </div>
                                            <span className={`line-clamp-1 text-[10px] ${isActive ? 'text-black/60' : useStudioChrome ? 'text-white/34' : 'text-zinc-600'}`}>
                                                {p.bestFor}{p.renderMode === 'direct' ? ' - Direct playback' : ''}
                                            </span>
                                        </div>

                                        {isActive && <div className="shrink-0 rounded-full bg-black p-0.5 text-white"><Check size={10} /></div>}
                                    </button>
                                );
                            })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Provider Watermark (Fades out) */}
            <div className="absolute bottom-6 right-6 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full text-[10px] text-white/30 uppercase tracking-widest pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                {currentProvider.name}
            </div>

            {popoutError && (
                <div className="absolute bottom-6 left-6 z-50 max-w-[min(24rem,calc(100%-3rem))] rounded-2xl border border-red-400/20 bg-red-950/80 px-4 py-3 text-xs font-medium text-red-100 shadow-2xl backdrop-blur-xl">
                    {popoutError}
                </div>
            )}

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

const escapeHtml = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

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
