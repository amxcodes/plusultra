-- VERSION 2: update_watch_history_v2
-- Wrapped stats must be computed here so progress syncs do not inflate counts.
-- This is the active watch-history write path used by the frontend.

CREATE OR REPLACE FUNCTION update_watch_history_v2(
  p_user_id uuid,
  p_tmdb_id text,
  p_data jsonb,
  p_idempotency_key text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  current_stats JSONB;
  current_history JSONB;
  current_entry JSONB;
  media_type TEXT;
  title TEXT;
  genres JSONB;
  genre_name TEXT;
  previous_last_watched TIMESTAMPTZ;
  days_since_last_watch INT;
  current_streak INT;
  existing_key TEXT;
  current_year INT;
  stored_year INT;
  current_month TEXT;
  today TEXT;
  today_count INT;
  title_key TEXT;
  unit_key TEXT;
  previous_unit_key TEXT;
  current_qualifies BOOLEAN;
  previous_qualifies BOOLEAN;
  is_completion_event BOOLEAN;
BEGIN
  SELECT watch_history, stats INTO current_history, current_stats
  FROM public.profiles
  WHERE id = p_user_id;

  IF current_history IS NULL THEN
    current_history := '{}'::jsonb;
  END IF;

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
      'wrapped_counted_titles', '{}'::jsonb,
      'wrapped_completed_units', '{}'::jsonb
    );
  END IF;

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
  IF current_stats->'wrapped_counted_titles' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{wrapped_counted_titles}', '{}'::jsonb);
  END IF;
  IF current_stats->'wrapped_completed_units' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{wrapped_completed_units}', '{}'::jsonb);
  END IF;
  IF current_stats->'past_years' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{past_years}', '{}'::jsonb);
  END IF;

  current_year := extract(year from now());
  stored_year := COALESCE((current_stats->>'year')::int, current_year);

  IF stored_year < current_year THEN
    current_stats := jsonb_set(
      current_stats,
      array['past_years', stored_year::text],
      current_stats - 'past_years' - 'wrapped_counted_titles' - 'wrapped_completed_units'
    );

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
    current_stats := jsonb_set(current_stats, '{wrapped_counted_titles}', '{}'::jsonb);
    current_stats := jsonb_set(current_stats, '{wrapped_completed_units}', '{}'::jsonb);
    current_stats := jsonb_set(current_stats, '{year}', current_year::text::jsonb);
  END IF;

  current_entry := COALESCE(current_history->p_tmdb_id, '{}'::jsonb);

  IF p_idempotency_key IS NOT NULL THEN
    existing_key := current_entry->>'idempotencyKey';
    IF existing_key = p_idempotency_key THEN
      RETURN;
    END IF;

    p_data := p_data || jsonb_build_object('idempotencyKey', p_idempotency_key);
  END IF;

  media_type := COALESCE(p_data->>'type', current_entry->>'type', 'movie');
  title := COALESCE(NULLIF(p_data->>'title', ''), current_entry->>'title', p_tmdb_id);
  genres := COALESCE(p_data->'genres', current_entry->'genres', '[]'::jsonb);
  title_key := COALESCE(p_data->>'wrappedTitleKey', format('%s:%s', media_type, p_tmdb_id));
  unit_key := COALESCE(
    p_data->>'wrappedUnitKey',
    CASE
      WHEN media_type = 'tv' AND p_data->>'season' IS NOT NULL AND p_data->>'episode' IS NOT NULL
        THEN format('%s:%s:s%s:e%s', media_type, p_tmdb_id, p_data->>'season', p_data->>'episode')
      ELSE title_key
    END
  );
  previous_unit_key := COALESCE(current_entry->>'wrappedUnitKey', current_entry->>'wrappedTitleKey');
  current_qualifies := COALESCE((p_data->>'wrappedQualified')::boolean, false);
  previous_qualifies := COALESCE((current_entry->>'wrappedQualified')::boolean, false);
  is_completion_event := current_qualifies AND (
    previous_unit_key IS DISTINCT FROM unit_key OR NOT previous_qualifies
  );

  current_history := jsonb_set(current_history, array[p_tmdb_id], p_data, true);

  IF is_completion_event THEN
    IF NOT (current_stats->'wrapped_counted_titles' ? title_key) THEN
      IF media_type = 'movie' THEN
        current_stats := jsonb_set(
          current_stats,
          '{total_movies}',
          (COALESCE((current_stats->>'total_movies')::int, 0) + 1)::text::jsonb
        );
      ELSIF media_type = 'tv' THEN
        current_stats := jsonb_set(
          current_stats,
          '{total_shows}',
          (COALESCE((current_stats->>'total_shows')::int, 0) + 1)::text::jsonb
        );
      END IF;

      IF genres IS NOT NULL AND jsonb_typeof(genres) = 'array' THEN
        FOR genre_name IN SELECT jsonb_array_elements_text(genres)
        LOOP
          current_stats := jsonb_set(
            current_stats,
            array['genre_counts', genre_name],
            (COALESCE((current_stats->'genre_counts'->>genre_name)::int, 0) + 1)::text::jsonb,
            true
          );
        END LOOP;
      END IF;

      current_stats := jsonb_set(
        current_stats,
        array['wrapped_counted_titles', title_key],
        'true'::jsonb,
        true
      );
    END IF;

    IF current_stats->'wrapped_completed_units' ? unit_key THEN
      current_stats := jsonb_set(
        current_stats,
        '{rewatch_count}',
        (COALESCE((current_stats->>'rewatch_count')::int, 0) + 1)::text::jsonb
      );
      current_stats := jsonb_set(
        current_stats,
        array['title_rewatch_counts', title],
        (COALESCE((current_stats->'title_rewatch_counts'->>title)::int, 0) + 1)::text::jsonb,
        true
      );
    ELSE
      current_stats := jsonb_set(
        current_stats,
        array['wrapped_completed_units', unit_key],
        'true'::jsonb,
        true
      );
    END IF;

    current_month := to_char(now(), 'YYYY-MM');
    current_stats := jsonb_set(
      current_stats,
      array['monthly_watches', current_month],
      (COALESCE((current_stats->'monthly_watches'->>current_month)::int, 0) + 1)::text::jsonb,
      true
    );

    today := to_char(now(), 'YYYY-MM-DD');
    today_count := COALESCE((current_stats->'daily_watch_count'->>today)::int, 0) + 1;
    current_stats := jsonb_set(
      current_stats,
      array['daily_watch_count', today],
      today_count::text::jsonb,
      true
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

    IF current_stats->'first_watch_of_year' IS NULL OR
       COALESCE((current_stats->'first_watch_of_year'->>'year')::int, 0) < current_year THEN
      current_stats := jsonb_set(current_stats, '{first_watch_of_year}', jsonb_build_object(
        'tmdb_id', p_tmdb_id,
        'title', title,
        'date', current_date::text,
        'type', media_type,
        'year', current_year
      ));
    END IF;
  END IF;

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
  END IF;

  current_stats := jsonb_set(current_stats, '{streak_days}', current_streak::text::jsonb);
  current_stats := jsonb_set(current_stats, '{last_watched}', to_jsonb(now()));

  IF current_streak > COALESCE((current_stats->>'max_streak')::int, 0) THEN
    current_stats := jsonb_set(current_stats, '{max_streak}', current_streak::text::jsonb);
  END IF;

  UPDATE public.profiles
  SET
    watch_history = current_history,
    stats = current_stats,
    last_seen_activity = now()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_watch_history_v2(uuid, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_watch_history_v2(uuid, text, jsonb, text) TO service_role;
