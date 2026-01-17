-- ============================================================================
-- COLLABORATIVE PLAYLISTS - STEP 3 (Enable RLS on Existing Tables)
-- ============================================================================
-- ⚠️ CRITICAL: This enables RLS on main tables (playlists, playlist_items)
-- 
-- WHAT THIS DOES:
--   ✅ Enables RLS (activates existing policies)
--   ✅ Adds collaborative access policies
--   ✅ Adds featured playlists viewing policy
--   ❌ Does NOT modify existing policies
-- 
-- ROLLBACK: Run rollback_step3.sql if issues occur
-- TEST: Run test_step3.sql before AND after migration
-- ============================================================================

-- ============================================================================
-- SECTION 1: ADD NEW POLICIES (Before enabling RLS)
-- ============================================================================
-- Add new policies while RLS is still disabled for safety

-- 1A. Collaborative Access - Playlists
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Collaborators can view playlists" ON public.playlists;
CREATE POLICY "Collaborators can view playlists"
ON public.playlists FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.playlist_collaborators
        WHERE playlist_id = playlists.id
        AND user_id = auth.uid()
        AND status = 'accepted'
    )
);

DROP POLICY IF EXISTS "Editors can update playlists" ON public.playlists;
CREATE POLICY "Editors can update playlists"
ON public.playlists FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.playlist_collaborators
        WHERE playlist_id = playlists.id
        AND user_id = auth.uid()
        AND status = 'accepted'
        AND role = 'editor'
    )
);

-- 1B. Featured Playlists (Public Viewing)
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Featured playlists viewable by all" ON public.playlists;
CREATE POLICY "Featured playlists viewable by all"
ON public.playlists FOR SELECT
USING (is_featured = true);

-- 1C. Collaborative Access - Playlist Items
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Collaborators can view items" ON public.playlist_items;
CREATE POLICY "Collaborators can view items"
ON public.playlist_items FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.playlists p
        LEFT JOIN public.playlist_collaborators pc 
            ON pc.playlist_id = p.id 
            AND pc.user_id = auth.uid() 
            AND pc.status = 'accepted'
        WHERE p.id = playlist_items.playlist_id
        AND (
            p.is_public = true
            OR p.user_id = auth.uid()
            OR pc.user_id IS NOT NULL
        )
    )
);

DROP POLICY IF EXISTS "Editors can add items" ON public.playlist_items;
CREATE POLICY "Editors can add items"
ON public.playlist_items FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.playlists p
        LEFT JOIN public.playlist_collaborators pc 
            ON pc.playlist_id = p.id 
            AND pc.user_id = auth.uid() 
            AND pc.status = 'accepted'
            AND pc.role = 'editor'
        WHERE p.id = playlist_items.playlist_id
        AND (
            p.user_id = auth.uid()
            OR pc.user_id IS NOT NULL
        )
    )
);

DROP POLICY IF EXISTS "Editors can remove items" ON public.playlist_items;
CREATE POLICY "Editors can remove items"
ON public.playlist_items FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.playlists p
        LEFT JOIN public.playlist_collaborators pc 
            ON pc.playlist_id = p.id 
            AND pc.user_id = auth.uid() 
            AND pc.status = 'accepted'
            AND pc.role = 'editor'
        WHERE p.id = playlist_items.playlist_id
        AND (
            p.user_id = auth.uid()
            OR pc.user_id IS NOT NULL
        )
    )
);

-- ============================================================================
-- SECTION 2: ENABLE RLS
-- ============================================================================
-- This activates ALL policies (existing + new)

ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify migration success:
--
-- 1. Check RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE tablename IN ('playlists', 'playlist_items');
-- Expected: rowsecurity = true for both
--
-- 2. Count policies:
-- SELECT tablename, COUNT(*) as policy_count
-- FROM pg_policies 
-- WHERE tablename IN ('playlists', 'playlist_items')
-- GROUP BY tablename;
-- Expected: playlists = 10 policies, playlist_items = 7 policies
--
-- 3. Test basic query (should still work):
-- SELECT COUNT(*) FROM playlists WHERE is_public = true;
-- Expected: Returns count, no errors
--
-- 4. Test creating playlist (should work):
-- INSERT INTO playlists (user_id, name, is_public)
-- VALUES (auth.uid(), 'Test RLS', false)
-- RETURNING id;
-- Expected: Returns new ID
--
-- ============================================================================
-- CRITICAL: Run test_step3.sql for full test suite
-- ============================================================================
