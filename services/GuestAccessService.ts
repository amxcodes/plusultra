import { supabase } from '../lib/supabase';

export interface GuestAccessLink {
    id: string;
    token?: string;
    expires_at: string;
    max_uses: number;
    used_count: number;
    status: 'active' | 'disabled' | 'expired' | 'exhausted';
    note: string | null;
    created_at: string;
    created_by?: string | null;
    created_by_username?: string | null;
    redeemed_profile_id?: string | null;
    redeemed_username?: string | null;
}

export interface GuestAccountSummary {
    id: string;
    username: string;
    avatar_url: string | null;
    can_stream: boolean | null;
    account_kind: 'standard' | 'guest';
    created_at: string;
    guest_expires_at: string | null;
    guest_secured_at: string | null;
    is_guest_hidden: boolean;
    guest_link_id: string | null;
    guest_created_by: string | null;
    created_by_username: string | null;
    is_expired: boolean;
}

export interface GuestAccessInspection {
    status: 'active' | 'disabled' | 'expired' | 'exhausted' | 'invalid';
    expires_at: string | null;
    remaining_uses: number;
    can_redeem: boolean;
    reason: string | null;
}

export const GuestAccessService = {
    async createGuestAccessLink(expiresAt: string, maxUses = 1, note?: string | null) {
        const { data, error } = await supabase
            .rpc('admin_create_guest_access_link', {
                p_expires_at: expiresAt,
                p_max_uses: maxUses,
                p_note: note || null,
            })
            .single();

        if (error) throw error;
        return data as GuestAccessLink;
    },

    async getGuestAccessLinks(limit = 50) {
        const { data, error } = await supabase
            .rpc('admin_get_guest_access_links', {
                p_limit: limit,
            });

        if (error) throw error;
        return (data || []) as GuestAccessLink[];
    },

    async getGuestAccounts(limit = 100) {
        const { data, error } = await supabase
            .rpc('admin_get_guest_accounts', {
                p_limit: limit,
            });

        if (error) throw error;
        return (data || []) as GuestAccountSummary[];
    },

    async redeemGuestAccessLink(token: string) {
        const { data, error } = await supabase.rpc('redeem_guest_access_link', {
            p_token: token,
        });

        if (error) throw error;
        return data;
    },

    async inspectGuestAccessLink(token: string) {
        const { data, error } = await supabase
            .rpc('inspect_guest_access_link', {
                p_token: token,
            })
            .single();

        if (error) throw error;
        return data as GuestAccessInspection;
    },

    async cleanupUnclaimedGuestSession() {
        const { error } = await supabase.rpc('cleanup_unclaimed_guest_session');
        if (error) throw error;
    },

    async secureGuestAccount() {
        const { data, error } = await supabase.rpc('secure_guest_account');
        if (error) throw error;
        return data;
    },

    async extendGuestAccess(userId: string, expiresAt: string) {
        const { error } = await supabase.rpc('admin_extend_guest_access', {
            p_user_id: userId,
            p_expires_at: expiresAt,
        });

        if (error) throw error;
    },

    async disableGuestLink(linkId: string) {
        const { error } = await supabase.rpc('admin_disable_guest_link', {
            p_link_id: linkId,
        });

        if (error) throw error;
    },
};
