import { handleRecommendationBridge } from '../../server/recommendationBridgeHandler';

export const handler = async (event: { httpMethod: string; body: string | null }) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    const body = event.body ? JSON.parse(event.body) : null;
    const response = await handleRecommendationBridge(body, {
        VITE_TASTEDIVE_API_KEY: process.env.VITE_TASTEDIVE_API_KEY,
        VITE_OMDB_API_KEY: process.env.VITE_OMDB_API_KEY,
    });

    return {
        statusCode: response.status,
        headers: response.headers,
        body: response.body,
    };
};
