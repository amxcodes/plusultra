-- ============================================================================
-- COLLABORATIVE PLAYLISTS - STEP 3 V3 (Complete Policy Replacement)
-- ============================================================================
-- ⚠️ CRITICAL: This REPLACES all existing policies with new comprehensive ones
-- 
-- WHY V3:
--   V1 failed: Infinite recursion
--   V2 failed: Old policies conflicting with new ones
--   V3 fix: Drop ALL old policies, create ONLY new ones
-- 
-- ROLLBACK: Run rollback_step3.sql if issues occur
-- ============================================================================

-- ============================================================================
-- SECTION 1: HELPER FUNCTIONS (Same as V2)
-- ============================================================================

CREATE OR REPLACE FUNCTION user_can_view_playlist(p_playlist_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.playlists
        WHERE id = p_playlist_id
        AND (
            is_public = true
            OR is_featured = true
            OR user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND role = 'admin'
            )
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

CREATE OR REPLACE FUNCTION user_can_edit_playlist(p_playlist_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.playlists
        WHERE id = p_playlist_id
        AND (
            user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND role = 'admin'
            )
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
-- SECTION 2: DROP ALL EXISTING POLICIES
-- ============================================================================
-- Clean slate - remove any conflicting old policies

-- playlists table (drop all 7 existing policies)
DROP POLICY IF EXISTS "Public playlists are viewable by everyone." ON public.playlists;
DROP POLICY IF EXISTS "Users can view their own private playlists." ON public.playlists;
DROP POLICY IF EXISTS "Admins can view all playlists." ON public.playlists;
DROP POLICY IF EXISTS "Users can insert their own playlists." ON public.playlists;
DROP POLICY IF EXISTS "Users can update own playlists." ON public.playlists;
DROP POLICY IF EXISTS "Admins can update all playlists." ON public.playlists;
DROP POLICY IF EXISTS "Users can delete own playlists." ON public.playlists;

-- playlist_items table (drop all 4 existing policies)
DROP POLICY IF EXISTS "Items viewable if playlist is viewable" ON public.playlist_items;
DROP POLICY IF EXISTS "Users can add items to own playlists" ON public.playlist_items;
DROP POLICY IF EXISTS "Users can remove items from own playlists" ON public.playlist_items;
DROP POLICY IF EXISTS "Admins can view all playlist items." ON public.playlist_items;

-- Drop any V1/V2 policies if they exist
DROP POLICY IF EXISTS "Collaborators can view playlists" ON public.playlists;
DROP POLICY IF EXISTS "Editors can update playlists" ON public.playlists;
DROP POLICY IF EXISTS "Featured playlists viewable by all" ON public.playlists;
DROP POLICY IF EXISTS "View accessible playlists" ON public.playlists;
DROP POLICY IF EXISTS "Update own or collaborative playlists" ON public.playlists;
DROP POLICY IF EXISTS "Collaborators can view items" ON public.playlist_items;
DROP POLICY IF EXISTS "Editors can add items" ON public.playlist_items;
DROP POLICY IF EXISTS "Editors can remove items" ON public.playlist_items;
DROP POLICY IF EXISTS "View items from accessible playlists" ON public.playlist_items;
DROP POLICY IF EXISTS "Add items to editable playlists" ON public.playlist_items;
DROP POLICY IF EXISTS "Remove items from editable playlists" ON public.playlist_items;

-- ============================================================================
-- SECTION 3: CREATE NEW COMPREHENSIVE POLICIES
-- ============================================================================

-- PLAYLISTS TABLE POLICIES
-- -------------------------

-- SELECT: Public, featured, owned, admin, or collaborator
CREATE POLICY "playlists_select_policy"
ON public.playlists FOR SELECT
USING (
    is_public = true
    OR is_featured = true
    OR user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
    OR id IN (
        SELECT playlist_id FROM public.playlist_collaborators
        WHERE user_id = auth.uid() AND status = 'accepted'
    )
);

-- INSERT: Any authenticated user
CREATE POLICY "playlists_insert_policy"
ON public.playlists FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
);

-- UPDATE: Owner, admin, or editor collaborator
CREATE POLICY "playlists_update_policy"
ON public.playlists FOR UPDATE
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
    OR id IN (
        SELECT playlist_id FROM public.playlist_collaborators
        WHERE user_id = auth.uid() 
        AND status = 'accepted' 
        AND role = 'editor'
    )
);

-- DELETE: Owner or admin only
CREATE POLICY "playlists_delete_policy"
ON public.playlists FOR DELETE
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- PLAYLIST_ITEMS TABLE POLICIES
-- ------------------------------

-- SELECT: If user can view parent playlist (uses helper function)
CREATE POLICY "playlist_items_select_policy"
ON public.playlist_items FOR SELECT
USING (
    user_can_view_playlist(playlist_id)
);

-- INSERT: If user can edit parent playlist (uses helper function)
CREATE POLICY "playlist_items_insert_policy"
ON public.playlist_items FOR INSERT
WITH CHECK (
    user_can_edit_playlist(playlist_id)
);

-- DELETE: If user can edit parent playlist (uses helper function)
CREATE POLICY "playlist_items_delete_policy"
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
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE tablename IN ('playlists', 'playlist_items');
-- Expected: Both = true
--
-- SELECT tablename, policyname FROM pg_policies 
-- WHERE tablename IN ('playlists', 'playlist_items')
-- ORDER BY tablename, policyname;
-- Expected: 4 policies on playlists, 3 on playlist_items
-- ============================================================================
