-- ===============================================
-- WRAPPED STATS UPDATE - MINIMAL VERSION
-- ===============================================
-- Run this in Supabase SQL Editor
-- Adds: rewatch tracking, binge detection, per-title counts
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
  title TEXT;
  title_rewatch_count INT;
  today TEXT;
  today_count INT;
BEGIN
  SELECT watch_history, stats INTO current_history, current_stats 
  FROM public.profiles WHERE id = p_user_id;

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
      'title_rewatch_counts', '{}'::jsonb
    );
  END IF;
  
  IF current_history IS NULL THEN 
    current_history := '{}'::jsonb; 
  END IF;

  -- Ensure all fields exist
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

  media_type := p_data->>'type';
  genres := p_data->'genres';
  is_new_item := NOT (current_history ? p_tmdb_id);

  -- Track rewatches
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

  current_history := jsonb_set(current_history, array[p_tmdb_id], p_data);

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

  current_month := to_char(now(), 'YYYY-MM');
  current_stats := jsonb_set(
    current_stats, 
    array['monthly_watches', current_month], 
    (COALESCE((current_stats->'monthly_watches'->>current_month)::int, 0) + 1)::text::jsonb
  );

  -- Track binge days
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
  
  -- Cleanup old daily counts
  current_stats := jsonb_set(
    current_stats,
    '{daily_watch_count}',
    (
      SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb)
      FROM jsonb_each(current_stats->'daily_watch_count')
      WHERE to_date(key, 'YYYY-MM-DD') > CURRENT_DATE - INTERVAL '30 days'
    )
  );

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

  IF COALESCE((current_stats->>'year')::int, 0) < current_year THEN
    current_stats := jsonb_set(current_stats, '{year}', current_year::text::jsonb);
  END IF;

  UPDATE public.profiles
  SET 
    watch_history = current_history,
    stats = current_stats,
    last_seen_activity = now()
  WHERE id = p_user_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===============================================
-- DONE! Function updated with Wrapped stats
-- ===============================================
