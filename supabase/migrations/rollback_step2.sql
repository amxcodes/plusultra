-- ============================================================================
-- ROLLBACK FOR STEP 2
-- ============================================================================
-- Run this if collaborative_playlists_step2.sql causes any issues
-- This will disable RLS and remove all policies from new tables
-- ============================================================================

-- 1. Drop policies from playlist_collaborators
DROP POLICY IF EXISTS "View own collaborations" ON public.playlist_collaborators;
DROP POLICY IF EXISTS "Playlist owners manage collaborators" ON public.playlist_collaborators;
DROP POLICY IF EXISTS "Playlist owners delete collaborators" ON public.playlist_collaborators;
DROP POLICY IF EXISTS "Accept own invites" ON public.playlist_collaborators;

-- 2. Drop policies from notifications
DROP POLICY IF EXISTS "View own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- 3. Disable RLS
ALTER TABLE public.playlist_collaborators DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run this to confirm rollback worked:
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE tablename IN ('playlist_collaborators', 'notifications');
-- Expected: rowsecurity = false for both
--
-- SELECT count(*) FROM pg_policies 
-- WHERE tablename IN ('playlist_collaborators', 'notifications');
-- Expected: 0 policies
-- ============================================================================
