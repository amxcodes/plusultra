-- ============================================================================
-- COLLABORATIVE PLAYLISTS - COMPLETE MIGRATION (All Steps Combined)
-- ============================================================================
-- This migration does EVERYTHING in one go:
--   ✅ Creates tables (Step 1)
--   ✅ Enables RLS on new tables (Step 2)
--   ✅ Enables RLS on existing tables (Step 3)
--   ✅ All using SECURITY DEFINER to prevent recursion
--
-- ROLLBACK: Run collaborative_playlists_rollback_complete.sql if issues
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE TABLES AND COLUMNS
-- ============================================================================

-- Add attribution to playlist_items
ALTER TABLE public.playlist_items 
ADD COLUMN IF NOT EXISTS added_by_user_id UUID 
REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_playlist_items_added_by 
ON public.playlist_items(added_by_user_id);

-- Create playlist_collaborators table
CREATE TABLE IF NOT EXISTS public.playlist_collaborators (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'editor' CHECK (role IN ('editor', 'viewer')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(playlist_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_collaborators_playlist 
ON public.playlist_collaborators(playlist_id);

CREATE INDEX IF NOT EXISTS idx_collaborators_user 
ON public.playlist_collaborators(user_id);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('playlist_invite', 'system', 'follow')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user 
ON public.notifications(user_id, created_at DESC);

-- ============================================================================
-- STEP 2: CREATE ALL HELPER FUNCTIONS (SECURITY DEFINER)
-- ============================================================================

-- Notification trigger
CREATE OR REPLACE FUNCTION notify_playlist_invite()
RETURNS TRIGGER AS $$
DECLARE
    p_name TEXT;
    inviter_name TEXT;
BEGIN
    SELECT name INTO p_name FROM public.playlists WHERE id = NEW.playlist_id;
    SELECT username INTO inviter_name FROM public.profiles 
    WHERE id = (SELECT user_id FROM public.playlists WHERE id = NEW.playlist_id);
    
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
        NEW.user_id,
        'playlist_invite',
        'Playlist Invitation',
        inviter_name || ' invited you to collaborate on "' || p_name || '"',
        jsonb_build_object('playlist_id', NEW.playlist_id, 'invite_id', NEW.id)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_playlist_invite ON public.playlist_collaborators;
CREATE TRIGGER on_playlist_invite
AFTER INSERT ON public.playlist_collaborators
FOR EACH ROW WHEN (NEW.status = 'pending')
EXECUTE FUNCTION notify_playlist_invite();

-- Taste compatibility function
CREATE OR REPLACE FUNCTION calculate_taste_compatibility(user_a UUID, user_b UUID)
RETURNS JSONB AS $$
DECLARE
    genres_a JSONB;
    genres_b JSONB;
    total_score INTEGER := 0;
    shared_genres TEXT[] := ARRAY[]::TEXT[];
    key TEXT;
    val_a INTEGER;
    val_b INTEGER;
BEGIN
    SELECT stats->'genre_counts' INTO genres_a FROM public.profiles WHERE id = user_a;
    SELECT stats->'genre_counts' INTO genres_b FROM public.profiles WHERE id = user_b;
    
    IF genres_a IS NULL OR genres_b IS NULL THEN
        RETURN jsonb_build_object('score', 0, 'shared', ARRAY[]::TEXT[], 'message', 'Not enough data');
    END IF;

    FOR key IN SELECT jsonb_object_keys(genres_a) LOOP
        IF genres_b ? key THEN
            val_a := (genres_a->>key)::INTEGER;
            val_b := (genres_b->>key)::INTEGER;
            total_score := total_score + (LEAST(val_a, val_b) * 5);
            shared_genres := array_append(shared_genres, key);
        END IF;
    END LOOP;
    
    IF total_score > 100 THEN total_score := 100; END IF;
    RETURN jsonb_build_object('score', total_score, 'shared', shared_genres);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Collaboration stats function
CREATE OR REPLACE FUNCTION get_playlist_collaboration_stats(p_playlist_id UUID)
RETURNS TABLE (user_id UUID, username TEXT, avatar_url TEXT, items_added INTEGER, role TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.username, p.avatar_url, COALESCE(COUNT(pi.id)::INTEGER, 0), pc.role
    FROM public.playlist_collaborators pc
    JOIN public.profiles p ON p.id = pc.user_id
    LEFT JOIN public.playlist_items pi ON pi.playlist_id = pc.playlist_id AND pi.added_by_user_id = pc.user_id
    WHERE pc.playlist_id = p_playlist_id AND pc.status = 'accepted'
    GROUP BY p.id, p.username, p.avatar_url, pc.role
    UNION ALL
    SELECT pl.user_id, prof.username, prof.avatar_url, COALESCE(COUNT(pi.id)::INTEGER, 0), 'owner'::TEXT
    FROM public.playlists pl
    JOIN public.profiles prof ON prof.id = pl.user_id
    LEFT JOIN public.playlist_items pi ON pi.playlist_id = pl.id AND pi.added_by_user_id = pl.user_id
    WHERE pl.id = p_playlist_id
    GROUP BY pl.user_id, prof.username, prof.avatar_url;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: Check if user can VIEW a playlist (bypasses RLS)
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
            OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
            OR EXISTS (
                SELECT 1 FROM public.playlist_collaborators
                WHERE playlist_id = p_playlist_id AND user_id = auth.uid() AND status = 'accepted'
            )
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: Check if user can EDIT a playlist (bypasses RLS)
CREATE OR REPLACE FUNCTION user_can_edit_playlist(p_playlist_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.playlists
        WHERE id = p_playlist_id
        AND (
            user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
            OR EXISTS (
                SELECT 1 FROM public.playlist_collaborators
                WHERE playlist_id = p_playlist_id AND user_id = auth.uid() 
                AND status = 'accepted' AND role = 'editor'
            )
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- STEP 3: DROP ALL EXISTING POLICIES (Clean Slate)
-- ============================================================================

-- playlists table
DROP POLICY IF EXISTS "Public playlists are viewable by everyone." ON public.playlists;
DROP POLICY IF EXISTS "Users can view their own private playlists." ON public.playlists;
DROP POLICY IF EXISTS "Admins can view all playlists." ON public.playlists;
DROP POLICY IF EXISTS "Users can insert their own playlists." ON public.playlists;
DROP POLICY IF EXISTS "Users can update own playlists." ON public.playlists;
DROP POLICY IF EXISTS "Admins can update all playlists." ON public.playlists;
DROP POLICY IF EXISTS "Users can delete own playlists." ON public.playlists;

-- playlist_items table
DROP POLICY IF EXISTS "Items viewable if playlist is viewable" ON public.playlist_items;
DROP POLICY IF EXISTS "Users can add items to own playlists" ON public.playlist_items;
DROP POLICY IF EXISTS "Users can remove items from own playlists" ON public.playlist_items;
DROP POLICY IF EXISTS "Admins can view all playlist items." ON public.playlist_items;

-- ============================================================================
-- STEP 4: CREATE NEW POLICIES (No Recursion!)
-- ============================================================================

-- PLAYLISTS POLICIES
CREATE POLICY "playlists_select_policy"
ON public.playlists FOR SELECT
USING (
    is_public = true
    OR is_featured = true
    OR user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR id IN (SELECT playlist_id FROM public.playlist_collaborators WHERE user_id = auth.uid() AND status = 'accepted')
);

CREATE POLICY "playlists_insert_policy"
ON public.playlists FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "playlists_update_policy"
ON public.playlists FOR UPDATE
USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR id IN (SELECT playlist_id FROM public.playlist_collaborators WHERE user_id = auth.uid() AND status = 'accepted' AND role = 'editor')
);

CREATE POLICY "playlists_delete_policy"
ON public.playlists FOR DELETE
USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- PLAYLIST_ITEMS POLICIES (Use SECURITY DEFINER functions)
CREATE POLICY "playlist_items_select_policy"
ON public.playlist_items FOR SELECT
USING (user_can_view_playlist(playlist_id));

CREATE POLICY "playlist_items_insert_policy"
ON public.playlist_items FOR INSERT
WITH CHECK (user_can_edit_playlist(playlist_id));

CREATE POLICY "playlist_items_delete_policy"
ON public.playlist_items FOR DELETE
USING (user_can_edit_playlist(playlist_id));

-- PLAYLIST_COLLABORATORS POLICIES (Simple - no cross-table queries!)
CREATE POLICY "collaborators_select_own"
ON public.playlist_collaborators FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "collaborators_select_as_owner"
ON public.playlist_collaborators FOR SELECT
USING (
    playlist_id IN (SELECT id FROM public.playlists WHERE user_id = auth.uid())
);

CREATE POLICY "collaborators_insert"
ON public.playlist_collaborators FOR INSERT
WITH CHECK (
    playlist_id IN (SELECT id FROM public.playlists WHERE user_id = auth.uid())
);

CREATE POLICY "collaborators_update_own"
ON public.playlist_collaborators FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "collaborators_delete"
ON public.playlist_collaborators FOR DELETE
USING (
    playlist_id IN (SELECT id FROM public.playlists WHERE user_id = auth.uid())
);

-- NOTIFICATIONS POLICIES (Simple)
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
-- STEP 5: ENABLE RLS ON ALL TABLES
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
-- Expected: All = true
-- ============================================================================
