import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ExternalLink, Info, Link2, MessageSquare, MonitorPlay, Search, Send, UserPlus, Users, X } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { buildStreamDownloadCandidates, type StreamDownloadCandidate } from '../lib/streamDownloads';
import type { DirectPlaybackSource, MediaType, PlayerProviderAdapter, Provider } from '../lib/playerProviders';
import type {
    Profile,
    WatchPartyInvite,
    WatchPartyMember,
    WatchPartyRoom,
    WatchPartyRoomMessage,
    WatchPartySelectedSource,
    WatchPartySourceCandidate,
    WatchPartySourceState,
} from '../types';
import { WatchPartyService } from '../services/WatchPartyService';
import { ProfileService } from '../services/ProfileService';

interface WatchPartyModalProps {
    isOpen: boolean;
    onClose: () => void;
    tmdbId: string;
    mediaType: MediaType;
    season?: number;
    episode?: number;
    title?: string;
    providers: PlayerProviderAdapter[];
    currentProviderId: Provider;
    currentProviderName: string;
    onProviderSelect: (providerId: Provider) => void;
    desktopCaptureKey?: string | null;
    currentEmbedUrl?: string;
    directSources?: DirectPlaybackSource[];
    activeRoom?: WatchPartyRoom | null;
    onActiveRoomChange?: (room: WatchPartyRoom | null) => void;
    onLocalSourceOverrideChange?: (source: WatchPartySelectedSource | null) => void;
}

type ModalMode = 'home' | 'host' | 'join';

const detectSourceType = (candidate: StreamDownloadCandidate): WatchPartySelectedSource['sourceType'] => {
    const url = candidate.url.toLowerCase();
    if (url.includes('.m3u8')) return 'm3u8';
    if (url.includes('.mpd')) return 'mpd';
    if (url.includes('.mp4') || candidate.kind === 'video') return 'mp4';
    return 'unknown';
};

const detectPortability = (candidate: StreamDownloadCandidate): WatchPartySourceState => {
    const url = candidate.url.toLowerCase();
    if (candidate.source === 'detected' && (url.includes('.mp4') || url.includes('.m3u8') || url.includes('.mpd'))) {
        return 'portable';
    }
    if (candidate.kind === 'playlist' || candidate.kind === 'video') {
        return 'guest_recheck';
    }
    return 'host_only';
};

const portabilityLabel: Record<WatchPartySourceState, string> = {
    pending: 'Pending',
    portable: 'Portable',
    guest_recheck: 'Guest re-check',
    host_only: 'Host only',
};

const sourceBadgeClassName: Record<WatchPartySourceState, string> = {
    pending: 'bg-zinc-500/15 text-zinc-300',
    portable: 'bg-emerald-500/15 text-emerald-300',
    guest_recheck: 'bg-amber-500/15 text-amber-300',
    host_only: 'bg-red-500/15 text-red-300',
};

const candidateStatusClassName: Record<WatchPartySourceCandidate['status'], string> = {
    discovered: 'bg-zinc-500/15 text-zinc-300',
    selected: 'bg-emerald-500/15 text-emerald-300',
    failed: 'bg-red-500/15 text-red-300',
};

const surfaceClassName = 'rounded-[26px] border border-white/8 bg-white/[0.035] shadow-[0_18px_80px_rgba(0,0,0,0.28)]';
const panelClassName = 'rounded-[22px] border border-white/8 bg-black/20';
const panelLabelClassName = 'text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500';
const pillClassName = 'rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-300';
const emptyStateClassName = 'rounded-[18px] border border-dashed border-white/10 bg-black/20 px-4 py-6 text-sm text-zinc-500';
const compactActionClassName = 'rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-200 transition-colors hover:bg-white/[0.08]';

const isMemberOnline = (member: WatchPartyMember) =>
    Boolean(member.last_seen_at && Date.now() - new Date(member.last_seen_at).getTime() < 30000);

