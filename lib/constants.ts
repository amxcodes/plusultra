export const APP_CONSTANTS = {
    APP_NAME: 'Stream',
    DEFAULT_LANGUAGE: 'en-US',
    TMDB_IMAGE_BASE_URL: 'https://image.tmdb.org/t/p/w500',
    TMDB_BACKDROP_BASE_URL: 'https://image.tmdb.org/t/p/original',
    DEBOUNCE_DELAY: 5000,
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
};

export const CACHE_TTL = {
    USER_PROFILE: 5, // minutes
    FEATURED_CONTENT: 60, // minutes
    APP_SETTINGS: 1440, // 24 hours
};

export const ROUTES = {
    HOME: '/',
    LOGIN: '/login',
    PROFILE: '/profile',
    PLAYLIST: '/playlist',
    ADMIN: '/admin',
};

export const STORAGE_KEYS = {
    THEME: 'amx_theme',
    VOLUME: 'amx_volume',
};
