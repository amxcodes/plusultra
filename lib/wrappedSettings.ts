import { supabase } from './supabase';

export const WRAPPED_SETTING_KEY = 'wrapped_enabled';

export const isWrappedAvailableByDate = (date = new Date()) => {
    return date.getMonth() === 11 && date.getDate() >= 20;
};

export const isWrappedUnlocked = async () => {
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', WRAPPED_SETTING_KEY)
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (data?.value === 'true') {
            return true;
        }
    } catch (error) {
        console.error('[Wrapped] Failed to check wrapped setting:', error);
    }

    return isWrappedAvailableByDate();
};