export const WatchPartyModal: React.FC<WatchPartyModalProps> = ({
    isOpen,
    onClose,
    tmdbId,
    mediaType,
    season,
    episode,
    title,
    providers,
    currentProviderId,
    currentProviderName,
    onProviderSelect,
    desktopCaptureKey,
    currentEmbedUrl,
    directSources = [],
    activeRoom,
    onActiveRoomChange,
    onLocalSourceOverrideChange,
}) => {
    const { user } = useAuth();
    const toast = useToast();
    const [mode, setMode] = useState<ModalMode>('home');
    const [room, setRoom] = useState<WatchPartyRoom | null>(null);
    const [members, setMembers] = useState<WatchPartyMember[]>([]);
    const [invites, setInvites] = useState<WatchPartyInvite[]>([]);
    const [followingProfiles, setFollowingProfiles] = useState<Profile[]>([]);
    const [sourceCandidates, setSourceCandidates] = useState<WatchPartySourceCandidate[]>([]);
    const [messages, setMessages] = useState<WatchPartyRoomMessage[]>([]);
    const [chatDraft, setChatDraft] = useState('');
    const [inviteSearch, setInviteSearch] = useState('');
    const [roomCodeInput, setRoomCodeInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [roomBusy, setRoomBusy] = useState(false);
    const [desktopCapturedMedia, setDesktopCapturedMedia] = useState<DesktopCapturedMedia[]>([]);
    const [countdownNow, setCountdownNow] = useState(() => Date.now());
    const [candidateProbeState, setCandidateProbeState] = useState<Record<string, {
        loading?: boolean;
        ok?: boolean;
        message?: string;
        finalUrl?: string;
        sourceType?: WatchPartySelectedSource['sourceType'];
        expiresAt?: string | null;
    }>>({});

    const isHost = room?.host_id === user?.id;
    const selfMember = members.find((member) => member.user_id === user?.id);
    const isReady = selfMember?.state === 'ready';
    const needsGuestRecheck = Boolean(!isHost && room?.selected_source && room.source_state !== 'portable');

    useEffect(() => {
        if (activeRoom) {
            setRoom(activeRoom);
            setMode(activeRoom.host_id === user?.id ? 'host' : 'join');
        }
    }, [activeRoom, user?.id]);

    useEffect(() => {
        if (!isOpen) {
            if (!activeRoom) {
                setMode('home');
                setRoom(null);
                setMembers([]);
                setInvites([]);
                setFollowingProfiles([]);
                setSourceCandidates([]);
                setMessages([]);
                setRoomCodeInput('');
                setChatDraft('');
                setInviteSearch('');
                setCandidateProbeState({});
                onLocalSourceOverrideChange?.(null);
            }
            setLoading(false);
            setRoomBusy(false);
            setDesktopCapturedMedia([]);
        }
    }, [activeRoom, isOpen, onLocalSourceOverrideChange]);

    useEffect(() => {
        if (!room?.countdown_started_at) return;
        const timer = window.setInterval(() => setCountdownNow(Date.now()), 250);
        return () => window.clearInterval(timer);
    }, [room?.countdown_started_at]);

    useEffect(() => {
        if (!window.desktop?.isDesktop) return;
        if (!desktopCaptureKey || !isOpen) {
            setDesktopCapturedMedia([]);
            return;
        }

        let active = true;
        setDesktopCapturedMedia([]);

        window.desktop.getCapturedMedia(desktopCaptureKey).then((items) => {
            if (active) setDesktopCapturedMedia(items);
        }).catch(() => undefined);

        const unsubscribe = window.desktop.onCapturedMedia((item) => {
            if (item.captureKey !== desktopCaptureKey) return;
            setDesktopCapturedMedia((current) => current.some((entry) => entry.url === item.url) ? current : [item, ...current]);
        });

        const unsubscribeReset = window.desktop.onCapturedMediaReset((payload) => {
            if (payload.captureKey === desktopCaptureKey) {
                setDesktopCapturedMedia([]);
            }
        });

        return () => {
            active = false;
            unsubscribe();
            unsubscribeReset();
        };
    }, [desktopCaptureKey, isOpen]);

    useEffect(() => {
        if (!room?.id) return;

        let cancelled = false;
        const load = async () => {
            try {
                const [nextRoom, nextMembers, nextInvites, nextCandidates, nextMessages] = await Promise.all([
                    WatchPartyService.getRoom(room.id),
                    WatchPartyService.listRoomMembers(room.id),
                    WatchPartyService.listRoomInvites(room.id),
                    WatchPartyService.listSourceCandidates(room.id),
                    WatchPartyService.listMessages(room.id, 60),
                ]);

                if (cancelled) return;
                if (nextRoom) {
                    setRoom(nextRoom);
                    onActiveRoomChange?.(nextRoom);
                    if (nextRoom.status === 'ended') {
                        onLocalSourceOverrideChange?.(null);
                    }
                }
                setMembers(nextMembers);
                setInvites(nextInvites);
                setSourceCandidates(nextCandidates);
                setMessages(nextMessages);
            } catch (error) {
                console.error('[WatchPartyModal] Failed to load room state:', error);
            }
        };

        void load();
        const unsubscribe = WatchPartyService.subscribeToRoom(room.id, {
            onRoomChange: () => void load(),
            onMembersChange: () => void load(),
            onInvitesChange: () => void load(),
            onCandidatesChange: () => void load(),
            onMessagesChange: () => void load(),
        });

        return () => {
            cancelled = true;
            unsubscribe();
        };
    }, [onActiveRoomChange, onLocalSourceOverrideChange, room?.id]);

    useEffect(() => {
        if (!isHost || !user?.id || !room?.id) {
            setFollowingProfiles([]);
            return;
        }

        let cancelled = false;
        void ProfileService.getFollowing(user.id).then((profiles) => {
            if (!cancelled) {
                setFollowingProfiles(profiles.filter((profile) => profile.id !== user.id));
            }
        }).catch((error) => {
            console.error('[WatchPartyModal] Failed to load invite candidates:', error);
        });

        return () => {
            cancelled = true;
        };
    }, [isHost, room?.id, user?.id]);

    const countdownRemaining = useMemo(() => {
        if (!room?.countdown_started_at || !room.countdown_seconds) return null;
        const startedAt = new Date(room.countdown_started_at).getTime();
        const remaining = room.countdown_seconds - Math.floor((countdownNow - startedAt) / 1000);
        return Math.max(remaining, 0);
    }, [countdownNow, room?.countdown_seconds, room?.countdown_started_at]);

    const candidates = useMemo(() => {
        const base = buildStreamDownloadCandidates({
            providerId: currentProviderId,
            providerName: currentProviderName,
            tmdbId,
            mediaType,
            season,
            episode,
            currentEmbedUrl,
            directSources,
        });

        const captured: StreamDownloadCandidate[] = desktopCapturedMedia.map((item) => ({
            id: `desktop:${item.url}`,
            label: 'Captured desktop stream',
            url: item.url,
            kind: item.url.toLowerCase().includes('.m3u8') ? 'playlist' as const : 'video' as const,
            source: 'detected' as const,
            serverId: 'desktop-capture',
            serverLabel: 'Desktop capture',
            qualityLabel: undefined,
            requiredHeaders: item.requestHeaders,
            note: `Observed in Electron session as ${item.resourceType}`,
        }));

        return [...captured, ...base]
            .filter((candidate, index, list) => list.findIndex((entry) => entry.url === candidate.url) === index);
    }, [currentProviderId, currentProviderName, tmdbId, mediaType, season, episode, currentEmbedUrl, directSources, desktopCapturedMedia]);

    const inviteStatusByRecipientId = useMemo(() => {
        const next = new Map<string, WatchPartyInvite>();
        invites.forEach((invite) => {
            if (!next.has(invite.recipient_id)) {
                next.set(invite.recipient_id, invite);
            }
        });
        return next;
    }, [invites]);

    const inviteableProfiles = useMemo(() => {
        const query = inviteSearch.trim().toLowerCase();
        return followingProfiles.filter((profile) => {
            if (members.some((member) => member.user_id === profile.id && member.state !== 'left')) {
                return false;
            }

            if (!query) return true;
            return profile.username.toLowerCase().includes(query);
        });
    }, [followingProfiles, inviteSearch, members]);

    useEffect(() => {
        if (!room?.id || !isHost || candidates.length === 0) return;

        const sync = async () => {
            try {
                await Promise.all(candidates.map((candidate) => WatchPartyService.upsertSourceCandidate({
                    roomId: room.id,
                    candidateId: candidate.id,
                    providerId: currentProviderId,
                    providerLabel: currentProviderName,
                    serverId: candidate.serverId || candidate.id,
                    serverLabel: candidate.serverLabel || candidate.label,
                    resolvedUrl: candidate.url,
                    sourceType: detectSourceType(candidate),
                    qualityLabel: candidate.qualityLabel || null,
                    requiredHeaders: candidate.requiredHeaders || null,
                    portability: detectPortability(candidate),
                    status: room.selected_source?.candidateId === candidate.id ? 'selected' : 'discovered',
                    note: candidate.note || null,
                })));
            } catch (error) {
                console.error('[WatchPartyModal] Failed to sync source candidates:', error);
            }
        };

        void sync();
    }, [candidates, currentProviderId, currentProviderName, isHost, room?.id, room?.selected_source?.candidateId]);

    const handleCreateRoom = async () => {
        setLoading(true);
        try {
            const created = await WatchPartyService.createRoom({
                tmdbId,
                mediaType,
                season,
                episode,
                title,
            });
            if (!created) throw new Error('Unable to create room.');
            setRoom(created);
            setMode('host');
            onActiveRoomChange?.(created);
            onLocalSourceOverrideChange?.(null);
            toast.success(`Room ${created.room_code} created`);
        } catch (error) {
            console.error('[WatchPartyModal] Failed to create room:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to create watch party room.');
        } finally {
            setLoading(false);
        }
    };

    const handleJoinRoom = async () => {
        if (!roomCodeInput.trim()) return;
        setLoading(true);
        try {
            const joined = await WatchPartyService.joinRoom(roomCodeInput.trim().toUpperCase());
            if (!joined) throw new Error('Room not found.');
            setRoom(joined);
            setMode('join');
            onActiveRoomChange?.(joined);
            onLocalSourceOverrideChange?.(null);
            toast.success(`Joined room ${joined.room_code}`);
        } catch (error) {
            console.error('[WatchPartyModal] Failed to join room:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to join watch party room.');
        } finally {
            setLoading(false);
        }
    };

    const handleInviteProfile = async (profileId: string) => {
        if (!room?.id || !isHost) return;

        setRoomBusy(true);
        try {
            const createdInvites = await WatchPartyService.createInvites(room.id, [profileId]);
            if (createdInvites.length === 0) {
                throw new Error('Only people you follow can be invited right now.');
            }
            toast.success('Watch party invite sent');
        } catch (error) {
            console.error('[WatchPartyModal] Failed to send invite:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to send watch party invite.');
        } finally {
            setRoomBusy(false);
        }
    };

    const handleRevokeInvite = async (inviteId: string) => {
        if (!room?.id || !isHost) return;

        setRoomBusy(true);
        try {
            await WatchPartyService.revokeInvite(inviteId);
            toast.success('Invite revoked');
        } catch (error) {
            console.error('[WatchPartyModal] Failed to revoke invite:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to revoke invite.');
        } finally {
            setRoomBusy(false);
        }
    };

    const handleUseSource = async (candidate: StreamDownloadCandidate) => {
        if (!room?.id || !isHost) return;
        const probe = candidateProbeState[candidate.id];
        const resolvedUrl = probe?.ok && probe.finalUrl ? probe.finalUrl : candidate.url;
        const resolvedSourceType = probe?.ok && probe.sourceType ? probe.sourceType : detectSourceType(candidate);

        const selectedSource: WatchPartySelectedSource = {
            providerId: currentProviderId,
            providerLabel: currentProviderName,
            serverId: candidate.serverId || candidate.id,
            serverLabel: candidate.serverLabel || candidate.label,
            candidateId: candidate.id,
            resolvedUrl,
            sourceType: resolvedSourceType,
            qualityLabel: candidate.qualityLabel || null,
            requiredHeaders: candidate.requiredHeaders || null,
            expiresAt: probe?.expiresAt || null,
            portability: detectPortability(candidate),
            note: candidate.note || null,
            resolvedAt: new Date().toISOString(),
        };

        setRoomBusy(true);
        try {
            const [nextRoom] = await Promise.all([
                WatchPartyService.setSelectedSource({
                    roomId: room.id,
                    providerId: currentProviderId,
                    providerLabel: currentProviderName,
                    serverId: selectedSource.serverId,
                    serverLabel: selectedSource.serverLabel,
                    selectedSource,
                    sourceState: selectedSource.portability,
                    status: 'ready',
                }),
                WatchPartyService.upsertSourceCandidate({
                    roomId: room.id,
                    candidateId: candidate.id,
                    providerId: currentProviderId,
                    providerLabel: currentProviderName,
                    serverId: candidate.serverId || candidate.id,
                    serverLabel: candidate.serverLabel || candidate.label,
                    resolvedUrl,
                    sourceType: selectedSource.sourceType,
                    qualityLabel: candidate.qualityLabel || null,
                    requiredHeaders: candidate.requiredHeaders || null,
                    expiresAt: probe?.expiresAt || null,
                    portability: selectedSource.portability,
                    status: 'selected',
                    note: candidate.note || null,
                }),
            ]);

            if (nextRoom) {
                setRoom(nextRoom);
                onActiveRoomChange?.(nextRoom);
                onLocalSourceOverrideChange?.(null);
                toast.success('Watch party source locked');
            }
        } catch (error) {
            console.error('[WatchPartyModal] Failed to save source:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to lock selected source.');
        } finally {
            setRoomBusy(false);
        }
    };

    const handleUseLocalSource = (candidate: StreamDownloadCandidate) => {
        const probe = candidateProbeState[candidate.id];
        const localSource: WatchPartySelectedSource = {
            providerId: currentProviderId,
            providerLabel: currentProviderName,
            serverId: candidate.serverId || candidate.id,
            serverLabel: candidate.serverLabel || candidate.label,
            candidateId: candidate.id,
            resolvedUrl: probe?.ok && probe.finalUrl ? probe.finalUrl : candidate.url,
            sourceType: probe?.ok && probe.sourceType ? probe.sourceType : detectSourceType(candidate),
            qualityLabel: candidate.qualityLabel || null,
            requiredHeaders: candidate.requiredHeaders || null,
            expiresAt: probe?.expiresAt || null,
            portability: detectPortability(candidate),
            note: candidate.note || 'Guest-selected local source override',
            resolvedAt: new Date().toISOString(),
        };

        onLocalSourceOverrideChange?.(localSource);
        toast.success('Local source override applied');
    };

    const handleProbeCandidate = async (candidate: StreamDownloadCandidate) => {
        if (!window.desktop?.probePlaybackSource) {
            toast.error('Desktop source probe is unavailable.');
            return;
        }

        setCandidateProbeState((current) => ({
            ...current,
            [candidate.id]: { ...current[candidate.id], loading: true, message: undefined },
        }));

        try {
            const result = await window.desktop.probePlaybackSource({
                url: candidate.url,
                requiredHeaders: candidate.requiredHeaders,
            });

            setCandidateProbeState((current) => ({
                ...current,
                [candidate.id]: {
                    loading: false,
                    ok: result.ok,
                    message: result.message,
                    finalUrl: result.finalUrl,
                    sourceType: result.sourceType,
                    expiresAt: result.expiresAt || null,
                },
            }));

            if (room?.id && isHost) {
                await WatchPartyService.upsertSourceCandidate({
                    roomId: room.id,
                    candidateId: candidate.id,
                    providerId: currentProviderId,
                    providerLabel: currentProviderName,
                    serverId: candidate.serverId || candidate.id,
                    serverLabel: candidate.serverLabel || candidate.label,
                    resolvedUrl: result.ok && result.finalUrl ? result.finalUrl : candidate.url,
                    sourceType: result.ok && result.sourceType ? result.sourceType : detectSourceType(candidate),
                    qualityLabel: candidate.qualityLabel || null,
                    requiredHeaders: candidate.requiredHeaders || null,
                    expiresAt: result.expiresAt || null,
                    portability: detectPortability(candidate),
                    status: result.ok ? 'discovered' : 'failed',
                    note: result.ok ? candidate.note || null : (result.message || candidate.note || 'Probe failed'),
                });
            }

            if (result.ok) {
                toast.success('Source probe passed');
            } else {
                toast.error(result.message || 'Source probe failed');
            }
        } catch (error) {
            console.error('[WatchPartyModal] Failed to probe candidate:', error);
            setCandidateProbeState((current) => ({
                ...current,
                [candidate.id]: {
                    loading: false,
                    ok: false,
                    message: error instanceof Error ? error.message : 'Probe failed',
                },
            }));
            toast.error(error instanceof Error ? error.message : 'Failed to probe source.');
        }
    };

    const handleSetReady = async (nextReady: boolean) => {
        if (!room?.id) return;
        try {
            await WatchPartyService.setReady(room.id, nextReady);
        } catch (error) {
            console.error('[WatchPartyModal] Failed to update ready state:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to update ready state.');
        }
    };

    const handleStartCountdown = async () => {
        if (!room?.id || !isHost) return;
        setRoomBusy(true);
        try {
            const nextRoom = await WatchPartyService.startCountdown(room.id, 7);
            if (nextRoom) {
                setRoom(nextRoom);
                onActiveRoomChange?.(nextRoom);
                toast.success('Countdown started');
            }
        } catch (error) {
            console.error('[WatchPartyModal] Failed to start countdown:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to start countdown.');
        } finally {
            setRoomBusy(false);
        }
    };

    const handleLeaveRoom = async () => {
        if (!room?.id) return;
        setRoomBusy(true);
        try {
            if (isHost) {
                await WatchPartyService.endRoom(room.id);
                toast.success('Watch party ended');
            } else {
                await WatchPartyService.leaveRoom(room.id);
                toast.success('Left watch party');
            }
            onActiveRoomChange?.(null);
            onLocalSourceOverrideChange?.(null);
            setRoom(null);
            setMembers([]);
            setSourceCandidates([]);
            setMessages([]);
            setMode('home');
        } catch (error) {
            console.error('[WatchPartyModal] Failed to update room lifecycle:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to update watch party room.');
        } finally {
            setRoomBusy(false);
        }
    };

    const handleSendMessage = async () => {
        if (!room?.id || !chatDraft.trim()) return;
        const message = chatDraft.trim();
        setChatDraft('');
        try {
            await WatchPartyService.sendMessage(room.id, message);
        } catch (error) {
            console.error('[WatchPartyModal] Failed to send room message:', error);
            setChatDraft(message);
            toast.error(error instanceof Error ? error.message : 'Failed to send room message.');
        }
    };

    const mediaLabel = mediaType === 'tv' ? `TV • S${season || 1} E${episode || 1}` : 'Movie';
    const roomMediaLabel = room
        ? (room.media_type === 'tv' ? `S${room.season || 1} E${room.episode || 1}` : 'Movie')
        : mediaLabel;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[140] p-3 md:p-5">
            <div className="absolute inset-0 bg-black/75 backdrop-blur-xl" onClick={onClose} />
            <div className="relative mx-auto flex h-[min(92vh,980px)] w-full max-w-[min(1640px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#0d0f14] shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 z-20 rounded-full border border-white/10 bg-black/30 p-2 text-zinc-400 transition-colors hover:text-white"
                >
                    <X size={18} />
                </button>

                <div className="border-b border-white/8 px-5 py-4 md:px-6 md:py-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="flex items-start gap-3">
                            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-zinc-200">
                                <MonitorPlay size={18} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Desktop Watch Party</h3>
                                <p className="mt-1 text-sm text-zinc-500">
                                    Compact room controls, source verification, and live room context for desktop sessions.
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <span className={pillClassName}>{title || tmdbId}</span>
                            <span className={pillClassName}>{mediaLabel}</span>
                            <span className={pillClassName}>{currentProviderName}</span>
                            {room?.status === 'live' && (
                                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">
                                    Live now
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {!window.desktop?.isDesktop ? (
                    <div className="p-6">
                        <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] px-6 py-10 text-center">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300">
                                <Info size={20} />
                            </div>
                            <div className="mt-4 text-lg font-semibold text-white">Desktop only</div>
                            <p className="mt-2 text-sm text-zinc-500">
                                This flow depends on Electron capture and direct playback sources, so it is only available in the desktop app.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[minmax(0,1.24fr)_380px]">
                        <div className="min-h-0 border-b border-white/8 px-4 py-4 md:px-5 xl:border-b-0 xl:border-r xl:py-5">
                            {mode !== 'home' && (
                                <button
                                    type="button"
                                    onClick={() => setMode('home')}
                                    className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-300 transition-colors hover:bg-white/[0.06]"
                                >
                                    <ArrowLeft size={12} />
                                    Back
                                </button>
                            )}

                            {mode === 'home' && (
                                <div className="flex h-full min-h-0 flex-col gap-4">
                                    <div className={`${surfaceClassName} p-5`}>
                                        <div className={panelLabelClassName}>Now playing</div>
                                        <div className="mt-3 text-lg font-semibold text-white">{title || tmdbId}</div>
                                        <div className="mt-2 text-sm text-zinc-500">
                                            {mediaType === 'tv' ? `TV • S${season || 1} E${episode || 1}` : 'Movie'} • Provider {currentProviderName}
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => void handleCreateRoom()}
                                        disabled={loading}
                                        className="flex w-full items-center justify-between rounded-[24px] border border-white/10 bg-white px-5 py-4 text-left text-black transition-colors hover:bg-zinc-200 disabled:opacity-60"
                                    >
                                        <div>
                                            <div className="text-xs font-bold uppercase tracking-[0.16em]">Create room</div>
                                            <div className="mt-1 text-sm text-black/70">Start a host-controlled room and lock a working source.</div>
                                        </div>
                                        <Users size={18} />
                                    </button>

                                    <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                                        <div className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">Join room</div>
                                        <div className="mt-3 flex gap-2">
                                            <input
                                                value={roomCodeInput}
                                                onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())}
                                                placeholder="Enter room code"
                                                className="flex-1 rounded-[18px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => void handleJoinRoom()}
                                                disabled={loading || !roomCodeInput.trim()}
                                                className="rounded-[18px] border border-white/10 bg-white/[0.06] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-white/[0.1] disabled:opacity-60"
                                            >
                                                Join
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {mode !== 'home' && room && (
                                <div className="flex h-full min-h-0 flex-col gap-4">
                                    <div className={`${surfaceClassName} px-4 py-3.5`}>
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className={panelLabelClassName}>Room signal</div>
                                                <div className="mt-2 text-[28px] font-black tracking-[0.18em] text-white">{room.room_code}</div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    void navigator.clipboard.writeText(room.room_code);
                                                    toast.success('Room code copied');
                                                }}
                                                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-200"
                                            >
                                                Copy
                                            </button>
                                        </div>
                                        <div className="mt-3 text-sm text-zinc-500">
                                            {room.title || title || tmdbId} • {room.media_type === 'tv' ? `S${room.season || 1} E${room.episode || 1}` : 'Movie'}
                                        </div>
                                        {countdownRemaining !== null && room.status !== 'ended' && (
                                            <div className="mt-3 inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">
                                                {countdownRemaining > 0 ? `Starting in ${countdownRemaining}s` : 'Going live'}
                                            </div>
                                        )}
                                    </div>

                                    {isHost ? (
                                        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[248px_minmax(0,1fr)]">
                                            <div className={`${surfaceClassName} flex min-h-0 flex-col p-4`}>
                                                <div className={panelLabelClassName}>Provider lanes</div>
                                                <div className="mt-3 min-h-0 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                                                    {providers.filter((provider) => provider.enabled).map((provider) => {
                                                        const isActive = provider.id === currentProviderId;
                                                        return (
                                                            <button
                                                                key={provider.id}
                                                                type="button"
                                                                onClick={() => onProviderSelect(provider.id)}
                                                                className={`flex items-center justify-between rounded-[18px] border px-4 py-2.5 text-left transition-colors ${
                                                                    isActive
                                                                        ? 'border-white/16 bg-white text-black'
                                                                        : 'border-white/8 bg-black/20 text-zinc-300 hover:bg-white/[0.05]'
                                                                }`}
                                                            >
                                                                <div>
                                                                    <div className="text-sm font-semibold">{provider.name}</div>
                                                                    <div className={`mt-1 text-[10px] uppercase tracking-[0.16em] ${isActive ? 'text-black/60' : 'text-zinc-500'}`}>
                                                                        {provider.bestFor || provider.renderMode}
                                                                    </div>
                                                                </div>
                                                                {isActive && <Check size={16} />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className={`${surfaceClassName} flex min-h-0 flex-col p-4`}>
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <div className={panelLabelClassName}>Verify source</div>
                                                        <div className="mt-1 text-sm leading-6 text-zinc-400">
                                                            Start playback on the selected provider, then lock one tested stream from the list below.
                                                        </div>
                                                    </div>
                                                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">
                                                        {currentProviderName}
                                                    </span>
                                                </div>

                                                <div className="mt-4 min-h-0 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                                                    {candidates.length === 0 ? (
                                                        <div className={emptyStateClassName}>
                                                            No playable candidates yet. Let the provider load, then switch providers or reopen this panel.
                                                        </div>
                                                    ) : (
                                                        candidates.map((candidate) => {
                                                            const portability = detectPortability(candidate);
                                                            const isSelected = room.selected_source?.candidateId === candidate.id;
                                                            const probe = candidateProbeState[candidate.id];
                                                            return (
                                                                <div key={candidate.id} className={`rounded-[18px] border p-3.5 transition-colors ${isSelected ? 'border-emerald-400/30 bg-emerald-500/[0.06]' : 'border-white/8 bg-black/20'}`}>
                                                                    <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_114px]">
                                                                        <div className="min-w-0">
                                                                            <div className="flex flex-wrap items-center gap-2">
                                                                                <div className="text-sm font-semibold text-white">{candidate.label}</div>
                                                                                <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] ${sourceBadgeClassName[portability]}`}>
                                                                                    {portabilityLabel[portability]}
                                                                                </span>
                                                                                {candidate.qualityLabel && (
                                                                                    <span className="rounded-full bg-white/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-300">
                                                                                        {candidate.qualityLabel}
                                                                                    </span>
                                                                                )}
                                                                                {isSelected && (
                                                                                    <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-300">
                                                                                        Active
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <div className="mt-2 line-clamp-2 break-all text-[11px] leading-5 text-zinc-500">{candidate.url}</div>
                                                                            {candidate.note && <div className="mt-1 text-[11px] text-zinc-600">{candidate.note}</div>}
                                                                            {probe?.message && (
                                                                                <div className={`mt-1 text-[11px] ${probe.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                                    {probe.message}
                                                                                </div>
                                                                            )}
                                                                            {probe?.expiresAt && (
                                                                                <div className="mt-1 text-[11px] text-amber-300">
                                                                                    Expires {new Date(probe.expiresAt).toLocaleString()}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex shrink-0 flex-col gap-2 xl:items-stretch">
                                                                            <button
                                                                                type="button"
                                                                                disabled={roomBusy || probe?.loading}
                                                                                onClick={() => void handleProbeCandidate(candidate)}
                                                                                className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-100 transition-colors hover:bg-white/[0.1] disabled:opacity-60"
                                                                            >
                                                                                {probe?.loading ? 'Probing' : 'Probe'}
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                disabled={roomBusy || probe?.ok === false}
                                                                                onClick={() => void handleUseSource(candidate)}
                                                                                className="rounded-full border border-white/10 bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-black transition-colors hover:bg-zinc-200 disabled:opacity-60"
                                                                            >
                                                                                Use source
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>

                                                <div className="mt-4 flex flex-wrap gap-2 border-t border-white/8 pt-4">
                                                    <button
                                                        type="button"
                                                        disabled={roomBusy || !room.selected_source}
                                                        onClick={() => void handleStartCountdown()}
                                                        className="rounded-full border border-white/10 bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-black transition-colors hover:bg-zinc-200 disabled:opacity-60"
                                                    >
                                                        Start together
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={roomBusy}
                                                        onClick={() => void handleLeaveRoom()}
                                                        className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-200 transition-colors hover:bg-white/[0.08] disabled:opacity-60"
                                                    >
                                                        End room
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4 xl:max-w-[920px]">
                                            <div className={`${surfaceClassName} p-5`}>
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className={panelLabelClassName}>Selected source</div>
                                                        {room.selected_source ? (
                                                            <>
                                                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                                                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-300">
                                                                        {room.provider_label || room.provider_id}
                                                                    </span>
                                                                    <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] ${sourceBadgeClassName[room.source_state]}`}>
                                                                        {portabilityLabel[room.source_state]}
                                                                    </span>
                                                                </div>
                                                                <div className="mt-3 text-sm text-white">{room.selected_source.serverLabel || room.server_label || 'Chosen source'}</div>
                                                                <div className="mt-2 break-all text-[11px] text-zinc-500">{room.selected_source.resolvedUrl}</div>
                                                            </>
                                                        ) : (
                                                            <div className="mt-3 text-sm text-zinc-500">Host has not locked a source yet.</div>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        disabled={roomBusy}
                                                        onClick={() => void handleLeaveRoom()}
                                                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-200 transition-colors hover:bg-white/[0.08] disabled:opacity-60"
                                                    >
                                                        Leave
                                                    </button>
                                                </div>
                                            </div>

                                            {sourceCandidates.length > 0 && (
                                                <div className={`${surfaceClassName} p-5`}>
                                                    <div className={panelLabelClassName}>Known source map</div>
                                                    <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                                                        {sourceCandidates.slice(0, 5).map((candidate) => (
                                                            <div key={`${candidate.room_id}:${candidate.candidate_id}`} className="rounded-[18px] border border-white/8 bg-black/20 px-4 py-3">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <div className="text-sm font-semibold text-white">{candidate.server_label || candidate.candidate_id}</div>
                                                                    <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] ${candidateStatusClassName[candidate.status]}`}>
                                                                        {candidate.status}
                                                                    </span>
                                                                    {candidate.quality_label && (
                                                                        <span className="rounded-full bg-white/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-300">
                                                                            {candidate.quality_label}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="mt-2 text-[11px] text-zinc-500">{candidate.provider_label || candidate.provider_id}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {needsGuestRecheck && (
                                                <div className="rounded-[24px] border border-amber-500/20 bg-amber-500/5 p-5">
                                                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">Guest re-check needed</div>
                                                    <div className="mt-2 text-sm text-zinc-400">
                                                        This room source may only work on the host machine. Pick a local candidate from the same provider on your desktop.
                                                    </div>

                                                    <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                                                        {candidates.length === 0 ? (
                                                            <div className={emptyStateClassName}>
                                                                No local candidates yet. Let the provider load, then switch provider if needed.
                                                            </div>
                                                        ) : (
                                                            candidates.map((candidate) => (
                                                                <div key={`guest-${candidate.id}`} className="rounded-[18px] border border-white/8 bg-black/20 p-4">
                                                                    <div className="flex items-start justify-between gap-3">
                                                                        <div className="min-w-0">
                                                                            <div className="text-sm font-semibold text-white">{candidate.label}</div>
                                                                            {candidate.qualityLabel && (
                                                                                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                                                                                    {candidate.qualityLabel}
                                                                                </div>
                                                                            )}
                                                                            <div className="mt-2 break-all text-[11px] text-zinc-500">{candidate.url}</div>
                                                                            {candidate.note && <div className="mt-1 text-[11px] text-zinc-600">{candidate.note}</div>}
                                                                            {candidateProbeState[candidate.id]?.message && (
                                                                                <div className={`mt-1 text-[11px] ${candidateProbeState[candidate.id]?.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                                    {candidateProbeState[candidate.id]?.message}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex flex-col gap-2">
                                                                            <button
                                                                                type="button"
                                                                                disabled={candidateProbeState[candidate.id]?.loading}
                                                                                onClick={() => void handleProbeCandidate(candidate)}
                                                                                className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-100 transition-colors hover:bg-white/[0.1] disabled:opacity-60"
                                                                            >
                                                                                {candidateProbeState[candidate.id]?.loading ? 'Probing' : 'Probe'}
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                disabled={candidateProbeState[candidate.id]?.ok === false}
                                                                                onClick={() => handleUseLocalSource(candidate)}
                                                                                className="rounded-full border border-white/10 bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-black transition-colors hover:bg-zinc-200 disabled:opacity-60"
                                                                            >
                                                                                Use local
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="grid min-h-0 gap-4 overflow-hidden px-4 py-4 md:px-5 xl:grid-rows-[auto_auto_minmax(0,1fr)] xl:py-5">
                            {isHost && (
                                <div className={`${surfaceClassName} flex min-h-0 flex-col p-4`}>
                                    <div className="flex items-center gap-2">
                                        <UserPlus size={14} className="text-zinc-400" />
                                        <div className={panelLabelClassName}>Invite following</div>
                                    </div>
                                    <div className="mt-2 text-sm leading-6 text-zinc-400">
                                        Invite people you already follow directly into this room. Room codes stay as fallback only.
                                    </div>

                                    <div className="mt-3 flex items-center gap-3 rounded-[18px] border border-white/10 bg-black/20 px-4 py-3">
                                        <Search size={14} className="text-zinc-500" />
                                        <input
                                            value={inviteSearch}
                                            onChange={(event) => setInviteSearch(event.target.value)}
                                            placeholder="Search following..."
                                            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                                        />
                                    </div>

                                    <div className="mt-3 max-h-44 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                                        {inviteableProfiles.length === 0 ? (
                                            <div className={emptyStateClassName}>
                                                {followingProfiles.length === 0
                                                    ? 'You are not following anyone eligible for watch party invites yet.'
                                                    : 'No matching people left to invite for this room.'}
                                            </div>
                                        ) : (
                                            inviteableProfiles.map((profile) => {
                                                const existingInvite = inviteStatusByRecipientId.get(profile.id);
                                                const canInvite = !existingInvite || existingInvite.status === 'declined' || existingInvite.status === 'revoked';

                                                return (
                                                    <div key={profile.id} className="flex items-center justify-between gap-3 rounded-[18px] border border-white/8 bg-black/20 px-3.5 py-3">
                                                        <div className="flex min-w-0 items-center gap-3">
                                                            <img
                                                                src={profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.username}`}
                                                                alt={profile.username}
                                                                className="h-10 w-10 rounded-full border border-white/10 object-cover"
                                                            />
                                                            <div className="min-w-0">
                                                                <div className="truncate text-sm font-semibold text-white">{profile.username}</div>
                                                                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                                                                    {existingInvite ? existingInvite.status : 'Following'}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            {existingInvite?.status === 'pending' && (
                                                                <button
                                                                    type="button"
                                                                    disabled={roomBusy}
                                                                    onClick={() => void handleRevokeInvite(existingInvite.id)}
                                                                    className={`${compactActionClassName} disabled:opacity-60`}
                                                                >
                                                                    Revoke
                                                                </button>
                                                            )}
                                                            <button
                                                                type="button"
                                                                disabled={roomBusy || !canInvite}
                                                                onClick={() => void handleInviteProfile(profile.id)}
                                                                className="rounded-full border border-white/10 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-black transition-colors hover:bg-zinc-200 disabled:opacity-60"
                                                            >
                                                                {existingInvite?.status === 'pending' ? 'Sent' : 'Invite'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className={`${surfaceClassName} flex min-h-0 flex-col p-4`}>
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className={panelLabelClassName}>Room overview</div>
                                        <div className="mt-2 text-sm leading-6 text-zinc-400">
                                            {room?.selected_source
                                                ? room.status === 'live'
                                                    ? 'Playback is live. Host timing now drives guests in direct player mode.'
                                                    : countdownRemaining !== null
                                                        ? `Countdown is running: ${countdownRemaining}s.`
                                                        : needsGuestRecheck
                                                            ? 'Host source is locked. Pick a local source on this machine before countdown ends.'
                                                            : 'Source is locked. Start together when everyone is ready.'
                                                : 'Realtime presence for the current room.'}
                                        </div>
                                    </div>
                                    {room && (
                                        <button
                                            type="button"
                                            onClick={() => void handleSetReady(!isReady)}
                                            className={compactActionClassName}
                                        >
                                            {isReady ? 'Mark joined' : 'Mark ready'}
                                        </button>
                                    )}
                                </div>

                                <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                                    <div className={`${panelClassName} px-4 py-3`}>
                                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">Members</div>
                                        <div className="mt-2 text-xl font-semibold text-white">{members.length}</div>
                                    </div>
                                    <div className={`${panelClassName} px-4 py-3`}>
                                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">Status</div>
                                        <div className="mt-2 text-sm font-semibold capitalize text-white">{room?.status || 'idle'}</div>
                                    </div>
                                    <div className={`${panelClassName} px-4 py-3`}>
                                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">Source</div>
                                        <div className="mt-2 text-sm font-semibold text-white">{room?.selected_source ? 'Locked' : 'Pending'}</div>
                                    </div>
                                </div>

                                <div className="mt-4 min-h-0 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                                    {members.length === 0 ? (
                                        <div className={emptyStateClassName}>
                                            No room members yet.
                                        </div>
                                    ) : (
                                        members.map((member) => (
                                            <div key={member.user_id} className="flex items-center justify-between gap-3 rounded-[18px] border border-white/8 bg-black/20 px-3.5 py-3">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <img
                                                        src={member.profile?.avatar_url || `https://ui-avatars.com/api/?name=${member.profile?.username || member.user_id}`}
                                                        alt={member.profile?.username || member.user_id}
                                                        className="h-9 w-9 rounded-full border border-white/10 object-cover"
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="truncate text-sm font-semibold text-white">
                                                            {member.profile?.username || member.user_id}
                                                        </div>
                                                        <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                                                            <span>{member.role}</span>
                                                            <span className="opacity-40">•</span>
                                                            <span>{member.state}</span>
                                                            <span className="opacity-40">•</span>
                                                            <span>{isMemberOnline(member) ? 'online' : 'idle'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {member.role === 'host' && (
                                                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-200">
                                                        Host
                                                    </span>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>

                            {room?.selected_source && (
                                <div className="mt-4 border-t border-white/8 pt-4">
                                    <div className="flex items-start gap-2 text-[11px] leading-5 text-zinc-500">
                                        <Link2 size={12} className="mt-1 shrink-0" />
                                        <span className="line-clamp-2 break-all">{room.selected_source.resolvedUrl}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => void window.desktop?.openExternal(room.selected_source?.resolvedUrl || '')}
                                        className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-200 transition-colors hover:bg-white/[0.08]"
                                    >
                                        <ExternalLink size={12} />
                                        Open selected source
                                    </button>
                                </div>
                            )}
                            </div>

                            <div className={`${surfaceClassName} flex min-h-0 flex-col p-4`}>
                                <div className="flex items-center gap-2">
                                    <MessageSquare size={14} className="text-zinc-400" />
                                    <div className={panelLabelClassName}>Room chat</div>
                                </div>
                                <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                                    {messages.length === 0 ? (
                                        <div className={emptyStateClassName}>
                                            No room chat yet.
                                        </div>
                                    ) : (
                                        messages.map((message) => (
                                            <div key={message.id} className="rounded-[18px] border border-white/8 bg-black/20 px-3.5 py-3">
                                                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                                                    <span>{message.profile?.username || message.sender_id}</span>
                                                    <span className="opacity-40">•</span>
                                                    <span>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <div className="mt-2 text-sm text-white">{message.body}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                {room && (
                                    <div className="mt-4 flex gap-2 border-t border-white/8 pt-4">
                                        <input
                                            value={chatDraft}
                                            onChange={(event) => setChatDraft(event.target.value)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' && !event.shiftKey) {
                                                    event.preventDefault();
                                                    void handleSendMessage();
                                                }
                                            }}
                                            placeholder="Message the room"
                                            className="flex-1 rounded-[18px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => void handleSendMessage()}
                                            disabled={!chatDraft.trim()}
                                            className="rounded-[18px] border border-white/10 bg-white px-4 py-3 text-black transition-colors hover:bg-zinc-200 disabled:opacity-50"
                                        >
                                            <Send size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
