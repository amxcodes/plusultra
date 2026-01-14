-- ==============================================================================
-- 📊 STATS BACKFILL - Populate stats from existing watch_history
-- ==============================================================================
-- Run this AFTER stats_system.sql to backfill stats for existing users
-- This is a ONE-TIME migration
-- ==============================================================================

CREATE OR REPLACE FUNCTION backfill_user_stats()
RETURNS void AS $$
DECLARE
  user_record RECORD;
  history_item RECORD;
  new_stats JSONB;
  total_movies INT;
  total_shows INT;
  genre_counts JSONB;
  last_watched TIMESTAMPTZ;
BEGIN
  
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
    -- Note: We can't backfill genres since watch_history doesn't store them
    -- Genres will accumulate from NEW watches going forward
    new_stats := jsonb_build_object(
      'total_movies', total_movies,
      'total_shows', total_shows,
      'streak_days', 0, -- Can't calculate streak from history, will track going forward
      'last_watched', last_watched,
      'genre_counts', '{}'::jsonb -- Will populate from new watches
    );
    
    -- Update user's stats
    UPDATE public.profiles
    SET stats = new_stats
    WHERE id = user_record.id;
    
    RAISE NOTICE 'Backfilled stats for user %: % movies, % shows', 
      user_record.id, total_movies, total_shows;
    
  END LOOP;
  
  RAISE NOTICE 'Backfill complete!';
  
END;
$$ LANGUAGE plpgsql;

-- Execute the backfill
SELECT backfill_user_stats();

-- Drop the function (we only need it once)
DROP FUNCTION backfill_user_stats();
