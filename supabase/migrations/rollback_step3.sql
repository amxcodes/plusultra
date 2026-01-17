-- ============================================================================
-- ROLLBACK FOR STEP 3
-- ============================================================================
-- ⚠️ CRITICAL: This is the emergency rollback for Step 3
--
-- INSTANT ROLLBACK (Run this first if issues occur):
-- Just disable RLS, keep policies intact
--
-- FULL ROLLBACK (Run if you want to remove everything):
-- Disable RLS AND remove new collaborative policies
-- ============================================================================

-- ============================================================================
-- OPTION 1: INSTANT ROLLBACK (Recommended for testing)
-- ============================================================================
-- This immediately restores pre-Step 3 behavior
-- Policies remain but are not enforced

ALTER TABLE public.playlists DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_items DISABLE ROW LEVEL SECURITY;

-- ✅ Verify instant rollback:
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE tablename IN ('playlists', 'playlist_items');
-- Expected: rowsecurity = false for both

-- Stop here if you just want to temporarily disable RLS for testing.
-- The app will work exactly as before Step 3.

-- ============================================================================
-- OPTION 2: FULL ROLLBACK (Complete removal)
-- ============================================================================
-- Uncomment below to also remove new collaborative policies
-- (Only run if you want to completely undo Step 3)

/*
-- Remove collaborative policies from playlists
DROP POLICY IF EXISTS "Collaborators can view playlists" ON public.playlists;
DROP POLICY IF EXISTS "Editors can update playlists" ON public.playlists;
DROP POLICY IF EXISTS "Featured playlists viewable by all" ON public.playlists;

-- Remove collaborative policies from playlist_items
DROP POLICY IF EXISTS "Collaborators can view items" ON public.playlist_items;
DROP POLICY IF EXISTS "Editors can add items" ON public.playlist_items;
DROP POLICY IF EXISTS "Editors can remove items" ON public.playlist_items;

-- ✅ Verify full rollback:
-- SELECT COUNT(*) FROM pg_policies 
-- WHERE tablename IN ('playlists', 'playlist_items')
-- AND policyname LIKE '%ollaborator%' OR policyname LIKE '%ditor%';
-- Expected: 0 collaborative policies
*/

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running INSTANT ROLLBACK:
--
-- 1. App should work normally
-- 2. No 500 errors
-- 3. All playlists visible again (no access control)
--
-- After running FULL ROLLBACK:
--
-- 1. Back to post-Step 2 state
-- 2. Only new tables (collaborators, notifications) have RLS
-- 3. Main tables (playlists, items) have no RLS
-- ============================================================================
