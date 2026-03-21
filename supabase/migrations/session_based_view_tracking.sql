-- SESSION-BASED VIEW TRACKING
-- Wrapped/stat tracking for embedded players should be based on session heartbeats,
-- not iframe playback position, because playback telemetry is unreliable.

CREATE TABLE IF NOT EXISTS public.view_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  tmdb_id text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('movie', 'tv')),
  season integer,
  episode integer,
  provider_id text,
  title text,
  genres jsonb NOT NULL DEFAULT '[]'::jsonb,
  active_seconds integer NOT NULL DEFAULT 0,
  is_qualified boolean NOT NULL DEFAULT false,
  qualified_at timestamptz,
  session_date date NOT NULL DEFAULT current_date,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_view_sessions_user_date
ON public.view_sessions(user_id, session_date DESC);

CREATE INDEX IF NOT EXISTS idx_view_sessions_user_content
ON public.view_sessions(user_id, media_type, tmdb_id, season, episode);

ALTER TABLE public.view_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own sessions" ON public.view_sessions;
CREATE POLICY "Users can view their own sessions"
  ON public.view_sessions FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.reset_viewing_stats(
  p_existing_stats jsonb DEFAULT NULL,
  p_reset_past_years boolean DEFAULT true
)
RETURNS jsonb AS $$
DECLARE
  new_stats jsonb;
