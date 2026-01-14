-- ==============================================================================
-- 🚀 COMPLETE STATS MIGRATION - RUN THIS ONCE
-- ==============================================================================
-- This script does everything:
-- 1. Removes old total_minutes field
-- 2. Replaces old RPC with stats-aware version
-- 3. Backfills stats for existing users
-- ==============================================================================

-- STEP 1: CLEANUP - Remove total_minutes from existing users
-- ------------------------------------------------------------------------------
UPDATE public.profiles
SET stats = stats - 'total_minutes'
WHERE stats ? 'total_minutes';


-- STEP 2: REPLACE OLD RPC WITH STATS-AWARE VERSION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_watch_history(
  p_user_id uuid,
  p_tmdb_id text,
  p_data jsonb
)
RETURNS void AS $$
DECLARE
  current_stats JSONB;
  current_history JSONB;
  is_new_item BOOLEAN;
  media_type TEXT;
  previous_last_watched TIMESTAMPTZ;
  days_since_last_watch INT;
  current_streak INT;
  genres JSONB;
  genre_name TEXT;
BEGIN
  -- 1. Fetch current data in ONE query
  SELECT watch_history, stats INTO current_history, current_stats 
  FROM public.profiles WHERE id = p_user_id;

  -- 2. Initialize defaults
  IF current_history IS NULL THEN current_history := '{}'::jsonb; END IF;
  IF current_stats IS NULL THEN 
    current_stats := '{"total_movies": 0, "total_shows": 0, "streak_days": 0, "genre_counts": {}}'::jsonb; 
  END IF;

  -- 3. Extract media type and genres from the data being saved
  media_type := p_data->>'type';
  genres := p_data->'genres'; -- Try to extract genres array from metadata

  -- 4. Check if new item
  is_new_item := NOT (current_history ? p_tmdb_id);

  -- 5. Update watch history
  current_history := jsonb_set(current_history, array[p_tmdb_id], p_data);

  -- 6. Update stats ONLY if new item
  IF is_new_item THEN
    IF media_type = 'movie' THEN
      current_stats := jsonb_set(current_stats, '{total_movies}', 
        ((current_stats->>'total_movies')::int + 1)::text::jsonb);
    ELSIF media_type = 'tv' THEN
      current_stats := jsonb_set(current_stats, '{total_shows}', 
        ((current_stats->>'total_shows')::int + 1)::text::jsonb);
    END IF;

    -- 7. Update genre counts if genres are present
    IF genres IS NOT NULL AND jsonb_typeof(genres) = 'array' THEN
      FOR genre_name IN SELECT jsonb_array_elements_text(genres)
      LOOP
        current_stats := jsonb_set(
          current_stats,
          array['genre_counts', genre_name],
          (COALESCE((current_stats->'genre_counts'->>genre_name)::int, 0) + 1)::text::jsonb
        );
      END LOOP;
    END IF;
  END IF;

  -- 7. Calculate streak (inlined for performance)
  previous_last_watched := (current_stats->>'last_watched')::timestamptz;
  current_streak := COALESCE((current_stats->>'streak_days')::int, 0);
  
  IF previous_last_watched IS NULL THEN
    current_streak := 1;
  ELSE
    days_since_last_watch := EXTRACT(DAY FROM (CURRENT_DATE - DATE(previous_last_watched)));
    
    IF days_since_last_watch = 0 THEN
      current_streak := current_streak; -- Same day, no change
    ELSIF days_since_last_watch = 1 THEN
      current_streak := current_streak + 1; -- Consecutive
    ELSE
      current_streak := 1; -- Reset
    END IF;
  END IF;
  
  current_stats := jsonb_set(current_stats, '{streak_days}', current_streak::text::jsonb);
  current_stats := jsonb_set(current_stats, '{last_watched}', to_jsonb(now()));

  -- 8. SINGLE ATOMIC UPDATE (Netflix-style fast!)
  UPDATE public.profiles
  SET 
    watch_history = current_history,
    stats = current_stats,
    last_seen_activity = now()
  WHERE id = p_user_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- STEP 3: BACKFILL STATS FROM EXISTING WATCH HISTORY
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  user_record RECORD;
  history_item RECORD;
  new_stats JSONB;
  total_movies INT;
  total_shows INT;
  genre_counts JSONB;
  last_watched TIMESTAMPTZ;
BEGIN
  
  RAISE NOTICE '🚀 Starting backfill...';
  
  -- Loop through all users with watch history
  FOR user_record IN 
    SELECT id, watch_history 
    FROM public.profiles 
    WHERE watch_history IS NOT NULL 
      AND watch_history::text != '{}'
  LOOP
    
    -- Initialize counters
    total_movies := 0;
    total_shows := 0;
    genre_counts := '{}'::jsonb;
    last_watched := NULL;
    
    -- Loop through each item in watch_history
    FOR history_item IN 
      SELECT 
        key as tmdb_id,
        value->>'type' as media_type,
        (value->>'lastUpdated')::bigint as last_updated_ms
      FROM jsonb_each(user_record.watch_history)
    LOOP
      
      -- Count movies vs shows
      IF history_item.media_type = 'movie' THEN
        total_movies := total_movies + 1;
      ELSIF history_item.media_type = 'tv' THEN
        total_shows := total_shows + 1;
      END IF;
      
      -- Track last watched timestamp
      IF history_item.last_updated_ms IS NOT NULL THEN
        DECLARE
          item_timestamp TIMESTAMPTZ;
        BEGIN
          item_timestamp := to_timestamp(history_item.last_updated_ms::double precision / 1000);
          IF last_watched IS NULL OR item_timestamp > last_watched THEN
            last_watched := item_timestamp;
          END IF;
        END;
      END IF;
      
    END LOOP;
    
    -- Build stats object
    new_stats := jsonb_build_object(
      'total_movies', total_movies,
      'total_shows', total_shows,
      'streak_days', 0, -- Will calculate on next watch
      'last_watched', last_watched,
      'genre_counts', '{}'::jsonb -- Will populate from new watches
    );
    
    -- Update user's stats
    UPDATE public.profiles
    SET stats = new_stats
    WHERE id = user_record.id;
    
    RAISE NOTICE '✓ User %: % movies, % shows', 
      user_record.id, total_movies, total_shows;
    
  END LOOP;
  
  RAISE NOTICE '🎉 Backfill complete!';
  
END $$;


-- ==============================================================================
-- ✅ MIGRATION COMPLETE!
-- ==============================================================================
-- Check the logs above to see backfilled users
-- Test by watching a movie - stats should auto-update!
-- ==============================================================================
