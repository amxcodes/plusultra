/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
    readonly VITE_TMDB_API_KEY?: string;
    readonly VITE_SUPABASE_URL?: string;
    readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

interface DesktopCapturedMedia {
    url: string;
    resourceType: string;
    timestamp: number;
    captureKey: string;
    media?: DesktopMediaCaptureSession & { key: string };
}

interface DesktopMediaCaptureSession {
    tmdbId: string;
    mediaType: 'movie' | 'tv';
    season?: number;
    episode?: number;
    providerId: string;
    providerName: string;
    title?: string;
}

interface DesktopBridge {
    isDesktop: true;
    startMediaCapture: (sessionInfo: DesktopMediaCaptureSession) => Promise<{ ok: boolean; captureKey?: string }>;
    stopMediaCapture: (captureKey: string) => Promise<{ ok: boolean }>;
    getCapturedMedia: (captureKey: string) => Promise<DesktopCapturedMedia[]>;
    startTurnstileCheck: (payload: { action: string; siteKey: string }) => Promise<{ ok: boolean; requestId?: string; message?: string }>;
    openExternal: (targetUrl: string) => Promise<void>;
    checkForUpdates: () => Promise<{ ok: boolean; message?: string }>;
    onCapturedMedia: (listener: (item: DesktopCapturedMedia) => void) => () => void;
    onCapturedMediaReset: (listener: (payload: { captureKey: string }) => void) => () => void;
    onTurnstileToken: (listener: (payload: { requestId: string; token: string; action: string }) => void) => () => void;
}

interface Window {
    desktop?: DesktopBridge;
}
