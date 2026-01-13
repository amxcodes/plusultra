import { useState, useEffect } from 'react';

interface SkipTimes {
    intro: { start: number | null; end: number | null };
    recap: { start: number | null; end: number | null };
    credits: { start: number | null; end: number | null };
    ending: { start: number | null; end: number | null };
    up_next: { start: number | null; end: number | null };
}

interface QuickWatchResponse {
    found: boolean;
    skip_times?: SkipTimes;
}

export const useSkipData = (title: string, season: number, episode: number, runtime?: number) => {
    const [skipData, setSkipData] = useState<SkipTimes | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!title || !season || !episode) return;

        // Skip API call on localhost to avoid CORS spam
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            setSkipData(null);
            setLoading(false);
            return;
        }

        const fetchSkips = async () => {
            setLoading(true);
            try {
                const baseUrl = `https://quickwatch.co/api/skips?title=${encodeURIComponent(title)}&season=${season}&episode=${episode}`;
                const url = runtime ? `${baseUrl}&runtime=${runtime}` : baseUrl;

                // Try direct fetch first, fallback to CORS proxy if needed
                let res;
                try {
                    res = await fetch(url);
                } catch (corsError) {
                    // Silent fallback - CORS proxy for localhost development
                    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
                    res = await fetch(proxyUrl);
                }

                const data: QuickWatchResponse = await res.json();

                if (data.found && data.skip_times) {
                    setSkipData(data.skip_times);
                } else {
                    setSkipData(null);
                }
            } catch (e) {
                // Silently fail - skip data is optional
                setSkipData(null);
            } finally {
                setLoading(false);
            }
        };

        fetchSkips();
    }, [title, season, episode, runtime]);

    return { skipData, loading };
};
