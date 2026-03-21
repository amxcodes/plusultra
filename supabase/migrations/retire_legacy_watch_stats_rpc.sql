-- RETIRE LEGACY WATCH STATS RPC
-- The app now uses update_watch_history_v2 + heartbeat_view_session.
-- This drops the old progress-based RPC so it cannot be reused accidentally.

REVOKE EXECUTE ON FUNCTION public.update_watch_history_with_stats(uuid, text, text, int, text[], jsonb)
FROM anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.update_watch_history_with_stats(uuid, text, text, int, text[], jsonb);

NOTIFY pgrst, 'reload schema';
