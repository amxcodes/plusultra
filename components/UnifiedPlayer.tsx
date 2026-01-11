
import React, { useState, useEffect, useRef } from 'react';
import { useWatchHistory } from './useWatchHistory';
import { useSkipData } from './useSkipData';
import { Settings, Check, Users } from 'lucide-react';
import { WatchTogetherService, SyncEvent, PartyMember } from '../lib/watchTogether';
import { WatchPartyModal } from './WatchPartyModal';
import { PartyIndicator } from './PartyIndicator';
import { useAuth } from '../lib/AuthContext';

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

    // Watch Together State
    const { user } = useAuth();
    const [showPartyModal, setShowPartyModal] = useState(!!autoJoinCode); // Open if auto-joining
    const [partyId, setPartyId] = useState<string | null>(null);
    const [inviteCode, setInviteCode] = useState('');
    const [isHost, setIsHost] = useState(false);
    const [partyChannel, setPartyChannel] = useState<any>(null);
    const [partyMembers, setPartyMembers] = useState<PartyMember[]>([]);

    // Handle Auto-Join
    useEffect(() => {
        if (autoJoinCode && !partyId) {
            // We pass the code to the modal via props, or we just trigger the join immediately
            // But we need the modal to be open to show "Joining..." or success
            // Let's modify WatchPartyModal to handle auto-trigger if we want, 
            // OR simpler: just call joinParty directly here?
            // Better to let the user confirm or see the modal state.
            // For now, let's just prep the modal.
            // Actually, let's try to auto-join silently if we can?
            // No, better experience is seeing the modal "Joining party..."
        }
    }, [autoJoinCode]);

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

    // Watch Together: Handle party sync events
    useEffect(() => {
        if (!partyChannel || !user) return;

        // Listen for sync events
        WatchTogetherService.onSyncReceived(partyChannel, (event: SyncEvent) => {
            // Don't process own events
            if (event.userId === user.id) return;

            // Handle server switching (all servers)
            if (event.type === 'switch_server' && event.server) {
                setProvider(event.server as Provider);
                // Also show a toast or notification here if we had one
            }

            // Handle Playback Sync
            if (provider === 'vidora') {
                // Vidora supports some control via postMessage (best effort)
                const iframe = iframeRef.current;
                if (iframe && iframe.contentWindow) {
                    if (event.type === 'play') {
                        iframe.contentWindow.postMessage({ type: 'PLAY' }, '*');
                    } else if (event.type === 'pause') {
                        iframe.contentWindow.postMessage({ type: 'PAUSE' }, '*');
                    } else if ((event.type === 'seek' || event.type === 'sync_timestamp') && event.timestamp) {
                        iframe.contentWindow.postMessage({ type: 'SEEK', time: event.timestamp }, '*');
                    }
                }
            } else {
                // Manual Sync for others
                if (event.timestamp) {
                    const timeStr = new Date(event.timestamp * 1000).toISOString().substr(14, 5);
                    console.log(`[Watch Party] Host is at ${timeStr} (${event.type})`);
                }
            }
        });

        // Update presence
        const updatePresence = () => {
            const members = WatchTogetherService.getPresence(partyChannel);
            setPartyMembers(members);
        };

        partyChannel.on('presence', { event: 'sync' }, updatePresence);
        partyChannel.on('presence', { event: 'join' }, updatePresence);
        partyChannel.on('presence', { event: 'leave' }, updatePresence);

        // Cleanup is handled by the leaveParty call in the separate useEffect
        return () => { };
    }, [partyChannel, user, provider]);

    // Watch Together: Cleanup on unmount
    useEffect(() => {
        return () => {
            if (partyChannel) {
                WatchTogetherService.leaveParty(partyChannel);
                if (isHost && partyId) {
                    WatchTogetherService.endParty(partyId);
                }
            }
        };
    }, [partyChannel, isHost, partyId]);


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
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.origin.includes("vidora.su") && provider === 'vidora') {
                if (event.data?.type === 'MEDIA_DATA') {
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

                        // Broadcast sync for Vidora if in a party and is host
                        if (partyChannel && isHost) {
                            WatchTogetherService.broadcastSync(partyChannel, {
                                type: isPlaying ? 'play' : 'pause',
                                timestamp: progress
                            });
                        }
                    }
                }
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [provider, tmdbId, mediaType, season, episode, title, posterUrl, voteAverage, backdropUrl, episodeImage, partyChannel, isHost]);

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

            {/* Party Indicator */}
            {partyId && partyChannel && (
                <PartyIndicator
                    members={partyMembers}
                    inviteCode={isHost ? inviteCode : undefined}
                    isHost={isHost}
                    onLeave={async () => {
                        await WatchTogetherService.leaveParty(partyChannel);
                        if (isHost) await WatchTogetherService.endParty(partyId);
                        setPartyId(null);
                        setPartyChannel(null);
                        setInviteCode('');
                        setIsHost(false);
                    }}
                    onSync={isHost && provider !== 'vidora' ? () => {
                        WatchTogetherService.broadcastSync(partyChannel, {
                            type: 'sync_timestamp',
                            timestamp: lastTime
                        });
                    } : undefined}
                    showSyncButton={provider !== 'vidora'}
                />
            )}

            {/* Watch Party Modal */}
            <WatchPartyModal
                isOpen={showPartyModal}
                onClose={() => setShowPartyModal(false)}
                autoJoinCode={autoJoinCode}
                onCreateParty={async () => {
                    const result = await WatchTogetherService.createParty(
                        tmdbId,
                        mediaType,
                        season,
                        episode
                    );
                    if (result) {
                        setPartyId(result.party.id);
                        setInviteCode(result.party.invite_code);
                        setIsHost(true);
                        setPartyChannel(result.channel);
                        await result.channel.subscribe();
                        return result.party.invite_code;
                    }
                    return null;
                }}
                onJoinParty={async (code) => {
                    const result = await WatchTogetherService.joinParty(code);
                    if (result) {
                        setPartyId(result.party.id);
                        setInviteCode(result.party.invite_code);
                        setIsHost(false);
                        setPartyChannel(result.channel);
                        return true;
                    }
                    return false;
                }}
            />

            {/* Controls Overlay (Top Right) */}
            <div className="absolute top-6 right-6 z-50 flex gap-4">
                {/* Watch Together Button */}
                {!partyId && (
                    <button
                        onClick={() => setShowPartyModal(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md transition-all bg-black/50 text-white hover:bg-white/20"
                    >
                        <Users size={16} />
                        <span className="text-sm font-medium">Watch Together</span>
                    </button>
                )}

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
