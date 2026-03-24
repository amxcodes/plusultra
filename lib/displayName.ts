export const getDisplayName = (value?: string | null): string => {
    const trimmed = value?.trim() || '';
    if (!trimmed) return 'Unknown';

    const isEmailLike = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    if (!isEmailLike) {
        return trimmed;
    }

    const atIndex = trimmed.indexOf('@');
    return trimmed.slice(0, atIndex);
};
