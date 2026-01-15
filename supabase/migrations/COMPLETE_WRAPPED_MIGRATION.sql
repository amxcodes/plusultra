-- ===============================================
-- COMPLETE MIGRATION: Base + Phase 1 Wrapped Fields
-- ===============================================
-- This combines MASTER_STATS_MIGRATION.sql + phase1_add_wrapped_fields.sql
-- Run this ONCE in Supabase SQL Editor
-- ===============================================

-- STEP 1: Add stats column if it doesn't exist (safety check)
-- ===============================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'stats'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN stats JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- STEP 2: Create update_watch_history function with Wrapped fields
-- ===============================================
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

  -- 2. Initialize stats with Wrapped fields
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

  -- 4. Update watch history
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
    days_since_last_watch := CURRENT_DATE - DATE(previous_last_watched);
    
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

  -- 7. Track max streak (Wrapped)
  IF current_streak > COALESCE((current_stats->>'max_streak')::int, 0) THEN
    current_stats := jsonb_set(current_stats, '{max_streak}', current_streak::text::jsonb);
  END IF;

  -- 8. Track monthly watches (Wrapped)
  current_month := to_char(now(), 'YYYY-MM');
  current_stats := jsonb_set(
    current_stats, 
    array['monthly_watches', current_month], 
    (COALESCE((current_stats->'monthly_watches'->>current_month)::int, 0) + 1)::text::jsonb
  );

  -- 9. Track first watch of year (Wrapped)
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
    current_stats := jsonb_set(current_stats, '{year}', current_year::text::jsonb);
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
-- STEP 3: Disable Pruning (Safe version)
-- ===============================================

DO $$
BEGIN
  PERFORM cron.unschedule('periodic-history-prune');
  RAISE NOTICE 'Unscheduled periodic-history-prune';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Job periodic-history-prune not found, skipping';
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-inactive-watch-history');
  RAISE NOTICE 'Unscheduled cleanup-inactive-watch-history';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Job cleanup-inactive-watch-history not found, skipping';  
END $$;

-- ===============================================
-- ✅ MIGRATION COMPLETE!
-- ===============================================

-- Verify the function was created:
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_name = 'update_watch_history'
  AND routine_schema = 'public';

-- Should return:
-- routine_name         | routine_type
-- ---------------------|-------------
-- update_watch_history | FUNCTION
