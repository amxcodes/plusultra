import { useEffect, useMemo, useState } from 'react';
import { normalizeProviderRecords, PLAYER_PROVIDER_DEFAULTS, PlayerProviderAdapter } from '../lib/playerProviders';
import { PlayerProviderService } from '../services/PlayerProviderService';

interface UsePlayerProvidersOptions {
    includeDisabled?: boolean;
}

export const usePlayerProviders = (options?: UsePlayerProvidersOptions) => {
    const [providers, setProviders] = useState<PlayerProviderAdapter[]>(PLAYER_PROVIDER_DEFAULTS);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const loadProviders = async () => {
            setLoading(true);
            try {
                const records = await PlayerProviderService.getProviders({
                    includeDisabled: options?.includeDisabled,
                });
                if (!cancelled) {
                    setProviders(normalizeProviderRecords(records));
                }
            } catch (error) {
                console.error('[usePlayerProviders] Failed to load providers:', error);
                if (!cancelled) {
                    setProviders(PLAYER_PROVIDER_DEFAULTS);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadProviders();

        return () => {
            cancelled = true;
        };
    }, [options?.includeDisabled]);

    return useMemo(() => ({
        providers,
        loading,
    }), [providers, loading]);
};
