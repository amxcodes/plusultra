import { isLikelyNetworkError } from '../lib/network';

export interface TrailerCountry {
    code: string;
    label: string;
    accent: string;
}

export interface LatestTrailerItem {
    id: string;
    videoId: string;
    title: string;
    url: string;
    embedUrl: string;
    thumbnailUrl: string;
    publishedAt: string;
    channelTitle: string;
    channelId: string;
    sourceName: string;
    countryCode: string;
    countryLabel: string;
    countryAccent: string;
}

export interface CountryTrailerGroup {
    country: TrailerCountry;
    trailers: LatestTrailerItem[];
}

const getEndpoint = () => {
    if (import.meta.env.DEV) return '/api/latest-trailers';
    return '/.netlify/functions/latest-trailers';
};

export const LatestTrailersService = {
    async getLatestTrailersByCountries(): Promise<CountryTrailerGroup[]> {
        try {
            const params = new URLSearchParams({
                limit: '8',
                maxAgeDays: '180',
            });
            const response = await fetch(`${getEndpoint()}?${params.toString()}`, {
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'plusultra-web',
                },
            });

            if (!response.ok) return [];
            const data = await response.json();
            return Array.isArray(data.groups) ? data.groups : [];
        } catch (error) {
            if (!isLikelyNetworkError(error)) {
                console.error('Latest trailers lookup failed:', error);
            }
            return [];
        }
    },
};
