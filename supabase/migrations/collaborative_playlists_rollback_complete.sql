-- ============================================================================
-- COMPLETE ROLLBACK - Undo Everything
-- ============================================================================
-- Run this to completely undo the collaborative playlists migration
-- ============================================================================

-- 1. Disable RLS on all tables
ALTER TABLE public.playlists DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_collaborators DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;

-- 2. Drop all new policies
DROP POLICY IF EXISTS "playlists_select_policy" ON public.playlists;
DROP POLICY IF EXISTS "playlists_insert_policy" ON public.playlists;
DROP POLICY IF EXISTS "playlists_update_policy" ON public.playlists;
DROP POLICY IF EXISTS "playlists_delete_policy" ON public.playlists;

DROP POLICY IF EXISTS "playlist_items_select_policy" ON public.playlist_items;
DROP POLICY IF EXISTS "playlist_items_insert_policy" ON public.playlist_items;
DROP POLICY IF EXISTS "playlist_items_delete_policy" ON public.playlist_items;

DROP POLICY IF EXISTS "collaborators_select_own" ON public.playlist_collaborators;
DROP POLICY IF EXISTS "collaborators_select_as_owner" ON public.playlist_collaborators;
DROP POLICY IF EXISTS "collaborators_insert" ON public.playlist_collaborators;
DROP POLICY IF EXISTS "collaborators_update_own" ON public.playlist_collaborators;
DROP POLICY IF EXISTS "collaborators_delete" ON public.playlist_collaborators;

DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;

-- 3. Drop functions
DROP FUNCTION IF EXISTS user_can_view_playlist CASCADE;
DROP FUNCTION IF EXISTS user_can_edit_playlist CASCADE;
DROP FUNCTION IF EXISTS notify_playlist_invite CASCADE;
DROP FUNCTION IF EXISTS calculate_taste_compatibility CASCADE;
DROP FUNCTION IF EXISTS get_playlist_collaboration_stats CASCADE;

-- 4. Drop tables
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.playlist_collaborators CASCADE;

-- 5. Remove column
ALTER TABLE public.playlist_items DROP COLUMN IF EXISTS added_by_user_id;

-- 6. Drop indexes
DROP INDEX IF EXISTS public.idx_playlist_items_added_by;
DROP INDEX IF EXISTS public.idx_collaborators_playlist;
DROP INDEX IF EXISTS public.idx_collaborators_user;
DROP INDEX IF EXISTS public.idx_notifications_user;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE tablename IN ('playlists', 'playlist_items');
-- Expected: Both = false
-- ============================================================================