BEGIN
  new_stats := COALESCE(p_existing_stats, '{}'::jsonb);
  new_stats := new_stats - ARRAY[
    'total_movies',
    'total_shows',
    'streak_days',
    'max_streak',
    'last_watched',
    'genre_counts',
    'monthly_watches',
    'first_watch_of_year',
    'year',
    'rewatch_count',
    'binge_days',
    'daily_watch_count',
    'title_rewatch_counts',
    'wrapped_counted_titles',
    'wrapped_completed_units'
  ];

  IF p_reset_past_years THEN
    new_stats := new_stats - 'past_years';
  END IF;

  new_stats := new_stats || jsonb_build_object(
    'total_movies', 0,
    'total_shows', 0,
    'streak_days', 0,
    'max_streak', 0,
    'last_watched', null,
    'genre_counts', '{}'::jsonb,
    'monthly_watches', '{}'::jsonb,
    'first_watch_of_year', null,
    'year', extract(year from now())::int,
    'rewatch_count', 0,
    'binge_days', 0,
    'daily_watch_count', '{}'::jsonb,
    'title_rewatch_counts', '{}'::jsonb,
    'wrapped_counted_titles', '{}'::jsonb,
    'wrapped_completed_units', '{}'::jsonb
  );

  IF p_reset_past_years THEN
    new_stats := new_stats || jsonb_build_object('past_years', '{}'::jsonb);
  ELSE
    new_stats := new_stats || jsonb_build_object(
      'past_years',
      COALESCE(p_existing_stats->'past_years', '{}'::jsonb)
    );
  END IF;

  RETURN new_stats;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.heartbeat_view_session(
  p_session_id text,
  p_tmdb_id text,
  p_media_type text,
  p_season integer DEFAULT NULL,
  p_episode integer DEFAULT NULL,
  p_provider_id text DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_genres text[] DEFAULT NULL,
  p_heartbeat_seconds integer DEFAULT 30
)
RETURNS void AS $$
DECLARE
  current_user_id uuid;
  current_stats jsonb;
  session_record public.view_sessions%ROWTYPE;
  qualified_threshold integer;
  heartbeat_seconds integer;
  counted_key text;
  completion_count integer;
  genre_name text;
  previous_last_watched timestamptz;
  current_streak integer;
  days_since_last_watch integer;
  current_month text;
  today text;
  today_count integer;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_media_type NOT IN ('movie', 'tv') THEN
    RAISE EXCEPTION 'Invalid media type: %', p_media_type;
  END IF;

  heartbeat_seconds := GREATEST(15, LEAST(COALESCE(p_heartbeat_seconds, 30), 60));
  qualified_threshold := CASE
    WHEN p_media_type = 'movie' THEN 20 * 60
    ELSE 10 * 60
  END;

  SELECT stats
  INTO current_stats
  FROM public.profiles
  WHERE id = current_user_id
  FOR UPDATE;

  IF current_stats IS NULL THEN
    current_stats := '{}'::jsonb;
  END IF;

  IF current_stats->'genre_counts' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{genre_counts}', '{}'::jsonb, true);
  END IF;
  IF current_stats->'streak_days' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{streak_days}', '0'::jsonb, true);
  END IF;
  IF current_stats->'max_streak' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{max_streak}', '0'::jsonb, true);
  END IF;
  IF current_stats->'total_movies' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{total_movies}', '0'::jsonb, true);
  END IF;
  IF current_stats->'total_shows' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{total_shows}', '0'::jsonb, true);
  END IF;
  IF current_stats->'monthly_watches' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{monthly_watches}', '{}'::jsonb, true);
  END IF;
  IF current_stats->'rewatch_count' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{rewatch_count}', '0'::jsonb, true);
  END IF;
  IF current_stats->'binge_days' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{binge_days}', '0'::jsonb, true);
  END IF;
  IF current_stats->'daily_watch_count' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{daily_watch_count}', '{}'::jsonb, true);
  END IF;
  IF current_stats->'title_rewatch_counts' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{title_rewatch_counts}', '{}'::jsonb, true);
  END IF;
  IF current_stats->'wrapped_counted_titles' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{wrapped_counted_titles}', '{}'::jsonb, true);
  END IF;
  IF current_stats->'wrapped_completed_units' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{wrapped_completed_units}', '{}'::jsonb, true);
  END IF;
  IF current_stats->'past_years' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{past_years}', '{}'::jsonb, true);
  END IF;
  IF current_stats->'year' IS NULL THEN
    current_stats := jsonb_set(current_stats, '{year}', to_jsonb(extract(year from now())::int), true);
  END IF;

  IF COALESCE((current_stats->>'year')::int, extract(year from now())::int) < extract(year from now())::int THEN
    current_stats := jsonb_set(
      current_stats,
      array['past_years', (current_stats->>'year')],
      current_stats - 'past_years' - 'wrapped_counted_titles' - 'wrapped_completed_units',
      true
    );
    current_stats := jsonb_set(current_stats, '{total_movies}', '0'::jsonb, true);
    current_stats := jsonb_set(current_stats, '{total_shows}', '0'::jsonb, true);
    current_stats := jsonb_set(current_stats, '{streak_days}', '0'::jsonb, true);
    current_stats := jsonb_set(current_stats, '{max_streak}', '0'::jsonb, true);
    current_stats := jsonb_set(current_stats, '{genre_counts}', '{}'::jsonb, true);
    current_stats := jsonb_set(current_stats, '{monthly_watches}', '{}'::jsonb, true);
    current_stats := jsonb_set(current_stats, '{first_watch_of_year}', 'null'::jsonb, true);
    current_stats := jsonb_set(current_stats, '{rewatch_count}', '0'::jsonb, true);
    current_stats := jsonb_set(current_stats, '{binge_days}', '0'::jsonb, true);
    current_stats := jsonb_set(current_stats, '{daily_watch_count}', '{}'::jsonb, true);
    current_stats := jsonb_set(current_stats, '{title_rewatch_counts}', '{}'::jsonb, true);
    current_stats := jsonb_set(current_stats, '{wrapped_counted_titles}', '{}'::jsonb, true);
    current_stats := jsonb_set(current_stats, '{wrapped_completed_units}', '{}'::jsonb, true);
    current_stats := jsonb_set(current_stats, '{year}', to_jsonb(extract(year from now())::int), true);
  END IF;

  INSERT INTO public.view_sessions (
    user_id,
    session_id,
    tmdb_id,
    media_type,
    season,
    episode,
    provider_id,
    title,
    genres,
    active_seconds,
    session_date,
    started_at,
    last_heartbeat_at,
    updated_at
  )
  VALUES (
    current_user_id,
    p_session_id,
    p_tmdb_id,
    p_media_type,
    p_season,
    p_episode,
    p_provider_id,
    p_title,
    COALESCE(to_jsonb(p_genres), '[]'::jsonb),
    heartbeat_seconds,
    current_date,
    now(),
    now(),
    now()
  )
  ON CONFLICT (user_id, session_id)
  DO UPDATE SET
    last_heartbeat_at = now(),
    updated_at = now(),
    provider_id = COALESCE(EXCLUDED.provider_id, public.view_sessions.provider_id),
    title = COALESCE(EXCLUDED.title, public.view_sessions.title),
    genres = CASE
      WHEN EXCLUDED.genres IS NULL OR EXCLUDED.genres = 'null'::jsonb OR EXCLUDED.genres = '[]'::jsonb
        THEN public.view_sessions.genres
      ELSE EXCLUDED.genres
    END,
    active_seconds = public.view_sessions.active_seconds + heartbeat_seconds;

  SELECT *
  INTO session_record
  FROM public.view_sessions
  WHERE user_id = current_user_id
    AND session_id = p_session_id
  FOR UPDATE;

  IF NOT session_record.is_qualified AND session_record.active_seconds >= qualified_threshold THEN
    UPDATE public.view_sessions
    SET
      is_qualified = true,
      qualified_at = now(),
      updated_at = now()
    WHERE id = session_record.id;

    counted_key := CASE
      WHEN p_media_type = 'movie' THEN format('movie:%s', p_tmdb_id)
      ELSE format('tv:%s:s%s:e%s', p_tmdb_id, COALESCE(p_season, 1), COALESCE(p_episode, 1))
    END;

    IF NOT (current_stats->'wrapped_counted_titles' ? counted_key) THEN
      IF p_media_type = 'movie' THEN
        current_stats := jsonb_set(current_stats, '{total_movies}', ((current_stats->>'total_movies')::int + 1)::text::jsonb, true);
      ELSE
        current_stats := jsonb_set(current_stats, '{total_shows}', ((current_stats->>'total_shows')::int + 1)::text::jsonb, true);
      END IF;

      IF jsonb_typeof(session_record.genres) = 'array' THEN
        FOR genre_name IN SELECT jsonb_array_elements_text(session_record.genres)
        LOOP
          current_stats := jsonb_set(
            current_stats,
            array['genre_counts', genre_name],
            (COALESCE((current_stats->'genre_counts'->>genre_name)::int, 0) + 1)::text::jsonb,
            true
          );
        END LOOP;
      END IF;

      current_stats := jsonb_set(current_stats, array['wrapped_counted_titles', counted_key], 'true'::jsonb, true);
    END IF;

    completion_count := COALESCE((current_stats->'wrapped_completed_units'->>counted_key)::int, 0);
    IF completion_count >= 1 THEN
      current_stats := jsonb_set(current_stats, '{rewatch_count}', ((current_stats->>'rewatch_count')::int + 1)::text::jsonb, true);
      current_stats := jsonb_set(
        current_stats,
        array['title_rewatch_counts', COALESCE(session_record.title, p_tmdb_id)],
        (COALESCE((current_stats->'title_rewatch_counts'->>COALESCE(session_record.title, p_tmdb_id))::int, 0) + 1)::text::jsonb,
        true
      );
    END IF;

    current_stats := jsonb_set(
      current_stats,
      array['wrapped_completed_units', counted_key],
      (completion_count + 1)::text::jsonb,
      true
    );

    current_month := to_char(now(), 'YYYY-MM');
    current_stats := jsonb_set(
      current_stats,
      array['monthly_watches', current_month],
      (COALESCE((current_stats->'monthly_watches'->>current_month)::int, 0) + 1)::text::jsonb,
      true
    );

    today := to_char(now(), 'YYYY-MM-DD');
    today_count := COALESCE((current_stats->'daily_watch_count'->>today)::int, 0) + 1;
    current_stats := jsonb_set(current_stats, array['daily_watch_count', today], today_count::text::jsonb, true);
    IF today_count = 3 THEN
      current_stats := jsonb_set(current_stats, '{binge_days}', ((current_stats->>'binge_days')::int + 1)::text::jsonb, true);
    END IF;

    previous_last_watched := (current_stats->>'last_watched')::timestamptz;
    current_streak := COALESCE((current_stats->>'streak_days')::int, 0);
    IF previous_last_watched IS NULL THEN
      current_streak := 1;
    ELSE
      days_since_last_watch := current_date - date(previous_last_watched);
      IF days_since_last_watch = 1 THEN
        current_streak := current_streak + 1;
      ELSIF days_since_last_watch > 1 THEN
        current_streak := 1;
      END IF;
    END IF;

    current_stats := jsonb_set(current_stats, '{streak_days}', current_streak::text::jsonb, true);
    current_stats := jsonb_set(current_stats, '{last_watched}', to_jsonb(now()), true);

    IF current_streak > COALESCE((current_stats->>'max_streak')::int, 0) THEN
      current_stats := jsonb_set(current_stats, '{max_streak}', current_streak::text::jsonb, true);
    END IF;

    IF current_stats->'first_watch_of_year' IS NULL
      OR COALESCE((current_stats->'first_watch_of_year'->>'year')::int, 0) < extract(year from now())::int THEN
      current_stats := jsonb_set(current_stats, '{first_watch_of_year}', jsonb_build_object(
        'tmdb_id', p_tmdb_id,
        'title', COALESCE(session_record.title, p_tmdb_id),
        'date', current_date::text,
        'type', p_media_type,
        'year', extract(year from now())::int
      ), true);
    END IF;

    UPDATE public.profiles
    SET
      stats = current_stats,
      last_seen_activity = now()
    WHERE id = current_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION public.heartbeat_view_session(text, text, text, integer, integer, text, text, text[], integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.clear_my_watch_history()
RETURNS void AS $$
DECLARE
  is_enabled text;
BEGIN
  SELECT value
  INTO is_enabled
  FROM public.app_settings
  WHERE key = 'clear_history_enabled';

  IF is_enabled != 'true' THEN
    RAISE EXCEPTION 'This feature is currently disabled by the administrator.';
  END IF;

  DELETE FROM public.view_sessions
  WHERE user_id = auth.uid();

  UPDATE public.profiles
  SET
    watch_history = '{}'::jsonb,
    stats = public.reset_viewing_stats(stats, true),
    last_seen_activity = now()
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
