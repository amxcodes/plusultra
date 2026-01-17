-- ============================================================================
-- FIX: RLS Policies for Playlist Collaborators
-- ============================================================================

-- Problem: 
-- The previous policies were too restrictive or disjointed.
-- "collaborators_select_own" only let you see YOURSELF.
-- "collaborators_select_as_owner" worked for owner, but might be flaky if recursion checks failing.
-- Result: Collaborators couldn't see other collaborators, so the member list was incomplete.

-- Solution:
-- Use the SECURITY DEFINER function `user_can_view_playlist` to grant access.
-- If you can VIEW the playlist (Owner, Collaborator, or Public), you should be able to see who else is collaborating.
-- The function runs as owner, bypassing RLS recursion.

-- 1. Drop existing SELECT policies on playlist_collaborators
DROP POLICY IF EXISTS "collaborators_select_own" ON public.playlist_collaborators;
DROP POLICY IF EXISTS "collaborators_select_as_owner" ON public.playlist_collaborators;

-- 2. Create unified SELECT policy
CREATE POLICY "collaborators_select_policy"
ON public.playlist_collaborators FOR SELECT
USING (
    -- You can see collaborators if you can view the playlist
    user_can_view_playlist(playlist_id)
);

-- Note: INSERT/UPDATE/DELETE policies remain same (Owner only usually, or protected by logic)
-- Verify:
-- Owner -> user_can_view returns true -> sees all.
-- Collaborator -> user_can_view returns true -> sees all.
-- Random User -> user_can_view returns false (unless public) -> sees none (or all if public).
-- For this app, public playlists usually don't show collaborators list in detail, but if they did, it's fine.
