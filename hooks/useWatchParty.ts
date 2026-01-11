import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { SyncEvent, PartyMember, WatchTogetherService } from '../lib/watchTogether';
import { RealtimeChannel } from '@supabase/supabase-js';

export const useWatchParty = (partyId: string | null, onSync: (e: SyncEvent) => void, isHost: boolean = false) => {
    const { user } = useAuth();
    const [members, setMembers] = useState<PartyMember[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const channelRef = useRef<RealtimeChannel | null>(null);

    useEffect(() => {
        if (!partyId || !user) return;

        console.log(`[useWatchParty] Initializing connection to party:${partyId}`);

        // 1. Clean up existing channel if any
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }

        // 2. Create new channel
        const channel = supabase.channel(`party:${partyId}`, {
            config: {
                presence: {
                    key: user.id
                }
            }
        });
        channelRef.current = channel;

        // 3. Setup Listeners
        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                console.log('[useWatchParty] Presence Sync:', state);
                const currentMembers = Object.values(state).flat().map((p: any) => ({
                    userId: p.user_id,
                    username: p.username || 'User',
                    avatar: p.avatar || ''
                }));
                setMembers(currentMembers);
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                console.log('[useWatchParty] Member Joined:', key, newPresences);
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                console.log('[useWatchParty] Member Left:', key, leftPresences);
            })
            .on('broadcast', { event: 'sync' }, ({ payload }) => {
                console.log('[useWatchParty] Received Sync Event:', payload);
                if (payload.userId !== user.id) {
                    onSync(payload);
                }
            })
            .subscribe(async (status) => {
                console.log(`[useWatchParty] Subscription Status: ${status}`);
                if (status === 'SUBSCRIBED') {
                    setIsConnected(true);
                    const trackResult = await channel.track({
                        user_id: user.id,
                        username: user.user_metadata?.username || 'User', // Fallback
                        avatar: user.user_metadata?.avatar_url || ''
                    });
                    console.log('[useWatchParty] Track Result:', trackResult);
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.error(`[useWatchParty] Connection failed: ${status}`);
                    setIsConnected(false);
                }
            });

        return () => {
            console.log('[useWatchParty] Cleaning up channel...');
            if (channelRef.current) {
                const channel = channelRef.current; // capture ref
                // Untrack before leaving
                channel.untrack().then(() => {
                    supabase.removeChannel(channel);
                });
                channelRef.current = null;

                if (isHost && partyId) {
                    console.log('[useWatchParty] Host leaving, ending party...');
                    WatchTogetherService.endParty(partyId);
                }
            }
        };
    }, [partyId, user, isHost]); // Re-run only if Party ID or User changes

    // Helper to send sync events
    const sendSync = useCallback(async (event: Omit<SyncEvent, 'userId' | 'username'>) => {
        if (!channelRef.current || !user) return;

        await channelRef.current.send({
            type: 'broadcast',
            event: 'sync',
            payload: {
                ...event,
                userId: user.id,
                username: user.user_metadata?.username || 'User'
            }
        });
    }, [user]);

    return { members, isConnected, sendSync };
};
