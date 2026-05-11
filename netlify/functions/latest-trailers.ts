import { handleLatestTrailers } from '../../server/latestTrailersHandler';

type NetlifyEvent = {
    httpMethod: string;
    queryStringParameters?: Record<string, string | undefined> | null;
};

export const handler = async (event: NetlifyEvent) => {
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    const response = await handleLatestTrailers(event.queryStringParameters || {});

    return {
        statusCode: response.status,
        headers: response.headers,
        body: response.body,
    };
};
