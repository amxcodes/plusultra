import { supabase } from '../lib/supabase';
import { isLikelyNetworkError, isNavigatorOnline } from '../lib/network';
import { getTrackingContext } from '../lib/activityTracking';

export const APP_PRESENCE_HEARTBEAT_SECONDS = 60;
const APP_PRESENCE_SESSION_STORAGE_KEY = 'AMX_APP_PRESENCE_SESSION_ID';

export const getPresenceSessionId = (): string => {
    const existingId = sessionStorage.getItem(APP_PRESENCE_SESSION_STORAGE_KEY);
    if (existingId) return existingId;

    const nextId = crypto.randomUUID();
    sessionStorage.setItem(APP_PRESENCE_SESSION_STORAGE_KEY, nextId);
    return nextId;
};

export const clearPresenceSessionId = () => {
    sessionStorage.removeItem(APP_PRESENCE_SESSION_STORAGE_KEY);
};

export const PresenceService = {
    async trackHeartbeat() {
        if (!isNavigatorOnline()) {
            return;
        }

        const context = getTrackingContext();
        if (!context.isVisible) {
            return;
        }

        const payload = {
            p_session_id: getPresenceSessionId(),
            p_path: `${window.location.pathname}${window.location.search}`,
            p_user_agent: navigator.userAgent,
            p_heartbeat_seconds: APP_PRESENCE_HEARTBEAT_SECONDS,
            p_context: {
                is_visible: context.isVisible,
                is_focused: context.isFocused,
                has_recent_interaction: context.hasRecentInteraction,
                idle_seconds: context.idleSeconds,
                activity_mode: context.activityMode,
            },
        };

        let { error } = await supabase.rpc('heartbeat_app_presence_v2', payload);

        if (error?.code === 'PGRST202') {
            ({ error } = await supabase.rpc('heartbeat_app_presence', {
                p_session_id: payload.p_session_id,
                p_path: payload.p_path,
                p_user_agent: payload.p_user_agent,
                p_heartbeat_seconds: payload.p_heartbeat_seconds,
            }));
        }

        if (error) {
            if (!isLikelyNetworkError(error)) {
                console.error('[PresenceService] Failed to track platform heartbeat:', error);
            }
        }
    },

    async endSession() {
        const sessionId = sessionStorage.getItem(APP_PRESENCE_SESSION_STORAGE_KEY);
        if (!sessionId) return;

        if (!isNavigatorOnline()) {
            clearPresenceSessionId();
            return;
        }

        const { error } = await supabase.rpc('end_app_presence_session', {
            p_session_id: sessionId,
        });

        if (error) {
            if (!isLikelyNetworkError(error)) {
                console.error('[PresenceService] Failed to end platform session:', error);
            }
        }

        clearPresenceSessionId();
    },
};
