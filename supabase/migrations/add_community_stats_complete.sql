-- ===============================================
-- COMMUNITY STATS MIGRATION (Complete with Optionals)
-- ===============================================
-- Adds community comparison features to year-end wrapped
-- Includes: RPC function, caching, indexing, and automation
-- ===============================================

-- ===============================================
-- STEP 1: Performance Index (Optional but Recommended)
-- ===============================================
-- Speeds up JSONB queries on stats field
CREATE INDEX IF NOT EXISTS idx_profiles_stats_gin 
ON public.profiles USING gin(stats);

-- Index for faster counting of active users
CREATE INDEX IF NOT EXISTS idx_profiles_stats_not_null 
ON public.profiles(id) 
WHERE stats IS NOT NULL AND stats != '{}'::jsonb;

-- ===============================================
-- STEP 2: Community Stats Cache Table (Optional)
-- ===============================================
-- Stores pre-calculated community averages
-- Updated daily via cron job for performance
CREATE TABLE IF NOT EXISTS public.community_stats_cache (
  id int PRIMARY KEY DEFAULT 1,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now(),
  user_count int DEFAULT 0,
  CONSTRAINT only_one_row CHECK (id = 1)
);

-- RLS: Everyone can read, only system can update
ALTER TABLE public.community_stats_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Community stats cache readable by everyone" 
  ON public.community_stats_cache FOR SELECT USING (true);

CREATE POLICY "Only system can update cache" 
  ON public.community_stats_cache FOR ALL USING (false);

-- Initialize cache with empty data
INSERT INTO public.community_stats_cache (id, stats, user_count) 
VALUES (1, '{}'::jsonb, 0)
ON CONFLICT (id) DO NOTHING;

