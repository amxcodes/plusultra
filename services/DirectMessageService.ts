import { supabase } from '../lib/supabase';
import type { DirectConversation, DirectMessage, Profile, SharedMoviePayload } from '../types';

type ConversationRpcRow = {
    id: string;
    user_a: string;
    user_b: string;
    created_at: string;
    updated_at: string;
    last_message_at: string;
    last_message_preview?: string | null;
    last_message_sender_id?: string | null;
    unread_count?: number | null;
    other_profile?: {
        id: string;
        username: string;
        avatar_url: string | null;
        created_at?: string | null;
    } | null;
};

type MessageableProfileRow = {
    id: string;
    username: string;
    avatar_url: string | null;
    created_at?: string | null;
};

type DirectMessageRow = {
    id: string;
    conversation_id: string;
    sender_id: string;
    recipient_id: string;
    message_type: 'text' | 'movie_share';
    body?: string | null;
    shared_movie?: SharedMoviePayload | null;
    created_at: string;
    read_at?: string | null;
};

const normalizeProfile = (row: MessageableProfileRow): Profile => ({
    id: row.id,
    username: row.username,
    avatar_url: row.avatar_url || '',
    created_at: row.created_at || undefined,
});

const normalizeConversation = (row: ConversationRpcRow): DirectConversation => ({
    id: row.id,
    participantIds: [row.user_a, row.user_b],
    otherProfile: normalizeProfile({
        id: row.other_profile?.id || '',
        username: row.other_profile?.username || 'Unknown',
        avatar_url: row.other_profile?.avatar_url || '',
        created_at: row.other_profile?.created_at || undefined,
    }),
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_message_at: row.last_message_at,
    last_message_preview: row.last_message_preview ?? null,
    last_message_sender_id: row.last_message_sender_id ?? null,
    unread_count: row.unread_count || 0,
});

const normalizeMessage = (row: DirectMessageRow): DirectMessage => ({
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    recipient_id: row.recipient_id,
    message_type: row.message_type,
    body: row.body ?? null,
    shared_movie: row.shared_movie ?? null,
    created_at: row.created_at,
    read_at: row.read_at ?? null,
});

export const DirectMessageService = {
    async listMessageableProfiles(): Promise<Profile[]> {
        const { data, error } = await supabase.rpc('list_messageable_profiles');

        if (error) {
            console.error('Error loading messageable profiles:', error);
            return [];
        }

        return ((data || []) as MessageableProfileRow[]).map(normalizeProfile);
    },

    async listDirectConversations(): Promise<DirectConversation[]> {
        const { data, error } = await supabase.rpc('list_direct_conversations');

        if (error) {
            console.error('Error loading conversations:', error);
            return [];
        }

        return ((data || []) as ConversationRpcRow[]).map(normalizeConversation);
    },

    async getOrCreateDirectConversation(otherUserId: string): Promise<DirectConversation | null> {
        const { data, error } = await supabase.rpc('get_or_create_direct_conversation', {
            p_other_user_id: otherUserId,
        });

        if (error) {
            throw error;
        }

        const rows = (data || []) as ConversationRpcRow[];
        return rows[0] ? normalizeConversation(rows[0]) : null;
    },

    async listDirectMessages(conversationId: string): Promise<DirectMessage[]> {
        const { data, error } = await supabase.rpc('list_direct_messages', {
            p_conversation_id: conversationId,
            p_limit: 200,
        });

        if (error) {
            console.error('Error loading direct messages:', error);
            return [];
        }

        return ((data || []) as DirectMessageRow[]).map(normalizeMessage);
    },

    async sendTextMessage(otherUserId: string, body: string): Promise<DirectMessage | null> {
        const { data, error } = await supabase.rpc('send_direct_message', {
            p_other_user_id: otherUserId,
            p_body: body,
            p_message_type: 'text',
            p_shared_movie: null,
        });

        if (error) {
            throw error;
        }

        const rows = (data || []) as DirectMessageRow[];
        return rows[0] ? normalizeMessage(rows[0]) : null;
    },

    async sendMovieShare(otherUserId: string, movie: SharedMoviePayload, message?: string): Promise<DirectMessage | null> {
        const { data, error } = await supabase.rpc('send_direct_message', {
            p_other_user_id: otherUserId,
            p_body: message || null,
            p_message_type: 'movie_share',
            p_shared_movie: movie,
        });

        if (error) {
            throw error;
        }

        const rows = (data || []) as DirectMessageRow[];
        return rows[0] ? normalizeMessage(rows[0]) : null;
    },

    async markConversationRead(conversationId: string): Promise<void> {
        const { error } = await supabase.rpc('mark_direct_conversation_read', {
            p_conversation_id: conversationId,
        });

        if (error) {
            throw error;
        }
    },

    subscribeToInbox(userId: string, onChange: () => void): () => void {
        const conversationChannel = supabase
            .channel(`direct-conversations-${userId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'direct_conversations' },
                () => onChange()
            )
            .subscribe();

        const messageChannel = supabase
            .channel(`direct-messages-${userId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'direct_messages' },
                () => onChange()
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(conversationChannel);
            void supabase.removeChannel(messageChannel);
        };
    },
};
