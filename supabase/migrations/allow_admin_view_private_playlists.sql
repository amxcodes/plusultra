-- ============================================================================
-- FIX: Allow Admins to View Private Playlists (including Watch Later)
-- ============================================================================

-- Problem: 
-- The "performance optimized" RLS policy (fix_rls_performance.sql) removed the Admin check.
-- This prevented admins from seeing private playlists (like Watch Later) of other users.

-- Solution:
-- Re-add the "OR role = 'admin'" check to the efficient policy.

-- 1. Drop the current policy
DROP POLICY IF EXISTS "playlists_select" ON public.playlists;

-- 2. Create the fixed policy
CREATE POLICY "playlists_select"
ON public.playlists FOR SELECT
USING (
    is_public = true 
    OR is_featured = true 
    OR user_id = auth.uid()
    OR EXISTS ( -- Admin Override
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
    OR (auth.uid() IS NOT NULL AND EXISTS ( -- Collaborator Check
        SELECT 1 FROM public.playlist_collaborators 
        WHERE playlist_id = id 
        AND user_id = auth.uid() 
        AND status = 'accepted'
    ))
);

-- Note: No changes needed for playlist_items, as it usually relies on "user_can_view_playlist" function 
-- OR has its own policy. Let's verify playlist_items policy references.
-- In "collaborative_playlists_rls_final.sql", playlist_items used "user_can_view_playlist(playlist_id)".
-- That function (user_can_view_playlist) DOES check for admin.
-- So if the RLS on playlists table itself blocks the ROW, then it's blocked.
-- By fixing the policy on 'playlists', the main fetch (getPlaylists) which selects from playlists will now work.

-- Double check user_can_view_playlist function just in case it was replaced?
-- It was defined in collaborative_playlists_rls_final.sql and does include admin check.
-- However, "fix_rls_performance.sql" REPLACED the policy on playlists to NOT use the function (to avoid N+1).
-- So this new policy above IS the source of truth for the 'playlists' table SELECT.
