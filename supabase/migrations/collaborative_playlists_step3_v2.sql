-- ============================================================================
-- COLLABORATIVE PLAYLISTS - STEP 3 V2 (Fixed - No Recursion)
-- ============================================================================
-- ⚠️ CRITICAL: This is the FIXED version without infinite recursion
-- 
-- CHANGES FROM V1:
--   ✅ Uses SECURITY DEFINER functions to bypass RLS
--   ✅ No circular dependencies between policies
--   ✅ Simpler, faster policy logic
-- 
-- ROLLBACK: Run rollback_step3.sql if issues occur
-- ============================================================================

-- ============================================================================
-- SECTION 1: HELPER FUNCTIONS (Bypass RLS)
-- ============================================================================

-- Function: Check if user can VIEW a playlist
CREATE OR REPLACE FUNCTION user_can_view_playlist(p_playlist_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- SECURITY DEFINER bypasses RLS to prevent recursion
    RETURN EXISTS (
        SELECT 1 FROM public.playlists
        WHERE id = p_playlist_id
        AND (
            is_public = true
            OR is_featured = true
            OR user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.playlist_collaborators
                WHERE playlist_id = p_playlist_id
                AND user_id = auth.uid()
                AND status = 'accepted'
            )
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function: Check if user can EDIT a playlist
CREATE OR REPLACE FUNCTION user_can_edit_playlist(p_playlist_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- SECURITY DEFINER bypasses RLS to prevent recursion
    RETURN EXISTS (
        SELECT 1 FROM public.playlists
        WHERE id = p_playlist_id
        AND (
            user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.playlist_collaborators
                WHERE playlist_id = p_playlist_id
                AND user_id = auth.uid()
                AND status = 'accepted'
                AND role = 'editor'
            )
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- SECTION 2: UPDATE PLAYLIST POLICIES
-- ============================================================================
-- These policies are simple and don't cause recursion

-- Drop old collaborative policies if they exist
DROP POLICY IF EXISTS "Collaborators can view playlists" ON public.playlists;
DROP POLICY IF EXISTS "Editors can update playlists" ON public.playlists;
DROP POLICY IF EXISTS "Featured playlists viewable by all" ON public.playlists;

-- New unified VIEW policy (combines public, featured, owned, collaborative)
DROP POLICY IF EXISTS "View accessible playlists" ON public.playlists;
CREATE POLICY "View accessible playlists"
ON public.playlists FOR SELECT
USING (
    is_public = true
    OR is_featured = true
    OR user_id = auth.uid()
    OR id IN (
        SELECT playlist_id 
        FROM public.playlist_collaborators
        WHERE user_id = auth.uid() AND status = 'accepted'
    )
);

-- New unified UPDATE policy (owner or accepted editor)
DROP POLICY IF EXISTS "Update own or collaborative playlists" ON public.playlists;
CREATE POLICY "Update own or collaborative playlists"
ON public.playlists FOR UPDATE
USING (
    user_id = auth.uid()
    OR id IN (
        SELECT playlist_id 
        FROM public.playlist_collaborators
        WHERE user_id = auth.uid() 
        AND status = 'accepted' 
        AND role = 'editor'
    )
);

-- ============================================================================
-- SECTION 3: UPDATE PLAYLIST_ITEMS POLICIES
-- ============================================================================
-- These use helper functions to avoid recursion

-- Drop old policies
DROP POLICY IF EXISTS "Collaborators can view items" ON public.playlist_items;
DROP POLICY IF EXISTS "Editors can add items" ON public.playlist_items;
DROP POLICY IF EXISTS "Editors can remove items" ON public.playlist_items;

-- SELECT policy (uses helper function - no recursion)
DROP POLICY IF EXISTS "View items from accessible playlists" ON public.playlist_items;
CREATE POLICY "View items from accessible playlists"
ON public.playlist_items FOR SELECT
USING (
    user_can_view_playlist(playlist_id)
);

-- INSERT policy (uses helper function - no recursion)
DROP POLICY IF EXISTS "Add items to editable playlists" ON public.playlist_items;
CREATE POLICY "Add items to editable playlists"
ON public.playlist_items FOR INSERT
WITH CHECK (
    user_can_edit_playlist(playlist_id)
);

-- DELETE policy (uses helper function - no recursion)
DROP POLICY IF EXISTS "Remove items from editable playlists" ON public.playlist_items;
CREATE POLICY "Remove items from editable playlists"
ON public.playlist_items FOR DELETE
USING (
    user_can_edit_playlist(playlist_id)
);

-- ============================================================================
-- SECTION 4: ENABLE RLS
-- ============================================================================

ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run these to verify:
--
-- 1. Check RLS enabled:
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE tablename IN ('playlists', 'playlist_items');
--
-- 2. Test query (should work without recursion):
-- SELECT COUNT(*) FROM playlists WHERE is_public = true;
--
-- 3. Test creating playlist:
-- INSERT INTO playlists (user_id, name, is_public)
-- VALUES (auth.uid(), 'RLS Test V2', false)
-- RETURNING id;
--
-- 4. Test adding item:
-- INSERT INTO playlist_items (playlist_id, tmdb_id, media_type, metadata, added_by_user_id)
-- VALUES ('<playlist_id>', '550', 'movie', '{"title": "Test"}'::jsonb, auth.uid());
-- ============================================================================
