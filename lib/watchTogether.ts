
import { supabase } from './supabase';
import { useAuth } from './AuthContext';

export interface WatchParty {
    id: string;
    host_id: string;
    tmdb_id: string;
    media_type: 'movie' | 'tv';
    season?: number;
    episode?: number;
    current_server: string;
    invite_code: string;
    created_at: string;
    expires_at: string;
    max_participants: number;
}

export interface SyncEvent {
    type: 'play' | 'pause' | 'seek' | 'switch_server' | 'sync_timestamp';
    timestamp?: number;
    server?: string;
    userId: string;
    username: string;
}

export interface PartyMember {
    userId: string;
    username: string;
    avatar: string;
}

export const WatchTogetherService = {
    // Create query - DB ONLY
    async createParty(
        tmdbId: string,
        mediaType: 'movie' | 'tv',
        season?: number,
        episode?: number
    ): Promise<WatchParty | null> {
        console.warn('[WatchParty] Legacy DB-backed watch parties are disabled. Use the extension flow instead.');
        return null;
    },

    // Join query - DB ONLY
    async joinParty(inviteCode: string): Promise<WatchParty | null> {
        console.warn('[WatchParty] Legacy DB-backed watch parties are disabled.');
        return null;
    },

    // Unified Connection Logic
    async connectToParty(partyId: string, onSync: (e: SyncEvent) => void, onPresence: (m: PartyMember[]) => void) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        console.log(`[WatchParty] Connecting to ${partyId}...`);

        const channel = supabase.channel(`party:${partyId}`, {
            config: { presence: { key: user.id } }
        });

        // 1. Subscribe
        channel.subscribe(async (status) => {
            console.log(`[WatchParty] Subscription status: ${status}`);
            if (status === 'SUBSCRIBED') {
                // 2. Track Presence (Full Metadata)
                await channel.track({
                    user_id: user.id,
                    username: user.user_metadata?.username || 'User',
                    avatar: user.user_metadata?.avatar_url || ''
                });
            }
        });

        // 3. Listen for Sync Events
        channel.on('broadcast', { event: 'sync' }, ({ payload }: { payload: SyncEvent }) => {
            onSync(payload);
        });

        // 4. Listen for Presence Changes
        const updatePresence = () => {
            const state = channel.presenceState();
            const members = Object.values(state).flat().map((p: any) => ({
                userId: p.user_id,
                username: p.username || 'User',
                avatar: p.avatar || ''
            }));
            onPresence(members);
        };
        channel.on('presence', { event: 'sync' }, updatePresence);
        channel.on('presence', { event: 'join' }, updatePresence);
        channel.on('presence', { event: 'leave' }, updatePresence);

        return channel;
    },

    // Get party details without joining (for auto-join routing)
    async getPartyDetails(inviteCode: string): Promise<WatchParty | null> {
        console.warn('[WatchParty] Legacy DB-backed watch parties are disabled.');
        return null;
    },

    // Leave party and cleanup
    async leaveParty(channel: any) {
        if (channel) {
            await channel.untrack();
            await channel.unsubscribe();
        }
    },

    // End party (host only) - deletes from database
    async endParty(partyId: string) {
        console.warn('[WatchParty] Legacy DB-backed watch parties are disabled.');
    },

    // Broadcast sync event to all participants
    broadcastSync(channel: any, event: Omit<SyncEvent, 'userId' | 'username'>) {
        return supabase.auth.getUser().then(({ data: { user } }) => {
            if (user && channel) {
                channel.send({
                    type: 'broadcast',
                    event: 'sync',
                    payload: { ...event, userId: user.id, username: user.user_metadata?.username || 'User' }
                });
            }
        });
    },

    // Get current participants (helper)
    getPresence(channel: any): PartyMember[] {
        if (!channel) return [];
        const state = channel.presenceState();
        return Object.values(state).flat().map((p: any) => ({
            userId: p.user_id,
            username: p.username || 'User',
            avatar: p.avatar || ''
        }));
    }
};
