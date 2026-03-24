/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
    readonly VITE_TMDB_API_KEY?: string;
    readonly VITE_SUPABASE_URL?: string;
    readonly VITE_SUPABASE_ANON_KEY?: string;
    readonly VITE_TASTEDIVE_API_KEY?: string;
    readonly VITE_OMDB_API_KEY?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
