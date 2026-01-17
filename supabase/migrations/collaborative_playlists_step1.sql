-- ============================================================================
-- COLLABORATIVE PLAYLISTS - STEP 1 (Safe Foundation)
-- ============================================================================
-- This migration:
--   ✅ Adds new tables and columns
--   ✅ Creates helper functions
--   ❌ Does NOT enable RLS (keeps current disabled state)
--   ❌ Does NOT modify existing policies
-- 
-- Run rollback_step1.sql if anything goes wrong
-- ============================================================================

-- 1. Add attribution tracking to playlist_items
-- ----------------------------------------------------------------------------
ALTER TABLE public.playlist_items 
ADD COLUMN IF NOT EXISTS added_by_user_id UUID 
REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_playlist_items_added_by 
ON public.playlist_items(added_by_user_id);

COMMENT ON COLUMN public.playlist_items.added_by_user_id IS 
'Tracks which user added this item (for collaborative playlists)';

-- 2. Create playlist_collaborators table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.playlist_collaborators (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'editor' CHECK (role IN ('editor', 'viewer')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(playlist_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_collaborators_playlist 
ON public.playlist_collaborators(playlist_id);

CREATE INDEX IF NOT EXISTS idx_collaborators_user 
ON public.playlist_collaborators(user_id);

COMMENT ON TABLE public.playlist_collaborators IS 
'Tracks which users can collaborate on playlists';

-- 3. Create notifications table
-- ----------------------------------------------------------------------------
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

-- Index
CREATE INDEX IF NOT EXISTS idx_notifications_user 
ON public.notifications(user_id, created_at DESC);

COMMENT ON TABLE public.notifications IS 
'User notifications for invites and system messages';

-- 4. Notification trigger (auto-create notification on invite)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_playlist_invite()
RETURNS TRIGGER AS $$
DECLARE
    p_name TEXT;
    inviter_name TEXT;
BEGIN
    -- Get playlist name
    SELECT name INTO p_name 
    FROM public.playlists 
    WHERE id = NEW.playlist_id;
    
    -- Get inviter username
    SELECT username INTO inviter_name 
    FROM public.profiles 
    WHERE id = (SELECT user_id FROM public.playlists WHERE id = NEW.playlist_id);
    
    -- Create notification
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
FOR EACH ROW
WHEN (NEW.status = 'pending')
EXECUTE FUNCTION notify_playlist_invite();

-- 5. Taste compatibility function
-- ----------------------------------------------------------------------------
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
    -- Get genre counts from both users
    SELECT stats->'genre_counts' INTO genres_a 
    FROM public.profiles WHERE id = user_a;
    
    SELECT stats->'genre_counts' INTO genres_b 
    FROM public.profiles WHERE id = user_b;
    
    -- Handle missing data
    IF genres_a IS NULL OR genres_b IS NULL THEN
        RETURN jsonb_build_object(
            'score', 0, 
            'shared', ARRAY[]::TEXT[], 
            'message', 'Not enough watch history data'
        );
    END IF;

    -- Calculate overlap
    FOR key IN SELECT jsonb_object_keys(genres_a) LOOP
        IF genres_b ? key THEN
            val_a := (genres_a->>key)::INTEGER;
            val_b := (genres_b->>key)::INTEGER;
            
            -- Score based on minimum overlap (both must have watched it)
            total_score := total_score + (LEAST(val_a, val_b) * 5);
            shared_genres := array_append(shared_genres, key);
        END IF;
    END LOOP;
    
    -- Normalize to 0-100
    IF total_score > 100 THEN 
        total_score := 100; 
    END IF;
    
    RETURN jsonb_build_object(
        'score', total_score,
        'shared', shared_genres
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Playlist collaboration stats function
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_playlist_collaboration_stats(p_playlist_id UUID)
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    avatar_url TEXT,
    items_added INTEGER,
    role TEXT
) AS $$
BEGIN
    RETURN QUERY
    -- Collaborators
    SELECT 
        p.id,
        p.username,
        p.avatar_url,
        COALESCE(COUNT(pi.id)::INTEGER, 0) as items_added,
        pc.role
    FROM public.playlist_collaborators pc
    JOIN public.profiles p ON p.id = pc.user_id
    LEFT JOIN public.playlist_items pi 
        ON pi.playlist_id = pc.playlist_id 
        AND pi.added_by_user_id = pc.user_id
    WHERE pc.playlist_id = p_playlist_id 
        AND pc.status = 'accepted'
    GROUP BY p.id, p.username, p.avatar_url, pc.role
    
    UNION ALL
    
    -- Owner
    SELECT 
        pl.user_id,
        prof.username,
        prof.avatar_url,
        COALESCE(COUNT(pi.id)::INTEGER, 0) as items_added,
        'owner'::TEXT as role
    FROM public.playlists pl
    JOIN public.profiles prof ON prof.id = pl.user_id
    LEFT JOIN public.playlist_items pi 
        ON pi.playlist_id = pl.id 
        AND pi.added_by_user_id = pl.user_id
    WHERE pl.id = p_playlist_id
    GROUP BY pl.user_id, prof.username, prof.avatar_url;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run these queries to verify the migration:
--
-- 1. Check tables exist:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_name IN ('playlist_collaborators', 'notifications');
--
-- 2. Check column added:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'playlist_items' AND column_name = 'added_by_user_id';
--
-- 3. Check functions:
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_name IN ('calculate_taste_compatibility', 'get_playlist_collaboration_stats');
-- ============================================================================
