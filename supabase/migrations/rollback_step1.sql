-- ============================================================================
-- ROLLBACK FOR STEP 1
-- ============================================================================
-- Run this if collaborative_playlists_step1.sql causes any issues
-- This will completely remove all changes made by Step 1
-- ============================================================================

-- 1. Drop functions
DROP FUNCTION IF EXISTS notify_playlist_invite CASCADE;
DROP FUNCTION IF EXISTS calculate_taste_compatibility CASCADE;
DROP FUNCTION IF EXISTS get_playlist_collaboration_stats CASCADE;

-- 2. Drop tables
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.playlist_collaborators CASCADE;

-- 3. Remove column from playlist_items
ALTER TABLE public.playlist_items 
DROP COLUMN IF EXISTS added_by_user_id;

-- 4. Drop indexes (if they weren't removed by CASCADE)
DROP INDEX IF EXISTS public.idx_playlist_items_added_by;
DROP INDEX IF EXISTS public.idx_collaborators_playlist;
DROP INDEX IF EXISTS public.idx_collaborators_user;
DROP INDEX IF EXISTS public.idx_notifications_user;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run this to confirm rollback worked:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_name IN ('playlist_collaborators', 'notifications');
-- (Should return 0 rows)
-- ============================================================================
