import { handleRecommendationBridge } from '../../server/recommendationBridgeHandler';
import { verifyRecommendationBridgeAccess } from '../../server/recommendationBridgeSecurity';

type NetlifyEvent = {
    httpMethod: string;
    body: string | null;
    headers?: Record<string, string | undefined>;
};

export const handler = async (event: NetlifyEvent) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    const access = verifyRecommendationBridgeAccess({
        headers: event.headers || {},
        ip: event.headers?.['x-nf-client-connection-ip'],
        env: {
            URL: process.env.URL,
            DEPLOY_PRIME_URL: process.env.DEPLOY_PRIME_URL,
            RECOMMENDATION_BRIDGE_ALLOWED_ORIGIN: process.env.RECOMMENDATION_BRIDGE_ALLOWED_ORIGIN,
        },
    });

    if (access.ok === false) {
        return {
            statusCode: access.status,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: access.error }),
        };
    }

    const body = event.body ? JSON.parse(event.body) : null;
    const response = await handleRecommendationBridge(body, {
        TASTEDIVE_API_KEY: process.env.TASTEDIVE_API_KEY ?? process.env.VITE_TASTEDIVE_API_KEY,
        OMDB_API_KEY: process.env.OMDB_API_KEY ?? process.env.VITE_OMDB_API_KEY,
    });

    return {
        statusCode: response.status,
        headers: response.headers,
        body: response.body,
    };
};
