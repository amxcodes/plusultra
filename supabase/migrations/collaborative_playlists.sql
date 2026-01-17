-- Collaborative Playlists & Taste Match

-- 1. Playlist Collaborators
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.playlist_collaborators (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    playlist_id UUID REFERENCES public.playlists(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'editor' CHECK (role IN ('editor', 'viewer', 'owner')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(playlist_id, user_id)
);

-- RLS
ALTER TABLE public.playlist_collaborators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View collaborators" ON public.playlist_collaborators;
CREATE POLICY "View collaborators" ON public.playlist_collaborators
    FOR SELECT USING (
        -- Can view if you are the user OR if you have access to the playlist (viewer/editor)
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM public.playlists p 
            WHERE p.id = playlist_collaborators.playlist_id AND (p.user_id = auth.uid() OR p.is_public = true)
        )
    );

DROP POLICY IF EXISTS "Manage collaborators" ON public.playlist_collaborators;
CREATE POLICY "Manage collaborators" ON public.playlist_collaborators
    FOR ALL USING (
        -- Only owner can add/remove collaborators
        EXISTS (
            SELECT 1 FROM public.playlists p 
            WHERE p.id = playlist_collaborators.playlist_id AND p.user_id = auth.uid()
        )
    );
    
-- Allow invited user to accept (update status)
DROP POLICY IF EXISTS "Accept invite" ON public.playlist_collaborators;
CREATE POLICY "Accept invite" ON public.playlist_collaborators
    FOR UPDATE USING (
        auth.uid() = user_id
    ) WITH CHECK (
        auth.uid() = user_id
    );

-- 2. Notifications Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('playlist_invite', 'system', 'follow')),
    title TEXT,
    message TEXT,
    data JSONB DEFAULT '{}'::jsonb, -- Store playlist_id, etc.
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "System can insert notifications" ON public.notifications
    FOR INSERT WITH CHECK (true); 

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- 3. Trigger to send notification on invite
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_collaborator_invite()
RETURNS TRIGGER AS $$
DECLARE
    p_name TEXT;
    inviter_name TEXT;
BEGIN
    SELECT name INTO p_name FROM public.playlists WHERE id = NEW.playlist_id;
    SELECT username INTO inviter_name FROM public.profiles WHERE id = (SELECT user_id FROM public.playlists WHERE id = NEW.playlist_id);
    
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
        NEW.user_id,
        'playlist_invite',
        'Playlist Invitation',
        inviter_name || ' invited you to collaborate on "' || p_name || '"',
        jsonb_build_object('playlist_id', NEW.playlist_id, 'invite_id', NEW.id)
    );
    return NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_collaborator_invite ON public.playlist_collaborators;
CREATE TRIGGER on_collaborator_invite
AFTER INSERT ON public.playlist_collaborators
FOR EACH ROW
EXECUTE FUNCTION notify_collaborator_invite();

-- 4. Taste Compatibility Function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_taste_compatibility(user_a UUID, user_b UUID)
RETURNS JSONB AS $$
DECLARE
    stats_a JSONB;
    stats_b JSONB;
    genres_a JSONB;
    genres_b JSONB;
    total_score INTEGER := 0;
    shared_genres TEXT[] := ARRAY[]::TEXT[];
    key TEXT;
    val_a INTEGER;
    val_b INTEGER;
    movie_count_a INTEGER;
    movie_count_b INTEGER;
BEGIN
    SELECT stats->'genre_counts', (stats->>'total_movies')::int INTO genres_a, movie_count_a FROM public.profiles WHERE id = user_a;
    SELECT stats->'genre_counts', (stats->>'total_movies')::int INTO genres_b, movie_count_b FROM public.profiles WHERE id = user_b;
    
    IF genres_a IS NULL OR genres_b IS NULL THEN
        RETURN jsonb_build_object('score', 0, 'shared', ARRAY[]::TEXT[], 'msg', 'Not enough data');
    END IF;

    -- Iterate through genres of user A
    FOR key IN SELECT jsonb_object_keys(genres_a) LOOP
        -- If user B also watches this genre
        IF genres_b ? key THEN
            val_a := (genres_a->>key)::INTEGER;
            val_b := (genres_b->>key)::INTEGER;
            
            -- Simple weighting: 1 point for each overlapping watch, capped slightly
            total_score := total_score + (LEAST(val_a, val_b) * 5); 
            
            shared_genres := array_append(shared_genres, key);
        END IF;
    END LOOP;
    
    -- Normalize score (0-100)
    IF total_score > 100 THEN total_score := 100; END IF;
    
    -- Heuristic: If they have very few movies, lower confidence? No, keep it simple.
    
    RETURN jsonb_build_object('score', total_score, 'shared', shared_genres);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Update Playlists RLS to Include Collaborators
-- ------------------------------------------------------------------------------
-- This allows collaborators to see/edit playlists just like normal playlists

-- Drop existing policies (we'll recreate them with collaboration support)
DROP POLICY IF EXISTS "Users can view public playlists or their own" ON public.playlists;
DROP POLICY IF EXISTS "Users can view own playlists" ON public.playlists;
DROP POLICY IF EXISTS "Public playlists viewable" ON public.playlists;

-- New unified VIEW policy: Public playlists OR owned OR collaborator
CREATE POLICY "View playlists with collaboration" ON public.playlists
    FOR SELECT USING (
        is_public = true 
        OR user_id = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM public.playlist_collaborators pc
            WHERE pc.playlist_id = playlists.id 
            AND pc.user_id = auth.uid() 
            AND pc.status = 'accepted'
        )
    );

