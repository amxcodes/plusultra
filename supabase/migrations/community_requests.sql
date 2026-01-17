-- Community Requests System

-- 1. Movie Requests Table
CREATE TABLE IF NOT EXISTS public.movie_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tmdb_id TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
    title TEXT NOT NULL,
    poster_path TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled')),
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by TMDB ID (to prevent duplicates)
CREATE INDEX IF NOT EXISTS idx_movie_requests_tmdb ON public.movie_requests(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_movie_requests_status ON public.movie_requests(status);

-- 2. Request Replies (Links) Table
CREATE TABLE IF NOT EXISTS public.request_replies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id UUID REFERENCES public.movie_requests(id) ON DELETE CASCADE,
    tmdb_id TEXT NOT NULL, -- Redundant but useful for direct player lookups
    content TEXT NOT NULL, -- The Link
    link_type TEXT DEFAULT 'other', -- 'gdrive', 'mega', 'magnet', 'stream'
    instructions TEXT,
    upvotes INT DEFAULT 0,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_replies_tmdb ON public.request_replies(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_replies_request ON public.request_replies(request_id);

-- 3. Reply Votes Table (To track who voted)
CREATE TABLE IF NOT EXISTS public.reply_votes (
    reply_id UUID REFERENCES public.request_replies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    vote INT NOT NULL CHECK (vote IN (1, -1)), -- 1 for upvote, -1 for downvote
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (reply_id, user_id)
);

-- 4. RLS Policies

-- Enable RLS
ALTER TABLE public.movie_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reply_votes ENABLE ROW LEVEL SECURITY;

-- Requests: Everyone can read, Authenticated can create
CREATE POLICY "Requests are viewable by everyone" ON public.movie_requests
    FOR SELECT USING (true);

CREATE POLICY "Users can create requests" ON public.movie_requests
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Replies: Everyone can read, Authenticated can create
CREATE POLICY "Replies are viewable by everyone" ON public.request_replies
    FOR SELECT USING (true);

CREATE POLICY "Users can add replies" ON public.request_replies
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Votes: Everyone can read votes, Authenticated can vote
CREATE POLICY "Votes are viewable by everyone" ON public.reply_votes
    FOR SELECT USING (true);

CREATE POLICY "Users can vote" ON public.reply_votes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can change their vote" ON public.reply_votes
    FOR UPDATE USING (auth.uid() = user_id);

-- 5. RPC Function to Handle Voting and Update Counts safely
CREATE OR REPLACE FUNCTION public.handle_reply_vote(
    p_reply_id UUID,
    p_vote INT
) RETURNS INT AS $$
DECLARE
    current_vote INT;
    new_total INT;
BEGIN
    -- Check if user already voted
    SELECT vote INTO current_vote
    FROM public.reply_votes
    WHERE reply_id = p_reply_id AND user_id = auth.uid();

    IF current_vote IS NOT NULL THEN
        -- If same vote, ignore (or could toggle off, but let's just ignore for now)
        IF current_vote = p_vote THEN
            RETURN (SELECT upvotes FROM public.request_replies WHERE id = p_reply_id);
        END IF;

        -- Update existing vote
        UPDATE public.reply_votes
        SET vote = p_vote
        WHERE reply_id = p_reply_id AND user_id = auth.uid();

        -- Update total count (Difference is 2 if flipping 1 -> -1 or -1 -> 1)
        -- Actually easier to just re-count or simple math
        UPDATE public.request_replies
        SET upvotes = upvotes + (p_vote - current_vote)
        WHERE id = p_reply_id
        RETURNING upvotes INTO new_total;
    ELSE
        -- Insert new vote
        INSERT INTO public.reply_votes (reply_id, user_id, vote)
        VALUES (p_reply_id, auth.uid(), p_vote);

        -- Update total count
        UPDATE public.request_replies
        SET upvotes = upvotes + p_vote
        WHERE id = p_reply_id
        RETURNING upvotes INTO new_total;
    END IF;

    RETURN new_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
