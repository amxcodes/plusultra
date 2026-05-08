import { supabase } from '../lib/supabase';
import type {
    Profile,
    PublicProfilePresence,
    WatchPartyHostPresence,
    WatchPartyInvite,
    WatchPartyMember,
    WatchPartyRoom,
    WatchPartyRoomMessage,
    WatchPartySelectedSource,
    WatchPartySourceCandidate,
    WatchPartySourceState,
    WatchPartyRoomStatus,
} from '../types';

type WatchPartyRoomRow = WatchPartyRoom;

type WatchPartyMemberRow = {
    room_id: string;
    user_id: string;
    role: 'host' | 'guest';
    state: 'joined' | 'ready' | 'left';
    joined_at: string;
    ready_at?: string | null;
    last_seen_at?: string | null;
    profile?: {
        id: string;
        username: string;
        avatar_url: string | null;
        created_at?: string | null;
    } | null;
};

const normalizeProfile = (profile?: WatchPartyMemberRow['profile']): Profile | undefined => {
    if (!profile?.id) return undefined;

    return {
        id: profile.id,
        username: profile.username,
        avatar_url: profile.avatar_url || '',
        created_at: profile.created_at || undefined,
    };
};

const normalizeMember = (row: WatchPartyMemberRow): WatchPartyMember => ({
    room_id: row.room_id,
    user_id: row.user_id,
    role: row.role,
    state: row.state,
    joined_at: row.joined_at,
    ready_at: row.ready_at ?? null,
    last_seen_at: row.last_seen_at ?? null,
    profile: normalizeProfile(row.profile),
});

type WatchPartyCandidateRow = WatchPartySourceCandidate;

type WatchPartyMessageRow = {
    id: string;
    room_id: string;
    sender_id: string;
    body: string;
    created_at: string;
    profile?: WatchPartyMemberRow['profile'] | null;
};

type WatchPartyInviteRow = {
    id: string;
    room_id: string;
    sender_id: string;
    recipient_id: string;
    status: 'pending' | 'accepted' | 'declined' | 'revoked';
    created_at: string;
    responded_at?: string | null;
    recipient_profile?: WatchPartyMemberRow['profile'] | null;
};

type WatchPartyHostPresenceRow = {
    host_id: string;
    room_id: string;
    room_code: string;
    title?: string | null;
    media_type: 'movie' | 'tv';
    season?: number | null;
    episode?: number | null;
    status: WatchPartyRoomStatus;
    started_at: string;
};

type PublicProfilePresenceRow = {
    user_id: string;
    state: PublicProfilePresence['state'];
    last_seen_at?: string | null;
    activity_mode?: string | null;
    room_id?: string | null;
    room_code?: string | null;
    room_title?: string | null;
    room_media_type?: 'movie' | 'tv' | null;
    room_season?: number | null;
    room_episode?: number | null;
    room_status?: WatchPartyRoomStatus | null;
    watch_title?: string | null;
    viewer_is_following: boolean;
    viewer_has_pending_invite: boolean;
    viewer_is_room_member: boolean;
    is_joinable: boolean;
};

const normalizeRoom = (row: WatchPartyRoomRow): WatchPartyRoom => ({
    ...row,
    selected_source: row.selected_source ?? null,
    source_state: row.source_state || 'pending',
    status: row.status || 'setup',
    current_time_seconds: row.current_time_seconds || 0,
    is_paused: row.is_paused ?? true,
    countdown_started_at: row.countdown_started_at ?? null,
    countdown_seconds: row.countdown_seconds ?? null,
});

const normalizeCandidate = (row: WatchPartyCandidateRow): WatchPartySourceCandidate => ({
    ...row,
    provider_label: row.provider_label ?? null,
    server_id: row.server_id ?? null,
    server_label: row.server_label ?? null,
    quality_label: row.quality_label ?? null,
    required_headers: row.required_headers ?? null,
    expires_at: row.expires_at ?? null,
    note: row.note ?? null,
});

