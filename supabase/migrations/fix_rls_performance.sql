-- OPTIMIZED RLS POLICIES (Fixing Performance Timeout)
-- The previous policy used a function call for every row, causing N+1 query performance issues.
-- This version uses direct row access and efficient EXISTS clauses.

-- 1. Drop the slow policy
DROP POLICY IF EXISTS "playlists_select" ON public.playlists;

-- 2. Create optimized policy
-- Direct checks for public/owner, and simple efficient subquery for collaboration
CREATE POLICY "playlists_select"
ON public.playlists FOR SELECT
USING (
    is_public = true 
    OR is_featured = true 
    OR user_id = auth.uid()
    OR (auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.playlist_collaborators 
        WHERE playlist_id = id 
        AND user_id = auth.uid() 
        AND status = 'accepted'
    ))
);

-- 3. Ensure playlist_likes has RLS and policies (just in case)
ALTER TABLE public.playlist_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "likes_select" ON public.playlist_likes;
DROP POLICY IF EXISTS "likes_insert" ON public.playlist_likes;
DROP POLICY IF EXISTS "likes_delete" ON public.playlist_likes;

CREATE POLICY "likes_select"
ON public.playlist_likes FOR SELECT
USING (true); -- Public likes are visible (needed for "Most Liked" counts/lists) OR restrict to owner?
-- Actually, getLikedPlaylists filters by user_id = current_user.
-- getMostLikedAllTime uses count on playlists table (pre-calculated).
-- But we might need to view likes. Let's start with owner-only or public?
-- If I want to see "who liked this", I need public access.
-- Let's allow public SELECT for now, as likes are generally public info on this platform.
-- But insert/delete must be owner.

CREATE POLICY "likes_insert"
ON public.playlist_likes FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "likes_delete"
ON public.playlist_likes FOR DELETE
USING (user_id = auth.uid());
