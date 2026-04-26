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
}

interface DesktopBridge {
    isDesktop: true;
    getCapturedMedia: () => Promise<DesktopCapturedMedia[]>;
    openExternal: (targetUrl: string) => Promise<void>;
    checkForUpdates: () => Promise<{ ok: boolean; message?: string }>;
    onCapturedMedia: (listener: (item: DesktopCapturedMedia) => void) => () => void;
}

interface Window {
    desktop?: DesktopBridge;
}
