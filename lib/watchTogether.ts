
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
    // Create a new watch party
    async createParty(
        tmdbId: string,
        mediaType: 'movie' | 'tv',
        season?: number,
        episode?: number
    ): Promise<{ party: WatchParty; channel: any } | null> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('watch_parties')
            .insert({
                host_id: user.id,
                tmdb_id: tmdbId,
                media_type: mediaType,
                season,
                episode
            })
            .select()
            .single();

        if (error || !data) {
            console.error('Error creating party:', error);
            return null;
        }

        // Join the realtime channel
        const channel = supabase.channel(`party:${data.id}`, {
            config: { presence: { key: user.id } }
        });

        // Debug: Log subscription status
        channel.subscribe(async (status) => {
            console.log(`[WatchParty] Host subscription status: ${status}`);
            if (status === 'SUBSCRIBED') {
                const trackStatus = await channel.track({
                    user_id: user.id,
                    username: user.user_metadata?.username || 'Host',
                    avatar: user.user_metadata?.avatar_url || ''
                });
                console.log('[WatchParty] Host track result:', trackStatus);
            }
        });

        return { party: data, channel };
    },

    // Join existing party by invite code
    async joinParty(inviteCode: string): Promise<{ party: WatchParty; channel: any } | null> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('watch_parties')
            .select('*')
            .eq('invite_code', inviteCode.toUpperCase())
            .single();

        if (error || !data) {
            console.error('Party not found:', error);
            return null;
        }

        // Check participant limit via presence
        const channel = supabase.channel(`party:${data.id}`, {
            config: { presence: { key: user.id } }
        });

        channel.subscribe(async (status) => {
            console.log(`[WatchParty] Joiner subscription status: ${status}`);
            if (status === 'SUBSCRIBED') {
                const trackStatus = await channel.track({
                    user_id: user.id,
                    username: user.user_metadata?.username || 'User',
                    avatar: user.user_metadata?.avatar_url || ''
                });
                console.log('[WatchParty] Joiner track result:', trackStatus);
            }
        });

        // Count current participants
        // Note: Presence might not be immediately available, but we check what we can
        const presence = channel.presenceState();
        const participantCount = Object.keys(presence).length;

        if (participantCount > data.max_participants) {
            await channel.untrack();
            await channel.unsubscribe();
            console.error('Party is full');
            return null;
        }

        return { party: data, channel };
    },

    // Get party details without joining (for auto-join routing)
    async getPartyDetails(inviteCode: string): Promise<WatchParty | null> {
        const { data, error } = await supabase
            .from('watch_parties')
            .select('*')
            .eq('invite_code', inviteCode.toUpperCase())
            .single();

        if (error) return null;
        return data;
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
        const { error } = await supabase
            .from('watch_parties')
            .delete()
            .eq('id', partyId);

        if (error) {
            console.error('Error ending party:', error);
        }
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

    // Subscribe to sync events
    onSyncReceived(channel: any, callback: (event: SyncEvent) => void) {
        if (!channel) return;

        channel.on('broadcast', { event: 'sync' }, ({ payload }: { payload: SyncEvent }) => {
            callback(payload);
        });
    },

    // Get current participants
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
