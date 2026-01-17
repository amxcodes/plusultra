-- ============================================================================
-- COLLABORATIVE PLAYLISTS - FINAL FIX (No Recursion Guaranteed)
-- ============================================================================
-- ROOT CAUSE: playlists queries playlist_collaborators which queries playlists
-- 
-- FIX: playlist_collaborators policies NEVER query playlists
--      Instead, use helper functions that bypass all RLS
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE HELPER FUNCTIONS (All with SECURITY DEFINER)
-- ============================================================================

-- Helper: Is user a collaborator on a playlist? (Bypasses RLS completely)
CREATE OR REPLACE FUNCTION is_playlist_collaborator(p_playlist_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.playlist_collaborators
        WHERE playlist_id = p_playlist_id
        AND user_id = p_user_id
        AND status = 'accepted'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: Is user the owner of a playlist? (Bypasses RLS)
CREATE OR REPLACE FUNCTION is_playlist_owner(p_playlist_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.playlists
        WHERE id = p_playlist_id
        AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: Can user view this playlist? (Bypasses RLS)
CREATE OR REPLACE FUNCTION user_can_view_playlist(p_playlist_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_public BOOLEAN;
    v_is_featured BOOLEAN;
    v_owner_id UUID;
    v_is_admin BOOLEAN;
BEGIN
    -- Get playlist info
    SELECT is_public, is_featured, user_id 
    INTO v_is_public, v_is_featured, v_owner_id
    FROM public.playlists
    WHERE id = p_playlist_id;
    
    -- Check if user is admin
    SELECT role = 'admin' INTO v_is_admin
    FROM public.profiles
    WHERE id = v_user_id;
    
    -- Return access decision
    RETURN (
        v_is_public = true
        OR v_is_featured = true
        OR v_owner_id = v_user_id
        OR v_is_admin = true
        OR is_playlist_collaborator(p_playlist_id, v_user_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: Can user edit this playlist? (Bypasses RLS)
CREATE OR REPLACE FUNCTION user_can_edit_playlist(p_playlist_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_owner_id UUID;
    v_is_admin BOOLEAN;
    v_is_editor BOOLEAN;
BEGIN
    -- Get owner
    SELECT user_id INTO v_owner_id
    FROM public.playlists
    WHERE id = p_playlist_id;
    
    -- Check if admin
    SELECT role = 'admin' INTO v_is_admin
    FROM public.profiles
    WHERE id = v_user_id;
    
    -- Check if editor
    SELECT EXISTS (
        SELECT 1 FROM public.playlist_collaborators
        WHERE playlist_id = p_playlist_id
        AND user_id = v_user_id
        AND status = 'accepted'
        AND role = 'editor'
    ) INTO v_is_editor;
    
    RETURN (
        v_owner_id = v_user_id
        OR v_is_admin = true
        OR v_is_editor = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- STEP 2: DROP ALL EXISTING POLICIES
-- ============================================================================

-- playlists
DROP POLICY IF EXISTS "Public playlists are viewable by everyone." ON public.playlists;
DROP POLICY IF EXISTS "Users can view their own private playlists." ON public.playlists;
DROP POLICY IF EXISTS "Admins can view all playlists." ON public.playlists;
DROP POLICY IF EXISTS "Users can insert their own playlists." ON public.playlists;
DROP POLICY IF EXISTS "Users can update own playlists." ON public.playlists;
DROP POLICY IF EXISTS "Admins can update all playlists." ON public.playlists;
DROP POLICY IF EXISTS "Users can delete own playlists." ON public.playlists;
DROP POLICY IF EXISTS "playlists_select_policy" ON public.playlists;
DROP POLICY IF EXISTS "playlists_insert_policy" ON public.playlists;
DROP POLICY IF EXISTS "playlists_update_policy" ON public.playlists;
DROP POLICY IF EXISTS "playlists_delete_policy" ON public.playlists;

-- playlist_items
DROP POLICY IF EXISTS "Items viewable if playlist is viewable" ON public.playlist_items;
DROP POLICY IF EXISTS "Users can add items to own playlists" ON public.playlist_items;
DROP POLICY IF EXISTS "Users can remove items from own playlists" ON public.playlist_items;
DROP POLICY IF EXISTS "Admins can view all playlist items." ON public.playlist_items;
DROP POLICY IF EXISTS "playlist_items_select_policy" ON public.playlist_items;
DROP POLICY IF EXISTS "playlist_items_insert_policy" ON public.playlist_items;
DROP POLICY IF EXISTS "playlist_items_delete_policy" ON public.playlist_items;

-- playlist_collaborators  
DROP POLICY IF EXISTS "View own collaborations" ON public.playlist_collaborators;
DROP POLICY IF EXISTS "Playlist owners manage collaborators" ON public.playlist_collaborators;
DROP POLICY IF EXISTS "Playlist owners delete collaborators" ON public.playlist_collaborators;
DROP POLICY IF EXISTS "Accept own invites" ON public.playlist_collaborators;
DROP POLICY IF EXISTS "collaborators_select_own" ON public.playlist_collaborators;
DROP POLICY IF EXISTS "collaborators_select_as_owner" ON public.playlist_collaborators;
DROP POLICY IF EXISTS "collaborators_insert" ON public.playlist_collaborators;
DROP POLICY IF EXISTS "collaborators_update_own" ON public.playlist_collaborators;
DROP POLICY IF EXISTS "collaborators_delete" ON public.playlist_collaborators;

-- notifications
DROP POLICY IF EXISTS "View own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;

-- ============================================================================
-- STEP 3: CREATE NEW POLICIES (Using helper functions - NO RECURSION!)
-- ============================================================================

-- PLAYLISTS: All policies use helper functions
CREATE POLICY "playlists_select"
ON public.playlists FOR SELECT
USING (user_can_view_playlist(id));

CREATE POLICY "playlists_insert"
ON public.playlists FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "playlists_update"
ON public.playlists FOR UPDATE
USING (user_can_edit_playlist(id));

CREATE POLICY "playlists_delete"
ON public.playlists FOR DELETE
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- PLAYLIST_ITEMS: Use helper functions
CREATE POLICY "playlist_items_select"
ON public.playlist_items FOR SELECT
USING (user_can_view_playlist(playlist_id));

CREATE POLICY "playlist_items_insert"
ON public.playlist_items FOR INSERT
WITH CHECK (user_can_edit_playlist(playlist_id));

CREATE POLICY "playlist_items_delete"
ON public.playlist_items FOR DELETE
USING (user_can_edit_playlist(playlist_id));

-- PLAYLIST_COLLABORATORS: DEAD SIMPLE - no cross-table queries!
CREATE POLICY "collaborators_view_own"
ON public.playlist_collaborators FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "collaborators_insert"
ON public.playlist_collaborators FOR INSERT
WITH CHECK (is_playlist_owner(playlist_id, auth.uid()));

CREATE POLICY "collaborators_update"
ON public.playlist_collaborators FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "collaborators_delete"
ON public.playlist_collaborators FOR DELETE
USING (is_playlist_owner(playlist_id, auth.uid()));

-- NOTIFICATIONS: Simple
CREATE POLICY "notifications_select"
ON public.notifications FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "notifications_update"
ON public.notifications FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "notifications_insert"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- ============================================================================
-- STEP 4: ENABLE RLS
-- ============================================================================

ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE tablename IN ('playlists', 'playlist_items', 'playlist_collaborators', 'notifications');
-- All should be true
-- ============================================================================