const normalizeMessage = (row: WatchPartyMessageRow): WatchPartyRoomMessage => ({
    id: row.id,
    room_id: row.room_id,
    sender_id: row.sender_id,
    body: row.body,
    created_at: row.created_at,
    profile: normalizeProfile(row.profile),
});

const normalizeInvite = (row: WatchPartyInviteRow): WatchPartyInvite => ({
    id: row.id,
    room_id: row.room_id,
    sender_id: row.sender_id,
    recipient_id: row.recipient_id,
    status: row.status,
    created_at: row.created_at,
    responded_at: row.responded_at ?? null,
    recipient_profile: normalizeProfile(row.recipient_profile),
});

const normalizeHostPresence = (row: WatchPartyHostPresenceRow): WatchPartyHostPresence => ({
    host_id: row.host_id,
    room_id: row.room_id,
    room_code: row.room_code,
    title: row.title ?? null,
    media_type: row.media_type,
    season: row.season ?? null,
    episode: row.episode ?? null,
    status: row.status,
    started_at: row.started_at,
});

const normalizePublicPresence = (row: PublicProfilePresenceRow): PublicProfilePresence => ({
    user_id: row.user_id,
    state: row.state,
    last_seen_at: row.last_seen_at ?? null,
    activity_mode: row.activity_mode ?? null,
    room_id: row.room_id ?? null,
    room_code: row.room_code ?? null,
    room_title: row.room_title ?? null,
    room_media_type: row.room_media_type ?? null,
    room_season: row.room_season ?? null,
    room_episode: row.room_episode ?? null,
    room_status: row.room_status ?? null,
    watch_title: row.watch_title ?? null,
    viewer_is_following: row.viewer_is_following,
    viewer_has_pending_invite: row.viewer_has_pending_invite,
    viewer_is_room_member: row.viewer_is_room_member,
    is_joinable: row.is_joinable,
});

const WATCH_PARTY_STORAGE_PREFIX = 'plusultra:watch-party';

const getWatchPartyStorageKey = (
    userId: string,
    room: Pick<WatchPartyRoom, 'tmdb_id' | 'media_type' | 'season' | 'episode'>
) => `${WATCH_PARTY_STORAGE_PREFIX}:${userId}:${room.tmdb_id}:${room.media_type}:${room.season || 1}:${room.episode || 1}`;

