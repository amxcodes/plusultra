-- ============================================================================
-- FIX: Recreate Collaboration Stats Function & Backfill Data
-- ============================================================================

-- 1. Ensure the function exists (Drop first to be clean)
DROP FUNCTION IF EXISTS get_playlist_collaboration_stats(UUID);

CREATE OR REPLACE FUNCTION get_playlist_collaboration_stats(p_playlist_id UUID)
RETURNS TABLE (user_id UUID, username TEXT, avatar_url TEXT, items_added INTEGER, role TEXT) AS $$
BEGIN
    RETURN QUERY
    -- 1. Collaborators (Accepted)
    SELECT p.id, p.username, p.avatar_url, COALESCE(COUNT(pi.tmdb_id)::INTEGER, 0), pc.role
    FROM public.playlist_collaborators pc
    JOIN public.profiles p ON p.id = pc.user_id
    LEFT JOIN public.playlist_items pi ON pi.playlist_id = pc.playlist_id AND pi.added_by_user_id = pc.user_id
    WHERE pc.playlist_id = p_playlist_id AND pc.status = 'accepted'
    GROUP BY p.id, p.username, p.avatar_url, pc.role
    
    UNION ALL
    
    -- 2. Owner
    SELECT pl.user_id, prof.username, prof.avatar_url, COALESCE(COUNT(pi.tmdb_id)::INTEGER, 0), 'owner'::TEXT
    FROM public.playlists pl
    JOIN public.profiles prof ON prof.id = pl.user_id
    LEFT JOIN public.playlist_items pi ON pi.playlist_id = pl.id AND pi.added_by_user_id = pl.user_id
    WHERE pl.id = p_playlist_id
    GROUP BY pl.user_id, prof.username, prof.avatar_url;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Backfill added_by_user_id for existing items
--    If an item has no owner recorded, we assume it was added by the playlist owner
--    (Safety: Only updates rows where added_by_user_id IS NULL)
UPDATE public.playlist_items AS pi
SET added_by_user_id = p.user_id
FROM public.playlists AS p
WHERE pi.playlist_id = p.id
AND pi.added_by_user_id IS NULL;

-- 3. Verify RLS policies on functions?
--    Postgres functions run with owner privileges by default, but SECURITY DEFINER is safer.
--    No extra RLS needed for the function itself, but the tables accessed need to be accessible.
--    The function IS SECURITY DEFINER, so it bypasses RLS on the tables. This is correct for stats.
