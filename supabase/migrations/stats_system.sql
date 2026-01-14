-- ==============================================================================
-- 📊 STATS & ANALYTICS SYSTEM - Production Migration
-- ==============================================================================
-- Run this in Supabase SQL Editor
-- ==============================================================================

-- 1. Add stats column to profiles
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS stats JSONB DEFAULT '{
  "total_movies": 0,
  "total_shows": 0,
  "streak_days": 0,
  "last_watched": null,
  "genre_counts": {}
}'::jsonb;

-- 2. Server Voting Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.server_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tmdb_id TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  season INTEGER DEFAULT 1,
  episode INTEGER DEFAULT 1,
  provider_id TEXT NOT NULL,
  vote_count INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tmdb_id, media_type, season, episode, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_server_votes_lookup 
ON public.server_votes(tmdb_id, media_type, season, episode);

-- RLS for server_votes
ALTER TABLE public.server_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view server votes" ON public.server_votes;
CREATE POLICY "Anyone can view server votes" ON public.server_votes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can vote" ON public.server_votes;
CREATE POLICY "Authenticated users can vote" ON public.server_votes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Community Stats Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_stats (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  trending_daily JSONB DEFAULT '[]'::jsonb,
  trending_weekly JSONB DEFAULT '[]'::jsonb,
  most_watched_all_time JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.community_stats (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.community_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public community stats" ON public.community_stats;
CREATE POLICY "Public community stats" ON public.community_stats FOR SELECT USING (true);

-- 4. RPC Functions
-- ------------------------------------------------------------------------------

-- Increment server vote (Anonymous)
CREATE OR REPLACE FUNCTION increment_server_vote(
  p_tmdb_id TEXT,
  p_media_type TEXT,
  p_season INTEGER,
  p_episode INTEGER,
  p_provider_id TEXT
) RETURNS void AS $$
BEGIN
  INSERT INTO public.server_votes (tmdb_id, media_type, season, episode, provider_id, vote_count)
  VALUES (p_tmdb_id, p_media_type, p_season, p_episode, p_provider_id, 1)
  ON CONFLICT (tmdb_id, media_type, season, episode, provider_id)
  DO UPDATE SET 
    vote_count = server_votes.vote_count + 1,
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update watch history with stats
CREATE OR REPLACE FUNCTION update_watch_history_with_stats(
  p_user_id uuid,
  p_tmdb_id text,
  p_media_type text,
  p_duration int,
  p_genres text[],
  p_data jsonb
)
RETURNS void AS $$
DECLARE
  current_stats JSONB;
  current_history JSONB;
  is_new_item BOOLEAN;
  g text;
BEGIN
  -- Fetch current data
  SELECT watch_history, stats INTO current_history, current_stats 
  FROM public.profiles WHERE id = p_user_id;

  -- Initialize defaults
  IF current_history IS NULL THEN current_history := '{}'::jsonb; END IF;
  IF current_stats IS NULL THEN 
    current_stats := '{"total_movies": 0, "total_shows": 0, "streak_days": 0, "genre_counts": {}}'::jsonb; 
  END IF;

  -- Check if new item
  is_new_item := NOT (current_history ? p_tmdb_id);

  -- Update watch history
  current_history := jsonb_set(current_history, array[p_tmdb_id], p_data);

  -- Update counters if new
  IF is_new_item THEN
    IF p_media_type = 'movie' THEN
      current_stats := jsonb_set(current_stats, '{total_movies}', ((current_stats->>'total_movies')::int + 1)::text::jsonb);
    ELSE
      current_stats := jsonb_set(current_stats, '{total_shows}', ((current_stats->>'total_shows')::int + 1)::text::jsonb);
    END IF;
  END IF;

  -- Update genres
  IF is_new_item AND p_genres IS NOT NULL THEN
    FOREACH g IN ARRAY p_genres
    LOOP
      current_stats := jsonb_set(
        current_stats,
        array['genre_counts', g],
        (COALESCE((current_stats->'genre_counts'->>g)::int, 0) + 1)::text::jsonb
      );
    END LOOP;
  END IF;

  -- Update last watched & calculate streak
  DECLARE
    previous_last_watched TIMESTAMPTZ;
    days_since_last_watch INT;
    current_streak INT;
  BEGIN
    previous_last_watched := (current_stats->>'last_watched')::timestamptz;
    current_streak := COALESCE((current_stats->>'streak_days')::int, 0);
    
    IF previous_last_watched IS NULL THEN
      -- First time watching
      current_streak := 1;
    ELSE
      -- Calculate days between last watch and today
      days_since_last_watch := EXTRACT(DAY FROM (CURRENT_DATE - DATE(previous_last_watched)));
      
      IF days_since_last_watch = 0 THEN
        -- Watched earlier today, keep streak
        current_streak := current_streak;
      ELSIF days_since_last_watch = 1 THEN
        -- Watched yesterday, increment streak
        current_streak := current_streak + 1;
      ELSE
        -- Missed a day or more, reset streak
        current_streak := 1;
      END IF;
    END IF;
    
    -- Update stats with new streak and timestamp
    current_stats := jsonb_set(current_stats, '{streak_days}', current_streak::text::jsonb);
    current_stats := jsonb_set(current_stats, '{last_watched}', to_jsonb(now()));
  END;

  -- Commit
  UPDATE public.profiles
  SET 
    watch_history = current_history,
    stats = current_stats,
    last_seen_activity = now()
  WHERE id = p_user_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Prune old watch history (keeps stats)
CREATE OR REPLACE FUNCTION prune_watch_history()
RETURNS void AS $$
DECLARE
  user_record RECORD;
  new_history JSONB;
  cutoff_ms BIGINT;
BEGIN
  -- 60 days ago in milliseconds
  cutoff_ms := (EXTRACT(EPOCH FROM NOW()) - (60 * 24 * 60 * 60)) * 1000;

  FOR user_record IN SELECT id, watch_history FROM public.profiles WHERE watch_history IS NOT NULL LOOP
    
    -- Filter items older than 60 days
    SELECT jsonb_object_agg(key, value)
    INTO new_history
    FROM jsonb_each(user_record.watch_history)
    WHERE (value->>'lastUpdated')::bigint >= cutoff_ms;

    -- Update if changed
    IF new_history IS DISTINCT FROM user_record.watch_history THEN
      UPDATE public.profiles
      SET watch_history = COALESCE(new_history, '{}'::jsonb)
      WHERE id = user_record.id;
    END IF;
    
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- NOTE: Cron job scheduling requires pg_cron extension
-- Run this separately ONLY if pg_cron is enabled:
-- SELECT cron.schedule('periodic-history-prune', '0 3 1 */2 *', 'SELECT prune_watch_history();');
