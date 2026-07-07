let trustedPopupUntil = 0;

const TRUSTED_POPUP_WINDOW_MS = 1200;

export const withTrustedPopup = <T>(action: () => T): T => {
    trustedPopupUntil = Date.now() + TRUSTED_POPUP_WINDOW_MS;
    try {
        return action();
    } finally {
        window.setTimeout(() => {
            if (Date.now() >= trustedPopupUntil) {
                trustedPopupUntil = 0;
            }
        }, TRUSTED_POPUP_WINDOW_MS);
    }
};

export const installPopupGuard = () => {
    if (typeof window === 'undefined') {
        return;
    }

    const marker = '__plusUltraPopupGuardInstalled';
    const guardedWindow = window as Window & {
        [marker]?: boolean;
        __plusUltraNativeOpen?: Window['open'];
    };

    if (guardedWindow[marker]) {
        return;
    }

    guardedWindow[marker] = true;
    guardedWindow.__plusUltraNativeOpen = window.open.bind(window);

    window.open = ((...args: Parameters<Window['open']>) => {
        if (Date.now() <= trustedPopupUntil) {
            return guardedWindow.__plusUltraNativeOpen?.(...args) || null;
        }

        console.warn('[PopupGuard] Blocked untrusted popup', args[0]);
        return null;
    }) as Window['open'];
};
