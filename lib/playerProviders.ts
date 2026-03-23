export type MediaType = 'movie' | 'tv';
export type Provider = string;
export type ProviderRenderMode = 'embed' | 'direct';
export type ProviderRiskLevel = 'low' | 'medium' | 'high';

export interface ProviderContext {
    tmdbId: string;
    mediaType: MediaType;
    season?: number;
    episode?: number;
}

export interface DirectPlaybackSource {
    src: string;
    type?: string;
}

export interface PlayerProviderRecord {
    id: string;
    name: string;
    render_mode: ProviderRenderMode;
    enabled: boolean;
    sort_order: number;
    has_events: boolean;
    risk_level: ProviderRiskLevel;
    tags: string[];
    best_for?: string | null;
    movie_embed_template?: string | null;
    tv_embed_template?: string | null;
    movie_direct_template?: string | null;
    tv_direct_template?: string | null;
}

export interface PlayerProviderAdapter {
    id: Provider;
    name: string;
    renderMode: ProviderRenderMode;
    enabled: boolean;
    sortOrder: number;
    hasEvents: boolean;
    riskLevel: ProviderRiskLevel;
    tags?: string[];
    bestFor?: string;
    movieEmbedTemplate?: string;
    tvEmbedTemplate?: string;
    movieDirectTemplate?: string;
    tvDirectTemplate?: string;
    getEmbedUrl?: (context: ProviderContext) => string;
    getDirectSources?: (context: ProviderContext) => DirectPlaybackSource[];
}

const DEFAULT_PROVIDER_RECORDS: PlayerProviderRecord[] = [
    {
        id: 'zxcplayer',
        name: 'Server 1',
        render_mode: 'embed',
        enabled: true,
        sort_order: 10,
        has_events: false,
        risk_level: 'low',
        tags: ['Fast', 'No Ads'],
        best_for: 'Best Quality',
        movie_embed_template: 'https://zxcstream.xyz/player/movie/{{tmdbId}}/en?autoplay=false&back=true&server=0',
        tv_embed_template: 'https://zxcstream.xyz/player/tv/{{tmdbId}}/{{season}}/{{episode}}/en?autoplay=false&back=true&server=0',
    },
    {
        id: 'zxcembed',
        name: 'Server 2',
        render_mode: 'embed',
        enabled: true,
        sort_order: 20,
        has_events: false,
        risk_level: 'low',
        tags: ['Fast', 'No Ads'],
        best_for: 'Alternative Player',
        movie_embed_template: 'https://zxcstream.xyz/embed/movie/{{tmdbId}}',
        tv_embed_template: 'https://zxcstream.xyz/embed/tv/{{tmdbId}}/{{season}}/{{episode}}',
    },
    {
        id: 'cinemaos',
        name: 'Server 3',
        render_mode: 'embed',
        enabled: true,
        sort_order: 30,
        has_events: false,
        risk_level: 'low',
        tags: ['Reliable'],
        best_for: 'Backup',
        movie_embed_template: 'https://zxcstream.xyz/player/movie/{{tmdbId}}/en?autoplay=false&back=true&server=0',
        tv_embed_template: 'https://zxcstream.xyz/player/tv/{{tmdbId}}/{{season}}/{{episode}}/en?autoplay=false&back=true&server=0',
    },
    {
        id: 'aeon',
        name: 'Server 4',
        render_mode: 'embed',
        enabled: true,
        sort_order: 40,
        has_events: false,
        risk_level: 'low',
        tags: ['Reliable'],
        best_for: 'Backup',
        movie_embed_template: 'https://thisiscinema.pages.dev/?type=movie&version=v3&id={{tmdbId}}',
        tv_embed_template: 'https://thisiscinema.pages.dev/?type=tv&version=v3&id={{tmdbId}}&season={{season}}&episode={{episode}}',
    },
    {
        id: 'cinezo',
        name: 'Server 5',
        render_mode: 'embed',
        enabled: true,
        sort_order: 50,
        has_events: false,
        risk_level: 'low',
        tags: ['Reliable'],
        best_for: 'Backup',
        movie_embed_template: 'https://api.cinezo.net/embed/tmdb-movie-{{tmdbId}}',
        tv_embed_template: 'https://api.cinezo.net/embed/tmdb-tv-{{tmdbId}}/{{season}}/{{episode}}',
    },
    {
        id: 'rive',
        name: 'Server 6',
        render_mode: 'embed',
        enabled: true,
        sort_order: 60,
        has_events: false,
        risk_level: 'high',
        tags: ['Redirects'],
        best_for: 'All Content',
        movie_embed_template: 'https://rivestream.org/embed?type=movie&id={{tmdbId}}',
        tv_embed_template: 'https://rivestream.org/embed?type=tv&id={{tmdbId}}&season={{season}}&episode={{episode}}',
    },
    {
        id: 'vidora',
        name: 'Server 7',
        render_mode: 'embed',
        enabled: true,
        sort_order: 70,
        has_events: true,
        risk_level: 'high',
        tags: ['Redirects'],
        best_for: 'All Content',
        movie_embed_template: 'https://vidora.su/movie/{{tmdbId}}?autoplay=false',
        tv_embed_template: 'https://vidora.su/tv/{{tmdbId}}/{{season}}/{{episode}}?autoplay=false',
    },
];

