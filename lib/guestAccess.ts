import type { Profile } from '../types';

export const isGuestAccount = (profile: Pick<Profile, 'account_kind'> | null | undefined) =>
    profile?.account_kind === 'guest';

export const isGuestExpired = (
    profile: Pick<Profile, 'account_kind' | 'guest_expires_at'> | null | undefined,
    now = Date.now()
) => {
    if (!isGuestAccount(profile) || !profile?.guest_expires_at) return false;
    const expiresAt = new Date(profile.guest_expires_at).getTime();
    return Number.isFinite(expiresAt) && expiresAt <= now;
};

export const formatGuestExpiry = (expiresAt?: string | null) => {
    if (!expiresAt) return 'No expiry';
    const value = new Date(expiresAt);
    if (Number.isNaN(value.getTime())) return 'No expiry';

    return value.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
};