-- EDIT policy: Owner OR accepted editor collaborator
DROP POLICY IF EXISTS "Users can update own playlists" ON public.playlists;
CREATE POLICY "Edit playlists with collaboration" ON public.playlists
    FOR UPDATE USING (
        user_id = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM public.playlist_collaborators pc
            WHERE pc.playlist_id = playlists.id 
            AND pc.user_id = auth.uid() 
            AND pc.status = 'accepted'
            AND pc.role = 'editor'
        )
    );

-- DELETE policy: Only owner can delete
DROP POLICY IF EXISTS "Users can delete own playlists" ON public.playlists;
CREATE POLICY "Delete own playlists" ON public.playlists
    FOR DELETE USING (user_id = auth.uid());

-- INSERT policy: Authenticated users can create
DROP POLICY IF EXISTS "Users can create playlists" ON public.playlists;
CREATE POLICY "Create playlists" ON public.playlists
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 6. Update Playlist Items RLS for Collaborators
-- ------------------------------------------------------------------------------
-- Allow collaborators to add/remove items from playlists they collaborate on

DROP POLICY IF EXISTS "Users can manage own playlist items" ON public.playlist_items;
DROP POLICY IF EXISTS "Users can view playlist items" ON public.playlist_items;

-- VIEW: Anyone can see items from playlists they have access to
CREATE POLICY "View playlist items" ON public.playlist_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.playlists p
            WHERE p.id = playlist_items.playlist_id
            AND (
                p.is_public = true
                OR p.user_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.playlist_collaborators pc
                    WHERE pc.playlist_id = p.id
                    AND pc.user_id = auth.uid()
                    AND pc.status = 'accepted'
                )
            )
        )
    );

-- EDIT: Owner or editor collaborators can add/remove items
CREATE POLICY "Manage playlist items" ON public.playlist_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.playlists p
            WHERE p.id = playlist_items.playlist_id
            AND (
                p.user_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.playlist_collaborators pc
                    WHERE pc.playlist_id = p.id
                    AND pc.user_id = auth.uid()
                    AND pc.status = 'accepted'
                    AND pc.role = 'editor'
                )
            )
        )
    );

-- 7. Track Who Added Each Item (for stats & attribution)
-- ------------------------------------------------------------------------------
-- Add column to playlist_items to track the user who added each movie

ALTER TABLE public.playlist_items 
ADD COLUMN IF NOT EXISTS added_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_playlist_items_added_by 
ON public.playlist_items(added_by_user_id);

-- 8. Helper Function: Get Collaborative Playlist Stats
-- ------------------------------------------------------------------------------
-- Returns contribution stats for each collaborator on a playlist

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
    SELECT 
        p.id,
        p.username,
        p.avatar_url,
        COALESCE(COUNT(pi.id)::INTEGER, 0) as items_added,
        pc.role
    FROM public.playlist_collaborators pc
    JOIN public.profiles p ON p.id = pc.user_id
    LEFT JOIN public.playlist_items pi ON pi.playlist_id = pc.playlist_id AND pi.added_by_user_id = pc.user_id
    WHERE pc.playlist_id = p_playlist_id AND pc.status = 'accepted'
    GROUP BY p.id, p.username, p.avatar_url, pc.role
    
    UNION ALL
    
    -- Include the owner
    SELECT 
        pl.user_id,
        prof.username,
        prof.avatar_url,
        COALESCE(COUNT(pi.id)::INTEGER, 0) as items_added,
        'owner'::TEXT as role
    FROM public.playlists pl
    JOIN public.profiles prof ON prof.id = pl.user_id
    LEFT JOIN public.playlist_items pi ON pi.playlist_id = pl.id AND pi.added_by_user_id = pl.user_id
    WHERE pl.id = p_playlist_id
    GROUP BY pl.user_id, prof.username, prof.avatar_url;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Helper Function: Recommend Movies to Watch Together
-- ------------------------------------------------------------------------------
-- Finds movies both users would likely enjoy based on their individual watch history

CREATE OR REPLACE FUNCTION get_watch_together_recommendations(p_playlist_id UUID, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    tmdb_id TEXT,
    score INTEGER,
    matching_genres TEXT[]
) AS $$
DECLARE
    user_ids UUID[];
    common_genres TEXT[];
BEGIN
    -- Get all collaborators + owner for this playlist
    SELECT ARRAY_AGG(DISTINCT user_id) INTO user_ids
    FROM (
        SELECT user_id FROM public.playlist_collaborators 
        WHERE playlist_id = p_playlist_id AND status = 'accepted'
        UNION
        SELECT user_id FROM public.playlists WHERE id = p_playlist_id
    ) users;
    
    -- Find genres that ALL users enjoy (from their watch history)
    -- This is a simplified version - you can enhance with ML later
    SELECT ARRAY_AGG(DISTINCT genre_key) INTO common_genres
    FROM (
        SELECT jsonb_object_keys(stats->'genre_counts') as genre_key, id
        FROM public.profiles
        WHERE id = ANY(user_ids)
    ) genres
    GROUP BY genre_key
    HAVING COUNT(DISTINCT id) = CARDINALITY(user_ids); -- All users must have this genre
    
    -- Return placeholder (integrate with TMDB API on frontend)
    RETURN QUERY
    SELECT 
        ''::TEXT as tmdb_id,
        0::INTEGER as score,
        COALESCE(common_genres, ARRAY[]::TEXT[]) as matching_genres;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