const interpolateTemplate = (template: string | undefined, context: ProviderContext) => {
    if (!template) return '';

    const replacements: Record<string, string | number> = {
        tmdbId: context.tmdbId,
        season: context.season || 1,
        episode: context.episode || 1,
        mediaType: context.mediaType,
    };

    return template.replace(/\{\{(\w+)\}\}/g, (_match, token: string) => {
        return String(replacements[token] ?? '');
    });
};

export const createProviderAdapter = (record: PlayerProviderRecord): PlayerProviderAdapter => ({
    id: record.id,
    name: record.name,
    renderMode: record.render_mode,
    enabled: record.enabled,
    sortOrder: record.sort_order,
    hasEvents: record.has_events,
    riskLevel: record.risk_level,
    tags: record.tags,
    bestFor: record.best_for || undefined,
    movieEmbedTemplate: record.movie_embed_template || undefined,
    tvEmbedTemplate: record.tv_embed_template || undefined,
    movieDirectTemplate: record.movie_direct_template || undefined,
    tvDirectTemplate: record.tv_direct_template || undefined,
    getEmbedUrl: record.render_mode === 'embed'
        ? (context) => interpolateTemplate(
            context.mediaType === 'movie' ? record.movie_embed_template || undefined : record.tv_embed_template || undefined,
            context
        )
        : undefined,
    getDirectSources: record.render_mode === 'direct'
        ? (context) => {
            const src = interpolateTemplate(
                context.mediaType === 'movie' ? record.movie_direct_template || undefined : record.tv_direct_template || undefined,
                context
            );

            return src ? [{ src }] : [];
        }
        : undefined,
});

export const PLAYER_PROVIDER_DEFAULTS: PlayerProviderAdapter[] = DEFAULT_PROVIDER_RECORDS
    .map(createProviderAdapter)
    .sort((left, right) => left.sortOrder - right.sortOrder);

export const getProviderAdapter = (providers: PlayerProviderAdapter[], providerId: Provider) =>
    providers.find(provider => provider.id === providerId) || providers[0];

export const getProviderUrl = (providers: PlayerProviderAdapter[], providerId: Provider, context: ProviderContext) => {
    const provider = getProviderAdapter(providers, providerId);

    if (provider.renderMode === 'direct') {
        return provider.getDirectSources?.(context)?.[0]?.src || '';
    }

    return provider.getEmbedUrl?.(context) || '';
};

export const normalizeProviderRecords = (records?: PlayerProviderRecord[] | null): PlayerProviderAdapter[] => {
    if (!records || records.length === 0) {
        return PLAYER_PROVIDER_DEFAULTS;
    }

    return records
        .map(createProviderAdapter)
        .sort((left, right) => left.sortOrder - right.sortOrder);
};

export const getDefaultProviderRecords = (): PlayerProviderRecord[] => DEFAULT_PROVIDER_RECORDS.map(record => ({
    ...record,
    tags: [...record.tags],
}));