export const WatchPartyService = {
    async createRoom(input: {
        tmdbId: string;
        mediaType: 'movie' | 'tv';
        season?: number;
        episode?: number;
        title?: string;
    }): Promise<WatchPartyRoom | null> {
        const { data, error } = await supabase.rpc('create_watch_party_room', {
            p_tmdb_id: input.tmdbId,
            p_media_type: input.mediaType,
            p_season: input.mediaType === 'tv' ? (input.season || 1) : null,
            p_episode: input.mediaType === 'tv' ? (input.episode || 1) : null,
            p_title: input.title || null,
        });

        if (error) throw error;
        const rows = (data || []) as WatchPartyRoomRow[];
        return rows[0] ? normalizeRoom(rows[0]) : null;
    },

    async joinRoom(roomCode: string): Promise<WatchPartyRoom | null> {
        const { data, error } = await supabase.rpc('join_watch_party_room', {
            p_room_code: roomCode,
        });

        if (error) throw error;
        const rows = (data || []) as WatchPartyRoomRow[];
        return rows[0] ? normalizeRoom(rows[0]) : null;
    },

    async joinRoomById(roomId: string): Promise<WatchPartyRoom | null> {
        const { data, error } = await supabase.rpc('join_watch_party_room_by_id', {
            p_room_id: roomId,
        });

        if (error) throw error;
        const rows = (data || []) as WatchPartyRoomRow[];
        return rows[0] ? normalizeRoom(rows[0]) : null;
    },

    async getRoom(roomId: string): Promise<WatchPartyRoom | null> {
        const { data, error } = await supabase
            .from('watch_party_rooms')
            .select('*')
            .eq('id', roomId)
            .maybeSingle();

        if (error) throw error;
        return data ? normalizeRoom(data as WatchPartyRoomRow) : null;
    },

    async listRoomMembers(roomId: string): Promise<WatchPartyMember[]> {
        const { data, error } = await supabase.rpc('list_watch_party_room_members', {
            p_room_id: roomId,
        });

        if (error) throw error;
        return ((data || []) as WatchPartyMemberRow[]).map(normalizeMember);
    },

    async listSourceCandidates(roomId: string): Promise<WatchPartySourceCandidate[]> {
        const { data, error } = await supabase.rpc('list_watch_party_source_candidates', {
            p_room_id: roomId,
        });

        if (error) throw error;
        return ((data || []) as WatchPartyCandidateRow[]).map(normalizeCandidate);
    },

    async listRoomInvites(roomId: string): Promise<WatchPartyInvite[]> {
        const { data, error } = await supabase.rpc('list_watch_party_room_invites', {
            p_room_id: roomId,
        });

        if (error) throw error;
        return ((data || []) as WatchPartyInviteRow[]).map(normalizeInvite);
    },

    async listHostPresence(userIds: string[]): Promise<WatchPartyHostPresence[]> {
        const dedupedUserIds = Array.from(new Set(userIds.filter(Boolean)));
        if (dedupedUserIds.length === 0) return [];

        const { data, error } = await supabase.rpc('list_watch_party_host_presence', {
            p_user_ids: dedupedUserIds,
        });

        if (error) throw error;
        return ((data || []) as WatchPartyHostPresenceRow[]).map(normalizeHostPresence);
    },

    async listPublicPresence(userIds: string[]): Promise<PublicProfilePresence[]> {
        const dedupedUserIds = Array.from(new Set(userIds.filter(Boolean)));
        if (dedupedUserIds.length === 0) return [];

        const { data, error } = await supabase.rpc('list_public_profile_presence', {
            p_user_ids: dedupedUserIds,
        });

        if (error) throw error;
        return ((data || []) as PublicProfilePresenceRow[]).map(normalizePublicPresence);
    },

    async createInvites(roomId: string, recipientIds: string[]): Promise<WatchPartyInvite[]> {
        const dedupedRecipientIds = Array.from(new Set(recipientIds.filter(Boolean)));
        if (dedupedRecipientIds.length === 0) return [];

        const { data, error } = await supabase.rpc('create_watch_party_room_invites', {
            p_room_id: roomId,
            p_recipient_ids: dedupedRecipientIds,
        });

        if (error) throw error;
        return ((data || []) as WatchPartyInviteRow[]).map(normalizeInvite);
    },

    async acceptInvite(inviteId: string): Promise<WatchPartyRoom | null> {
        const { data, error } = await supabase.rpc('accept_watch_party_room_invite', {
            p_invite_id: inviteId,
        });

        if (error) throw error;
        const rows = (data || []) as WatchPartyRoomRow[];
        return rows[0] ? normalizeRoom(rows[0]) : null;
    },

    async declineInvite(inviteId: string): Promise<WatchPartyInvite | null> {
        const { data, error } = await supabase.rpc('decline_watch_party_room_invite', {
            p_invite_id: inviteId,
        });

        if (error) throw error;
        const rows = (data || []) as WatchPartyInviteRow[];
        return rows[0] ? normalizeInvite(rows[0]) : null;
    },

    async revokeInvite(inviteId: string): Promise<WatchPartyInvite | null> {
        const { data, error } = await supabase.rpc('revoke_watch_party_room_invite', {
            p_invite_id: inviteId,
        });

        if (error) throw error;
        const rows = (data || []) as WatchPartyInviteRow[];
        return rows[0] ? normalizeInvite(rows[0]) : null;
    },

    async upsertSourceCandidate(input: {
        roomId: string;
        candidateId: string;
        providerId: string;
        providerLabel?: string | null;
        serverId?: string | null;
        serverLabel?: string | null;
        resolvedUrl: string;
        sourceType: WatchPartySelectedSource['sourceType'];
        qualityLabel?: string | null;
        requiredHeaders?: Record<string, string> | null;
        expiresAt?: string | null;
        portability: WatchPartySourceState;
        status?: WatchPartySourceCandidate['status'];
        note?: string | null;
    }): Promise<WatchPartySourceCandidate | null> {
        const { data, error } = await supabase.rpc('upsert_watch_party_source_candidate', {
            p_room_id: input.roomId,
            p_candidate_id: input.candidateId,
            p_provider_id: input.providerId,
            p_provider_label: input.providerLabel || null,
            p_server_id: input.serverId || null,
            p_server_label: input.serverLabel || null,
            p_resolved_url: input.resolvedUrl,
            p_source_type: input.sourceType,
            p_quality_label: input.qualityLabel || null,
            p_required_headers: input.requiredHeaders || null,
            p_expires_at: input.expiresAt || null,
            p_portability: input.portability,
            p_status: input.status || 'discovered',
            p_note: input.note || null,
        });

        if (error) throw error;
        const rows = (data || []) as WatchPartyCandidateRow[];
        return rows[0] ? normalizeCandidate(rows[0]) : null;
    },

    async setSelectedSource(input: {
        roomId: string;
        providerId: string;
        providerLabel: string;
        serverId?: string | null;
        serverLabel?: string | null;
        selectedSource: WatchPartySelectedSource;
        sourceState: WatchPartySourceState;
        status?: WatchPartyRoomStatus;
    }): Promise<WatchPartyRoom | null> {
        const { data, error } = await supabase.rpc('update_watch_party_selected_source', {
            p_room_id: input.roomId,
            p_provider_id: input.providerId,
            p_provider_label: input.providerLabel,
            p_server_id: input.serverId || null,
            p_server_label: input.serverLabel || null,
            p_selected_source: input.selectedSource,
            p_source_state: input.sourceState,
            p_status: input.status || 'ready',
        });

        if (error) throw error;
        const rows = (data || []) as WatchPartyRoomRow[];
        return rows[0] ? normalizeRoom(rows[0]) : null;
    },

    async setReady(roomId: string, isReady: boolean): Promise<WatchPartyMember | null> {
        const { data, error } = await supabase.rpc('set_watch_party_member_ready', {
            p_room_id: roomId,
            p_is_ready: isReady,
        });

        if (error) throw error;
        const rows = (data || []) as WatchPartyMemberRow[];
        return rows[0] ? normalizeMember(rows[0]) : null;
    },

    async touchPresence(roomId: string): Promise<WatchPartyMember | null> {
        const { data, error } = await supabase.rpc('touch_watch_party_member_presence', {
            p_room_id: roomId,
        });

        if (error) throw error;
        const rows = (data || []) as WatchPartyMemberRow[];
        return rows[0] ? normalizeMember(rows[0]) : null;
    },

    async leaveRoom(roomId: string): Promise<WatchPartyMember | null> {
        const { data, error } = await supabase.rpc('leave_watch_party_room', {
            p_room_id: roomId,
        });

        if (error) throw error;
        const rows = (data || []) as WatchPartyMemberRow[];
        return rows[0] ? normalizeMember(rows[0]) : null;
    },

    async endRoom(roomId: string): Promise<WatchPartyRoom | null> {
        const { data, error } = await supabase.rpc('end_watch_party_room', {
            p_room_id: roomId,
        });

        if (error) throw error;
        const rows = (data || []) as WatchPartyRoomRow[];
        return rows[0] ? normalizeRoom(rows[0]) : null;
    },

    async startCountdown(roomId: string, countdownSeconds = 10): Promise<WatchPartyRoom | null> {
        const { data, error } = await supabase.rpc('start_watch_party_countdown', {
            p_room_id: roomId,
            p_countdown_seconds: countdownSeconds,
        });

        if (error) throw error;
        const rows = (data || []) as WatchPartyRoomRow[];
        return rows[0] ? normalizeRoom(rows[0]) : null;
    },

    async updatePlayback(input: {
        roomId: string;
        currentTimeSeconds?: number;
        isPaused?: boolean;
        status?: WatchPartyRoomStatus;
    }): Promise<WatchPartyRoom | null> {
        const { data, error } = await supabase.rpc('update_watch_party_playback', {
            p_room_id: input.roomId,
            p_current_time_seconds: input.currentTimeSeconds ?? null,
            p_is_paused: input.isPaused ?? null,
            p_status: input.status ?? null,
        });

        if (error) throw error;
        const rows = (data || []) as WatchPartyRoomRow[];
        return rows[0] ? normalizeRoom(rows[0]) : null;
    },

    async listMessages(roomId: string, limit = 50): Promise<WatchPartyRoomMessage[]> {
        const { data, error } = await supabase.rpc('list_watch_party_room_messages', {
            p_room_id: roomId,
            p_limit: limit,
        });

        if (error) throw error;
        return ((data || []) as WatchPartyMessageRow[]).map(normalizeMessage).reverse();
    },

    async sendMessage(roomId: string, body: string): Promise<WatchPartyRoomMessage | null> {
        const { data, error } = await supabase.rpc('send_watch_party_room_message', {
            p_room_id: roomId,
            p_body: body,
        });

        if (error) throw error;
        const rows = (data || []) as WatchPartyMessageRow[];
        return rows[0] ? normalizeMessage(rows[0]) : null;
    },

    persistDesktopRoomLink(userId: string, room: WatchPartyRoom, localSourceOverride: WatchPartySelectedSource | null = null) {
        if (typeof window === 'undefined' || !window.desktop?.isDesktop || !userId) return;

        window.localStorage.setItem(getWatchPartyStorageKey(userId, room), JSON.stringify({
            roomId: room.id,
            localSourceOverride,
        }));
    },

    subscribeToRoom(roomId: string, handlers: {
        onRoomChange?: () => void;
        onMembersChange?: () => void;
        onCandidatesChange?: () => void;
        onMessagesChange?: () => void;
        onInvitesChange?: () => void;
    }): () => void {
        const roomChannel = supabase
            .channel(`watch-party-room-${roomId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'watch_party_rooms', filter: `id=eq.${roomId}` },
                () => handlers.onRoomChange?.()
            )
            .subscribe();

        const memberChannel = supabase
            .channel(`watch-party-members-${roomId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'watch_party_room_members', filter: `room_id=eq.${roomId}` },
                () => handlers.onMembersChange?.()
            )
            .subscribe();

        const candidateChannel = supabase
            .channel(`watch-party-candidates-${roomId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'watch_party_source_candidates', filter: `room_id=eq.${roomId}` },
                () => handlers.onCandidatesChange?.()
            )
            .subscribe();

        const messageChannel = supabase
            .channel(`watch-party-messages-${roomId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'watch_party_room_messages', filter: `room_id=eq.${roomId}` },
                () => handlers.onMessagesChange?.()
            )
            .subscribe();

        const inviteChannel = supabase
            .channel(`watch-party-invites-${roomId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'watch_party_room_invites', filter: `room_id=eq.${roomId}` },
                () => handlers.onInvitesChange?.()
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(roomChannel);
            void supabase.removeChannel(memberChannel);
            void supabase.removeChannel(candidateChannel);
            void supabase.removeChannel(messageChannel);
            void supabase.removeChannel(inviteChannel);
        };
    },
};
