/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
    readonly VITE_TMDB_API_KEY?: string;
    readonly VITE_SUPABASE_URL?: string;
    readonly VITE_SUPABASE_ANON_KEY?: string;
    readonly VITE_TURNSTILE_SITE_KEY?: string;
    readonly VITE_DESKTOP_DISABLE_TURNSTILE?: string;
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
    downloadOfflineMedia: (payload: {
        title: string;
        tmdbId: number;
        mediaType: 'movie' | 'tv';
        sourceUrl: string;
        imageUrl: string;
        backdropUrl?: string;
        description?: string;
        year?: number;
        genre?: string[];
        season?: number;
        episode?: number;
        providerId?: string;
        providerName?: string;
    }) => Promise<{ ok: boolean; entry?: import('./types').OfflineDownloadEntry; message?: string }>;
    getOfflineDownloads: () => Promise<import('./types').OfflineDownloadEntry[]>;
    removeOfflineDownload: (downloadId: string) => Promise<{ ok: boolean; message?: string }>;
    getOfflinePlaybackUrl: (downloadId: string) => Promise<{ ok: boolean; url?: string; message?: string }>;
    checkForUpdates: () => Promise<{ ok: boolean; status?: string; currentVersion?: string; latestVersion?: string | null; message?: string | null; downloadProgress?: number | null }>;
    downloadUpdate: () => Promise<{ ok: boolean; status?: string; currentVersion?: string; latestVersion?: string | null; message?: string | null; downloadProgress?: number | null }>;
    installUpdate: () => Promise<{ ok: boolean; status?: string; currentVersion?: string; latestVersion?: string | null; message?: string | null; downloadProgress?: number | null }>;
    getUpdateState: () => Promise<{ status: string; currentVersion: string; latestVersion: string | null; message: string | null; downloadProgress: number | null }>;
    onCapturedMedia: (listener: (item: DesktopCapturedMedia) => void) => () => void;
    onCapturedMediaReset: (listener: (payload: { captureKey: string }) => void) => () => void;
    onTurnstileToken: (listener: (payload: { requestId: string; token: string; action: string }) => void) => () => void;
    onUpdateState: (listener: (payload: { status: string; currentVersion: string; latestVersion: string | null; message: string | null; downloadProgress: number | null }) => void) => () => void;
    onOfflineDownloadsChanged: (listener: (payload: import('./types').OfflineDownloadEntry[]) => void) => () => void;
}

interface Window {
    desktop?: DesktopBridge;
}
