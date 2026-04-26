const normalizeValue = (value?: string) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
};

const readTurnstileSiteKey = () => normalizeValue(import.meta.env.VITE_TURNSTILE_SITE_KEY);

export const env = {
    supabaseUrl: normalizeValue(import.meta.env.VITE_SUPABASE_URL),
    supabaseAnonKey: normalizeValue(import.meta.env.VITE_SUPABASE_ANON_KEY),
    turnstileSiteKey: readTurnstileSiteKey(),
    desktopDisableTurnstile: normalizeValue(import.meta.env.VITE_DESKTOP_DISABLE_TURNSTILE) === 'true',
};

export const getTurnstileClientErrorMessage = (errorCode?: string | number | null) => {
    const code = String(errorCode || '').trim();
    if (code === '400020' || code === '110100') {
        return 'Security check failed: the configured Turnstile site key is invalid. Verify VITE_TURNSTILE_SITE_KEY in your build env and Cloudflare Turnstile dashboard.';
    }

    if (code === '110110') {
        return 'Security check failed: the configured Turnstile site key was not found. Verify the exact site key value in Cloudflare.';
    }

    if (code === '110200') {
        return 'Security check failed: this domain is not authorized for the configured Turnstile site key. Add the current hostname in Cloudflare Turnstile.';
    }

    if (code === '200500') {
        return 'Security check failed because the Turnstile iframe could not load. Check whether challenges.cloudflare.com is blocked.';
    }

    return `Security check failed${code ? ` (${code})` : ''}. Try refreshing the widget or using a different browser/network.`;
};
