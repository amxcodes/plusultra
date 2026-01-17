-- Create friend_compatibility table for persistent vibe checks
CREATE TABLE IF NOT EXISTS public.friend_compatibility (
    user_a UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_b UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    shared_genres JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_a, user_b),
    CONSTRAINT users_ordered CHECK (user_a < user_b)
);

-- Enable RLS
ALTER TABLE public.friend_compatibility ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own compatibility"
ON public.friend_compatibility FOR SELECT
USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "Users can insert/update their own compatibility"
ON public.friend_compatibility FOR INSERT
WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "Users can update their own compatibility"
ON public.friend_compatibility FOR UPDATE
USING (auth.uid() = user_a OR auth.uid() = user_b);

-- Function to safely upsert compatibility (handles A/B order)
CREATE OR REPLACE FUNCTION upsert_friend_compatibility(
    p_user_1 UUID,
    p_user_2 UUID,
    p_score INTEGER,
    p_shared_genres JSONB
)
RETURNS VOID AS $$
DECLARE
    u_a UUID;
    u_b UUID;
BEGIN
    -- Ensure consistent ordering to match table constraint
    IF p_user_1 < p_user_2 THEN
        u_a := p_user_1;
        u_b := p_user_2;
    ELSE
        u_a := p_user_2;
        u_b := p_user_1;
    END IF;

    INSERT INTO public.friend_compatibility (user_a, user_b, score, shared_genres, updated_at)
    VALUES (u_a, u_b, p_score, p_shared_genres, NOW())
    ON CONFLICT (user_a, user_b)
    DO UPDATE SET 
        score = EXCLUDED.score,
        shared_genres = EXCLUDED.shared_genres,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
