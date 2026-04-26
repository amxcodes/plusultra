export const REMEMBER_ME_PREFERENCE_KEY = 'AMX_REMEMBER_ME';
export const LEGACY_SESSION_ACTIVE_KEY = 'AMX_SESSION_ACTIVE';

const hasWindow = () => typeof window !== 'undefined';

export const getRememberMePreference = () => {
    if (!hasWindow()) {
        return true;
    }

    return window.localStorage.getItem(REMEMBER_ME_PREFERENCE_KEY) !== 'false';
};

export const setRememberMePreference = (rememberMe: boolean) => {
    if (!hasWindow()) {
        return;
    }

    window.localStorage.setItem(REMEMBER_ME_PREFERENCE_KEY, rememberMe ? 'true' : 'false');
    window.sessionStorage.removeItem(LEGACY_SESSION_ACTIVE_KEY);
};

const getPrimaryStorage = () => (
    getRememberMePreference() ? window.localStorage : window.sessionStorage
);

const getFallbackStorage = () => (
    getRememberMePreference() ? window.sessionStorage : null
);

export const supabaseAuthStorage = {
    getItem(key: string) {
        if (!hasWindow()) {
            return null;
        }

        const primaryValue = getPrimaryStorage().getItem(key);
        if (primaryValue !== null) {
            return primaryValue;
        }

        return getFallbackStorage()?.getItem(key) ?? null;
    },
    setItem(key: string, value: string) {
        if (!hasWindow()) {
            return;
        }

        getPrimaryStorage().setItem(key, value);
        window.localStorage.removeItem(key);
        window.sessionStorage.removeItem(key);
        getPrimaryStorage().setItem(key, value);
    },
    removeItem(key: string) {
        if (!hasWindow()) {
            return;
        }

        window.localStorage.removeItem(key);
        window.sessionStorage.removeItem(key);
    },
};
