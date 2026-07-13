import { supabase } from '../lib/supabase';
import { PlayerProviderRecord } from '../lib/playerProviders';

export const PlayerProviderService = {
    async getProviders(options?: { includeDisabled?: boolean }) {
        let query = supabase
            .from('player_providers')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });

        if (!options?.includeDisabled) {
            query = query.eq('enabled', true);
        }

        const { data, error } = await query;
        if (error) throw error;

        return (data || []) as PlayerProviderRecord[];
    },

    async upsertProvider(provider: PlayerProviderRecord) {
        const { error } = await supabase
            .from('player_providers')
            .upsert({
                ...provider,
                updated_at: new Date().toISOString(),
            });

        if (error) throw error;
    },

    async upsertProviders(providers: PlayerProviderRecord[]) {
        const { error } = await supabase
            .from('player_providers')
            .upsert(providers.map(p => ({
                ...p,
                updated_at: new Date().toISOString(),
            })));

        if (error) throw error;
    },

    async updateProviderEnabled(id: string, enabled: boolean) {
        const { error } = await supabase
            .from('player_providers')
            .update({
                enabled,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id);

        if (error) throw error;
    },

    async updateProviderSortOrders(providers: Pick<PlayerProviderRecord, 'id' | 'sort_order'>[]) {
        const results = await Promise.all(providers.map(provider => (
            supabase
                .from('player_providers')
                .update({
                    sort_order: provider.sort_order,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', provider.id)
        )));

        const failed = results.find(result => result.error);
        if (failed?.error) throw failed.error;
    },

    async deleteProvider(id: string) {
        const { error } = await supabase
            .from('player_providers')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },
};
