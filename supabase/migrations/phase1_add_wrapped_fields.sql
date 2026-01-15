-- ===============================================
-- PHASE 1: ADD WRAPPED TRACKING FIELDS
-- ===============================================
-- Run this migration to add Year End Wrapped tracking
-- Estimated time: < 1 minute for existing users
-- ===============================================

-- Update the update_watch_history function to track wrapped-specific fields
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
  current_month TEXT;
  current_year INT;
BEGIN
  -- 1. Fetch current data
  SELECT watch_history, stats INTO current_history, current_stats 
  FROM public.profiles WHERE id = p_user_id;

  -- 2. Initialize stats with NEW wrapped fields
  IF current_stats IS NULL THEN 
    current_stats := jsonb_build_object(
      'total_movies', 0,
      'total_shows', 0,
      'streak_days', 0,
      'max_streak', 0,
      'genre_counts', '{}'::jsonb,
      'monthly_watches', '{}'::jsonb,
      'first_watch_of_year', null,
      'year', extract(year from now())
    );
  END IF;
  
  IF current_history IS NULL THEN 
    current_history := '{}'::jsonb; 
  END IF;

  -- Ensure all wrapped fields exist (for existing users)
  IF current_stats->'genre_counts' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{genre_counts}', '{}'::jsonb);
  END IF;
  IF current_stats->'max_streak' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{max_streak}', '0'::jsonb);
  END IF;
  IF current_stats->'monthly_watches' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{monthly_watches}', '{}'::jsonb);
  END IF;
  IF current_stats->'year' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{year}', to_jsonb(extract(year from now())::int));
  END IF;

  -- 3. Extract metadata
  media_type := p_data->>'type';
  genres := p_data->'genres';
  is_new_item := NOT (current_history ? p_tmdb_id);

  -- 4. Update watch history (unchanged)
  current_history := jsonb_set(current_history, array[p_tmdb_id], p_data);

  -- 5. Update counters if new item
  IF is_new_item THEN
    IF media_type = 'movie' THEN
      current_stats := jsonb_set(current_stats, '{total_movies}', 
        ((current_stats->>'total_movies')::int + 1)::text::jsonb);
    ELSIF media_type = 'tv' THEN
      current_stats := jsonb_set(current_stats, '{total_shows}', 
        ((current_stats->>'total_shows')::int + 1)::text::jsonb);
    END IF;

    -- Update genre counts
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

  -- 6. Calculate streak
  previous_last_watched := (current_stats->>'last_watched')::timestamptz;
  current_streak := COALESCE((current_stats->>'streak_days')::int, 0);
  
  IF previous_last_watched IS NULL THEN
    current_streak := 1;
  ELSE
    days_since_last_watch := EXTRACT(DAY FROM (CURRENT_DATE - DATE(previous_last_watched)));
    
    IF days_since_last_watch = 0 THEN
      current_streak := current_streak;
    ELSIF days_since_last_watch = 1 THEN
      current_streak := current_streak + 1;
    ELSE
      current_streak := 1;
    END IF;
  END IF;
  
  current_stats := jsonb_set(current_stats, '{streak_days}', current_streak::text::jsonb);
  current_stats := jsonb_set(current_stats, '{last_watched}', to_jsonb(now()));

  -- 7. NEW: Track max streak (for Wrapped)
  IF current_streak > COALESCE((current_stats->>'max_streak')::int, 0) THEN
    current_stats := jsonb_set(current_stats, '{max_streak}', current_streak::text::jsonb);
  END IF;

  -- 8. NEW: Track monthly watches (for Wrapped - favorite month)
  current_month := to_char(now(), 'YYYY-MM');
  current_stats := jsonb_set(
    current_stats, 
    array['monthly_watches', current_month], 
    (COALESCE((current_stats->'monthly_watches'->>current_month)::int, 0) + 1)::text::jsonb
  );

  -- 9. NEW: Track first watch of year (for Wrapped)
  current_year := extract(year from now());
  IF current_stats->'first_watch_of_year' IS NULL OR
     COALESCE((current_stats->'first_watch_of_year'->>'year')::int, 0) < current_year THEN
    current_stats := jsonb_set(current_stats, '{first_watch_of_year}', jsonb_build_object(
      'tmdb_id', p_tmdb_id,
      'title', p_data->>'title',
      'date', current_date::text,
      'type', media_type,
      'year', current_year
    ));
  END IF;

  -- 10. Update year tracker
  IF COALESCE((current_stats->>'year')::int, 0) < current_year THEN
    -- New year detected - reset first_watch but keep cumulative stats
    current_stats := jsonb_set(current_stats, '{year}', current_year::text::jsonb);
    -- Monthly watches can be kept for historical data or reset - keeping for now
  END IF;

  -- 11. Save
  UPDATE public.profiles
  SET 
    watch_history = current_history,
    stats = current_stats,
    last_seen_activity = now()
  WHERE id = p_user_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===============================================
-- DISABLE PRUNING (Preserve data for Wrapped)
-- ===============================================

-- Unschedule the periodic history pruning (safe version - won't error if job doesn't exist)
DO $$
BEGIN
  PERFORM cron.unschedule('periodic-history-prune');
  RAISE NOTICE 'Unscheduled periodic-history-prune';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Job periodic-history-prune not found, skipping';
END $$;

-- Unschedule the inactive user cleanup (safe version - won't error if job doesn't exist)
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-inactive-watch-history');
  RAISE NOTICE 'Unscheduled cleanup-inactive-watch-history';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Job cleanup-inactive-watch-history not found, skipping';  
END $$;

-- Comment: At 100 users, storage is ~34 MB (6.8% of free tier)
-- keeping all history is fine and needed for Wrapped

-- ===============================================
-- VERIFICATION QUERIES
-- ===============================================

-- Check that new fields exist in stats
-- Run this after migration to verify:
/*
SELECT 
  id,
  stats->>'max_streak' as max_streak,
  stats->'monthly_watches' as monthly_watches,
  stats->'first_watch_of_year' as first_watch,
  stats->>'year' as year
FROM profiles
WHERE stats IS NOT NULL
LIMIT 5;
*/
