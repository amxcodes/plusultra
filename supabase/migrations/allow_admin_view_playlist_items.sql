-- ============================================================================
-- FIX: Allow Admins to View Playlist Items (for private/watch later playlists)
-- ============================================================================

-- Problem: 
-- Even though admins can now see the playlist itself (from last fix),
-- the "playlist_items" table has its own RLS that might be restricting access.
-- The previous policy usually relied on "user_can_view_playlist" helper.
-- However, to be 100% sure admins can see items regardless of helper function state,
-- we will add an EXPLICIT admin check to the playlist_items policy.

-- 1. Drop existing policy
DROP POLICY IF EXISTS "playlist_items_select" ON public.playlist_items;
-- Also drop potentially other named policies if they exist from older migrations
DROP POLICY IF EXISTS "playlist_items_select_policy" ON public.playlist_items;
DROP POLICY IF EXISTS "Items viewable if playlist is viewable" ON public.playlist_items;

-- 2. Create the fixed policy
CREATE POLICY "playlist_items_select"
ON public.playlist_items FOR SELECT
USING (
    -- 1. Standard Rule: Can view if they can view the parent playlist
    -- (This usually handles owner, public, and collaborators)
    user_can_view_playlist(playlist_id)

    -- 2. Admin Override: Explicitly allow admins
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);