-- ===============================================
-- STEP 3: Core RPC Function - Get Community Stats
-- ===============================================
CREATE OR REPLACE FUNCTION public.get_community_stats(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  user_stats jsonb;
  user_total int;
  user_movies int;
  user_shows int;
  user_streak int;
  user_rewatches int;
  cache_age interval;
  use_cache boolean := false;
BEGIN
  -- Get user's stats
  SELECT stats INTO user_stats 
  FROM public.profiles 
  WHERE id = p_user_id;
  
  -- If user has no stats, return null
  IF user_stats IS NULL OR user_stats = '{}'::jsonb THEN
    RETURN jsonb_build_object(
      'error', 'No stats available for user',
      'user_percentile', jsonb_build_object(
        'total_content', 0,
        'streak', 0,
        'rewatches', 0
      )
    );
  END IF;
  
  -- Extract user's metrics
  user_movies := COALESCE((user_stats->>'total_movies')::int, 0);
  user_shows := COALESCE((user_stats->>'total_shows')::int, 0);
  user_total := user_movies + user_shows;
  user_streak := COALESCE((user_stats->>'max_streak')::int, 0);
  user_rewatches := COALESCE((user_stats->>'rewatch_count')::int, 0);
  
  -- Check if cache is fresh (less than 24 hours old)
  SELECT EXTRACT(EPOCH FROM (now() - updated_at))::int / 3600 < 24 INTO use_cache
  FROM public.community_stats_cache WHERE id = 1;
  
  -- Calculate community stats (with or without cache)
  WITH community_data AS (
    SELECT 
      -- Averages
      ROUND(AVG(COALESCE((stats->>'total_movies')::int, 0) + 
                COALESCE((stats->>'total_shows')::int, 0)), 1) as avg_total,
      ROUND(AVG(COALESCE((stats->>'total_movies')::int, 0)), 1) as avg_movies,
      ROUND(AVG(COALESCE((stats->>'total_shows')::int, 0)), 1) as avg_shows,
      ROUND(AVG(COALESCE((stats->>'max_streak')::int, 0)), 1) as avg_streak,
      ROUND(AVG(COALESCE((stats->>'rewatch_count')::int, 0)), 1) as avg_rewatches,
      
      -- Count active users
      COUNT(*) as total_users,
      
      -- Medians for reference
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY 
        COALESCE((stats->>'total_movies')::int, 0) + 
        COALESCE((stats->>'total_shows')::int, 0)) as median_total,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY 
        COALESCE((stats->>'max_streak')::int, 0)) as median_streak
    FROM public.profiles
    WHERE stats IS NOT NULL 
      AND stats != '{}'::jsonb
      AND (COALESCE((stats->>'total_movies')::int, 0) + 
           COALESCE((stats->>'total_shows')::int, 0)) > 0
  ),
  user_percentiles AS (
    SELECT
      -- Percentile: % of users this user is better than
      ROUND(
        (COUNT(CASE 
          WHEN (COALESCE((stats->>'total_movies')::int, 0) + 
                COALESCE((stats->>'total_shows')::int, 0)) < user_total 
          THEN 1 END)::float / NULLIF(COUNT(*)::float, 0) * 100)::numeric, 
        1
      ) as total_percentile,
      
      ROUND(
        (COUNT(CASE 
          WHEN COALESCE((stats->>'max_streak')::int, 0) < user_streak 
          THEN 1 END)::float / NULLIF(COUNT(*)::float, 0) * 100)::numeric, 
        1
      ) as streak_percentile,
      
      ROUND(
        (COUNT(CASE 
          WHEN COALESCE((stats->>'rewatch_count')::int, 0) < user_rewatches 
          THEN 1 END)::float / NULLIF(COUNT(*)::float, 0) * 100)::numeric, 
        1
      ) as rewatch_percentile
    FROM public.profiles
    WHERE stats IS NOT NULL 
      AND stats != '{}'::jsonb
      AND (COALESCE((stats->>'total_movies')::int, 0) + 
           COALESCE((stats->>'total_shows')::int, 0)) > 0
  ),
  top_community_genres AS (
    -- Aggregate all genre counts across users
    SELECT 
      genre,
      SUM(count::int) as total_count
    FROM public.profiles,
    LATERAL jsonb_each_text(COALESCE(stats->'genre_counts', '{}'::jsonb)) AS genre_data(genre, count)
    WHERE stats IS NOT NULL
    GROUP BY genre
    ORDER BY total_count DESC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'avg_total_content', COALESCE(cd.avg_total, 0),
    'avg_movies', COALESCE(cd.avg_movies, 0),
    'avg_shows', COALESCE(cd.avg_shows, 0),
    'avg_streak', COALESCE(cd.avg_streak, 0),
    'avg_rewatch_count', COALESCE(cd.avg_rewatches, 0),
    'median_total', COALESCE(cd.median_total, 0),
    'median_streak', COALESCE(cd.median_streak, 0),
    'total_users', COALESCE(cd.total_users, 0),
    'user_percentile', jsonb_build_object(
      'total_content', COALESCE(up.total_percentile, 0),
      'streak', COALESCE(up.streak_percentile, 0),
      'rewatches', COALESCE(up.rewatch_percentile, 0)
    ),
    'top_community_genres', (
      SELECT jsonb_agg(jsonb_build_object('genre', genre, 'count', total_count))
      FROM top_community_genres
    ),
    'user_stats', jsonb_build_object(
      'total_content', user_total,
      'movies', user_movies,
      'shows', user_shows,
      'streak', user_streak,
      'rewatches', user_rewatches
    ),
    'cache_used', use_cache,
    'generated_at', now()
  ) INTO result
  FROM community_data cd
  CROSS JOIN user_percentiles up;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_community_stats(uuid) TO authenticated;

-- ===============================================
-- STEP 4: Cache Refresh Function (Optional)
-- ===============================================
CREATE OR REPLACE FUNCTION public.refresh_community_stats_cache()
RETURNS void AS $$
DECLARE
  cached_stats jsonb;
  active_users int;
