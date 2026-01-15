-- ===============================================
-- WRAPPED YEAR RESET LOGIC
-- ===============================================
-- Updates update_watch_history to:
-- 1. Detect New Year (e.g., 2026 -> 2027)
-- 2. SNAPSHOT old stats to 'past_years.2026'
-- 3. RESET active counters for 2027
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
  stored_year INT;
  title TEXT;
  title_rewatch_count INT;
  today TEXT;
  today_count INT;
BEGIN
  SELECT watch_history, stats INTO current_history, current_stats 
  FROM public.profiles WHERE id = p_user_id;

  -- 1. Initialize if null
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

  -- 2. Year Transition Logic (RESET & SNAPSHOT)
  current_year := extract(year from now());
  stored_year := COALESCE((current_stats->>'year')::int, current_year);

  IF stored_year < current_year THEN
     -- Snapshot current stats to past_years keys
     IF current_stats->'past_years' IS NULL THEN
        current_stats := jsonb_set(current_stats, '{past_years}', '{}'::jsonb);
     END IF;
     
     -- Save 2026 stats into 'past_years'->'2026'
     -- We copy the whole object, then remove 'past_years' from the copy to avoid recursion
     current_stats := jsonb_set(
        current_stats,
        array['past_years', stored_year::text],
        current_stats - 'past_years'
     );

     -- Reset Counters for New Year
     current_stats := jsonb_set(current_stats, '{total_movies}', '0'::jsonb);
     current_stats := jsonb_set(current_stats, '{total_shows}', '0'::jsonb);
     current_stats := jsonb_set(current_stats, '{streak_days}', '0'::jsonb);
     current_stats := jsonb_set(current_stats, '{max_streak}', '0'::jsonb); -- Reset max streak for new year? Usually yes for Wrapped.
     current_stats := jsonb_set(current_stats, '{genre_counts}', '{}'::jsonb);
     current_stats := jsonb_set(current_stats, '{monthly_watches}', '{}'::jsonb);
     current_stats := jsonb_set(current_stats, '{first_watch_of_year}', 'null'::jsonb);
     current_stats := jsonb_set(current_stats, '{rewatch_count}', '0'::jsonb);
     current_stats := jsonb_set(current_stats, '{binge_days}', '0'::jsonb);
     current_stats := jsonb_set(current_stats, '{daily_watch_count}', '{}'::jsonb);
     current_stats := jsonb_set(current_stats, '{title_rewatch_counts}', '{}'::jsonb);
     
     -- Update Year
     current_stats := jsonb_set(current_stats, '{year}', current_year::text::jsonb);
  END IF;

  -- Ensure fields exist (for existing users running migration mid-year)
  IF current_stats->'genre_counts' IS NULL THEN current_stats := jsonb_set(current_stats, '{genre_counts}', '{}'::jsonb); END IF;
  IF current_stats->'daily_watch_count' IS NULL THEN current_stats := jsonb_set(current_stats, '{daily_watch_count}', '{}'::jsonb); END IF;
  IF current_stats->'title_rewatch_counts' IS NULL THEN current_stats := jsonb_set(current_stats, '{title_rewatch_counts}', '{}'::jsonb); END IF;

  -- 3. Extract Metadata
  media_type := p_data->>'type';
  genres := p_data->'genres';
  is_new_item := NOT (current_history ? p_tmdb_id);

  -- 4. Track Rewatches
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

  -- 5. Update History
  current_history := jsonb_set(current_history, array[p_tmdb_id], p_data);

  -- 6. Update Counters (New Items)
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

  -- 7. Streaks
  previous_last_watched := (current_stats->>'last_watched')::timestamptz;
  current_streak := COALESCE((current_stats->>'streak_days')::int, 0);
  
  IF previous_last_watched IS NULL THEN
    current_streak := 1;
  ELSE
    days_since_last_watch := CURRENT_DATE - DATE(previous_last_watched);
    IF days_since_last_watch = 1 THEN
      current_streak := current_streak + 1;
    ELSIF days_since_last_watch > 1 THEN
      current_streak := 1;
    END IF;
    -- If 0 (same day), keep streak same
  END IF;
  
  current_stats := jsonb_set(current_stats, '{streak_days}', current_streak::text::jsonb);
  current_stats := jsonb_set(current_stats, '{last_watched}', to_jsonb(now()));

  IF current_streak > COALESCE((current_stats->>'max_streak')::int, 0) THEN
    current_stats := jsonb_set(current_stats, '{max_streak}', current_streak::text::jsonb);
  END IF;

  -- 8. Monthly Stats
  current_month := to_char(now(), 'YYYY-MM');
  current_stats := jsonb_set(
    current_stats, 
    array['monthly_watches', current_month], 
    (COALESCE((current_stats->'monthly_watches'->>current_month)::int, 0) + 1)::text::jsonb
  );

  -- 9. Binge Logic
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
  
  current_stats := jsonb_set(
    current_stats,
    '{daily_watch_count}',
    (
      SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb)
      FROM jsonb_each(current_stats->'daily_watch_count')
      WHERE to_date(key, 'YYYY-MM-DD') > CURRENT_DATE - INTERVAL '30 days'
    )
  );

  -- 10. First Watch
  current_year := extract(year from now());
  IF current_stats->'first_watch_of_year' IS NULL OR 
     current_stats->'first_watch_of_year'->>'year' IS NULL OR
     (current_stats->'first_watch_of_year'->>'year')::int < current_year 
  THEN
    current_stats := jsonb_set(current_stats, '{first_watch_of_year}', jsonb_build_object(
      'tmdb_id', p_tmdb_id,
      'title', p_data->>'title',
      'date', current_date::text,
      'type', media_type,
      'year', current_year
    ));
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
