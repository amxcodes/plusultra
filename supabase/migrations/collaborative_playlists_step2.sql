-- ============================================================================
-- COLLABORATIVE PLAYLISTS - STEP 2 (Secure New Tables)
-- ============================================================================
-- This migration:
--   ✅ Enables RLS on playlist_collaborators and notifications
--   ✅ Creates security policies for collaboration features
--   ❌ Does NOT touch existing tables (playlists, playlist_items)
-- 
-- Run rollback_step2.sql if anything goes wrong
-- ============================================================================

-- 1. Enable RLS on new tables
-- ----------------------------------------------------------------------------
ALTER TABLE public.playlist_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 2. Policies for playlist_collaborators
-- ----------------------------------------------------------------------------

-- Policy: View own collaborations
-- Users can see collaborations where they are either:
-- - The invited collaborator
-- - The playlist owner
DROP POLICY IF EXISTS "View own collaborations" ON public.playlist_collaborators;
CREATE POLICY "View own collaborations"
ON public.playlist_collaborators FOR SELECT
USING (
    auth.uid() = user_id 
    OR EXISTS (
        SELECT 1 FROM public.playlists 
        WHERE id = playlist_collaborators.playlist_id 
        AND user_id = auth.uid()
    )
);

-- Policy: Playlist owners manage collaborators
-- Only playlist owners can add/remove/modify collaborators
DROP POLICY IF EXISTS "Playlist owners manage collaborators" ON public.playlist_collaborators;
CREATE POLICY "Playlist owners manage collaborators"
ON public.playlist_collaborators FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.playlists 
        WHERE id = playlist_collaborators.playlist_id 
        AND user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Playlist owners delete collaborators" ON public.playlist_collaborators;
CREATE POLICY "Playlist owners delete collaborators"
ON public.playlist_collaborators FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.playlists 
        WHERE id = playlist_collaborators.playlist_id 
        AND user_id = auth.uid()
    )
);

-- Policy: Accept own invites
-- Invited users can update their own invitation status
DROP POLICY IF EXISTS "Accept own invites" ON public.playlist_collaborators;
CREATE POLICY "Accept own invites"
ON public.playlist_collaborators FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. Policies for notifications
-- ----------------------------------------------------------------------------

-- Policy: View own notifications
-- Users can only see their own notifications
DROP POLICY IF EXISTS "View own notifications" ON public.notifications;
CREATE POLICY "View own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Update own notifications
-- Users can only update their own notifications (mark as read)
DROP POLICY IF EXISTS "Update own notifications" ON public.notifications;
CREATE POLICY "Update own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: System can insert notifications
-- Allows triggers and system functions to create notifications
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run these queries to verify the migration:
--
-- 1. Check RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE tablename IN ('playlist_collaborators', 'notifications');
-- Expected: rowsecurity = true for both
--
-- 2. Check policies created:
-- SELECT tablename, policyname FROM pg_policies 
-- WHERE tablename IN ('playlist_collaborators', 'notifications')
-- ORDER BY tablename, policyname;
-- Expected: 7 rows total
--
-- 3. Test basic queries still work:
-- SELECT * FROM playlists LIMIT 1;
-- SELECT * FROM playlist_items LIMIT 1;
-- Expected: No errors
-- ============================================================================