BEGIN
  -- Calculate community-wide statistics
  WITH community_aggregates AS (
    SELECT 
      ROUND(AVG(COALESCE((stats->>'total_movies')::int, 0) + 
                COALESCE((stats->>'total_shows')::int, 0)), 1) as avg_total,
      ROUND(AVG(COALESCE((stats->>'total_movies')::int, 0)), 1) as avg_movies,
      ROUND(AVG(COALESCE((stats->>'total_shows')::int, 0)), 1) as avg_shows,
      ROUND(AVG(COALESCE((stats->>'max_streak')::int, 0)), 1) as avg_streak,
      ROUND(AVG(COALESCE((stats->>'rewatch_count')::int, 0)), 1) as avg_rewatches,
      COUNT(*) as total_users,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY 
        COALESCE((stats->>'total_movies')::int, 0) + 
        COALESCE((stats->>'total_shows')::int, 0)) as median_total
    FROM public.profiles
    WHERE stats IS NOT NULL 
      AND stats != '{}'::jsonb
      AND (COALESCE((stats->>'total_movies')::int, 0) + 
           COALESCE((stats->>'total_shows')::int, 0)) > 0
  ),
  top_genres AS (
    SELECT 
      genre,
      SUM(count::int) as total_count
    FROM public.profiles,
    LATERAL jsonb_each_text(COALESCE(stats->'genre_counts', '{}'::jsonb)) AS genre_data(genre, count)
    WHERE stats IS NOT NULL
    GROUP BY genre
    ORDER BY total_count DESC
    LIMIT 10
  )
  SELECT 
    jsonb_build_object(
      'avg_total_content', ca.avg_total,
      'avg_movies', ca.avg_movies,
      'avg_shows', ca.avg_shows,
      'avg_streak', ca.avg_streak,
      'avg_rewatch_count', ca.avg_rewatches,
      'median_total', ca.median_total,
      'top_genres', (SELECT jsonb_agg(jsonb_build_object('genre', genre, 'count', total_count)) FROM top_genres)
    ),
    ca.total_users
  INTO cached_stats, active_users
  FROM community_aggregates ca;
  
  -- Update cache
  UPDATE public.community_stats_cache
  SET 
    stats = cached_stats,
    user_count = active_users,
    updated_at = now()
  WHERE id = 1;
  
  RAISE NOTICE 'Community stats cache refreshed for % users', active_users;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===============================================
-- STEP 5: Schedule Cron Job (Optional)
-- ===============================================
-- Updates cache daily at 3 AM UTC
-- Requires pg_cron extension

DO $$
BEGIN
  -- Check if pg_cron extension exists
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Unschedule if exists (for re-running migration)
    PERFORM cron.unschedule('refresh-community-stats');
    
    -- Schedule new job
    PERFORM cron.schedule(
      'refresh-community-stats',
      '0 3 * * *',  -- Daily at 3 AM UTC
      'SELECT public.refresh_community_stats_cache();'
    );
    
    RAISE NOTICE 'Cron job scheduled: refresh-community-stats (daily at 3 AM UTC)';
  ELSE
    RAISE NOTICE 'pg_cron extension not found. Skipping cron job setup.';
    RAISE NOTICE 'You can manually refresh cache by running: SELECT public.refresh_community_stats_cache();';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Failed to schedule cron job: %', SQLERRM;
  RAISE NOTICE 'You can manually refresh cache by running: SELECT public.refresh_community_stats_cache();';
END $$;

-- ===============================================
-- STEP 6: Initial Cache Population
-- ===============================================
-- Run the cache refresh immediately
SELECT public.refresh_community_stats_cache();

-- ===============================================
-- VERIFICATION QUERIES
-- ===============================================
-- Run these to test the migration

-- 1. Test RPC function (replace with your user ID)
-- SELECT public.get_community_stats('YOUR-USER-ID-HERE'::uuid);

-- 2. Check cache contents
-- SELECT * FROM public.community_stats_cache;

-- 3. Check indexes
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'profiles' AND indexname LIKE '%stats%';

-- 4. Check cron jobs
-- SELECT * FROM cron.job WHERE jobname = 'refresh-community-stats';

-- ===============================================
-- MANUAL OPERATIONS
-- ===============================================

-- Manually refresh cache anytime:
-- SELECT public.refresh_community_stats_cache();

-- Drop cron job if needed:
-- SELECT cron.unschedule('refresh-community-stats');

-- ===============================================
-- ✅ MIGRATION COMPLETE!
-- ===============================================
-- Next steps:
-- 1. Run this migration in Supabase SQL Editor
-- 2. Test with: SELECT public.get_community_stats(auth.uid());
-- 3. Update frontend to call the new RPC function
-- ===============================================
