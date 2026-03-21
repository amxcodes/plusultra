-- FRESH START VIEWING RESET
-- Keeps accounts, playlists, follows, and social data intact.
-- Clears all user viewing state so wrapped can restart on the new session-based tracker.

DELETE FROM public.view_sessions;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'watch_history'
  ) THEN
    EXECUTE 'TRUNCATE TABLE public.watch_history';
  END IF;
END $$;

UPDATE public.profiles
SET
  watch_history = '{}'::jsonb,
  stats = public.reset_viewing_stats(stats, true),
  last_seen_activity = now();
