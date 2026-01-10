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

        const fetchSkips = async () => {
            setLoading(true);
            try {
                let url = `https://quickwatch.co/api/skips?title=${encodeURIComponent(title)}&season=${season}&episode=${episode}`;
                if (runtime) {
                    url += `&runtime=${runtime}`;
                }

                const res = await fetch(url);
                const data: QuickWatchResponse = await res.json();

                if (data.found && data.skip_times) {
                    setSkipData(data.skip_times);
                } else {
                    setSkipData(null);
                }
            } catch (e) {
                // Silently fail for CORS/Network issues on localhost
                setSkipData(null);
            } finally {
                setLoading(false);
            }
        };

        fetchSkips();
    }, [title, season, episode, runtime]);

    return { skipData, loading };
};
