-- ===============================================
-- COMPLETE WRAPPED BACKEND MIGRATION
-- ===============================================
-- Run this ONCE in Supabase SQL Editor
-- This includes:
-- 1. Admin toggle (wrapped_enabled)
-- 2. Enhanced stats tracking (rewatch, binge, etc.)
-- 3. Year reset logic (auto-snapshot on Jan 1st)
-- ===============================================

-- ===============================================
-- SECTION 1: Admin Toggle Setup
-- ===============================================

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

INSERT INTO public.app_settings (key, value)
VALUES ('wrapped_enabled', 'true')  -- Set to 'true' to force-unlock for testing
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists, then create it
DROP POLICY IF EXISTS "Allow public read access" ON public.app_settings;

CREATE POLICY "Allow public read access" ON public.app_settings
  FOR SELECT USING (true);

-- ===============================================
-- SECTION 2: Enhanced Watch History Function
-- ===============================================
-- This updates the existing update_watch_history function
-- Adds: rewatch tracking, binge detection, year reset logic

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
  stored_year INT;
  title TEXT;
  title_rewatch_count INT;
  today TEXT;
  today_count INT;
BEGIN
  SELECT watch_history, stats INTO current_history, current_stats 
  FROM public.profiles WHERE id = p_user_id;

  -- Initialize if null
  IF current_stats IS NULL THEN 
    current_stats := jsonb_build_object(
      'total_movies', 0,
      'total_shows', 0,
      'streak_days', 0,
      'max_streak', 0,
      'genre_counts', '{}'::jsonb,
      'monthly_watches', '{}'::jsonb,
      'first_watch_of_year', null,
      'year', extract(year from now()),
      'rewatch_count', 0,
      'binge_days', 0,
      'daily_watch_count', '{}'::jsonb,
      'title_rewatch_counts', '{}'::jsonb,
      'past_years', '{}'::jsonb
    );
  END IF;
  
  IF current_history IS NULL THEN 
    current_history := '{}'::jsonb; 
  END IF;

  -- ===============================================
  -- YEAR TRANSITION LOGIC (Jan 1st Auto-Reset)
  -- ===============================================
  current_year := extract(year from now());
  stored_year := COALESCE((current_stats->>'year')::int, current_year);

  IF stored_year < current_year THEN
     -- Initialize past_years if needed
     IF current_stats->'past_years' IS NULL THEN
        current_stats := jsonb_set(current_stats, '{past_years}', '{}'::jsonb);
     END IF;
     
     -- Snapshot old year's stats (e.g., save 2026 stats before resetting)
     current_stats := jsonb_set(
        current_stats,
        array['past_years', stored_year::text],
        current_stats - 'past_years'
     );

     -- Reset all counters for new year
     current_stats := jsonb_set(current_stats, '{total_movies}', '0'::jsonb);
     current_stats := jsonb_set(current_stats, '{total_shows}', '0'::jsonb);
     current_stats := jsonb_set(current_stats, '{streak_days}', '0'::jsonb);
     current_stats := jsonb_set(current_stats, '{max_streak}', '0'::jsonb);
     current_stats := jsonb_set(current_stats, '{genre_counts}', '{}'::jsonb);
     current_stats := jsonb_set(current_stats, '{monthly_watches}', '{}'::jsonb);
     current_stats := jsonb_set(current_stats, '{first_watch_of_year}', 'null'::jsonb);
     current_stats := jsonb_set(current_stats, '{rewatch_count}', '0'::jsonb);
     current_stats := jsonb_set(current_stats, '{binge_days}', '0'::jsonb);
     current_stats := jsonb_set(current_stats, '{daily_watch_count}', '{}'::jsonb);
     current_stats := jsonb_set(current_stats, '{title_rewatch_counts}', '{}'::jsonb);
     current_stats := jsonb_set(current_stats, '{year}', current_year::text::jsonb);
  END IF;

  -- Ensure fields exist (for users running migration mid-year)
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
  IF current_stats->'rewatch_count' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{rewatch_count}', '0'::jsonb);
  END IF;
  IF current_stats->'binge_days' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{binge_days}', '0'::jsonb);
  END IF;
  IF current_stats->'daily_watch_count' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{daily_watch_count}', '{}'::jsonb);
  END IF;
  IF current_stats->'title_rewatch_counts' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{title_rewatch_counts}', '{}'::jsonb);
  END IF;
  IF current_stats->'past_years' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{past_years}', '{}'::jsonb);
  END IF;

  -- Extract metadata
  media_type := p_data->>'type';
  genres := p_data->'genres';
  is_new_item := NOT (current_history ? p_tmdb_id);

  -- ===============================================
  -- REWATCH TRACKING
  -- ===============================================
  IF NOT is_new_item THEN
    current_stats := jsonb_set(
      current_stats,
      '{rewatch_count}',
      (COALESCE((current_stats->>'rewatch_count')::int, 0) + 1)::text::jsonb
    );
    
    title := p_data->>'title';
    IF title IS NOT NULL THEN
      title_rewatch_count := COALESCE((current_stats->'title_rewatch_counts'->>title)::int, 0) + 1;
      current_stats := jsonb_set(
        current_stats,
        array['title_rewatch_counts', title],
        title_rewatch_count::text::jsonb
      );
    END IF;
  END IF;

  -- Update watch history
  current_history := jsonb_set(current_history, array[p_tmdb_id], p_data);

  -- Update counters if new item
  IF is_new_item THEN
    IF media_type = 'movie' THEN
      current_stats := jsonb_set(current_stats, '{total_movies}', 
        ((current_stats->>'total_movies')::int + 1)::text::jsonb);
    ELSIF media_type = 'tv' THEN
      current_stats := jsonb_set(current_stats, '{total_shows}', 
        ((current_stats->>'total_shows')::int + 1)::text::jsonb);
    END IF;

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

  -- Calculate streak
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

  IF current_streak > COALESCE((current_stats->>'max_streak')::int, 0) THEN
    current_stats := jsonb_set(current_stats, '{max_streak}', current_streak::text::jsonb);
  END IF;

  -- Track monthly watches
  current_month := to_char(now(), 'YYYY-MM');
  current_stats := jsonb_set(
    current_stats, 
    array['monthly_watches', current_month], 
    (COALESCE((current_stats->'monthly_watches'->>current_month)::int, 0) + 1)::text::jsonb
  );

  -- ===============================================
  -- BINGE DAY TRACKING
  -- ===============================================
  today := to_char(now(), 'YYYY-MM-DD');
  today_count := COALESCE((current_stats->'daily_watch_count'->>today)::int, 0) + 1;
  
  current_stats := jsonb_set(
    current_stats,
    array['daily_watch_count', today],
    today_count::text::jsonb
  );
  
  IF today_count = 3 THEN
    current_stats := jsonb_set(
      current_stats,
      '{binge_days}',
      (COALESCE((current_stats->>'binge_days')::int, 0) + 1)::text::jsonb
    );
  END IF;
  
  -- Cleanup old daily counts (keep last 30 days)
  current_stats := jsonb_set(
    current_stats,
    '{daily_watch_count}',
    (
      SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb)
      FROM jsonb_each(current_stats->'daily_watch_count')
      WHERE to_date(key, 'YYYY-MM-DD') > CURRENT_DATE - INTERVAL '30 days'
    )
  );

  -- Track first watch of year
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

  -- Save
  UPDATE public.profiles
  SET 
    watch_history = current_history,
    stats = current_stats,
    last_seen_activity = now()
  WHERE id = p_user_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===============================================
-- DONE!
-- ===============================================
-- After running this:
-- 1. Wrapped will auto-unlock Dec 20th - Dec 31st
-- 2. Jan 1st: Data resets, old year saves to past_years
-- 3. Admin toggle works for testing (set wrapped_enabled = 'true')
-- ===============================================
