-- Allow trusted SECURITY DEFINER RPCs to update protected profile fields while
-- still blocking direct client updates to sensitive columns.

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_role text;
  new_profile jsonb := to_jsonb(NEW);
  old_profile jsonb := to_jsonb(OLD);
BEGIN
  IF current_setting('app.trusted_profile_write', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT profiles.role
  INTO requester_role
  FROM public.profiles
  WHERE profiles.id = auth.uid();

  IF requester_role = 'admin' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(new_profile->'role', 'null'::jsonb) IS DISTINCT FROM COALESCE(old_profile->'role', 'null'::jsonb)
     OR COALESCE(new_profile->'can_stream', 'null'::jsonb) IS DISTINCT FROM COALESCE(old_profile->'can_stream', 'null'::jsonb)
     OR COALESCE(new_profile->'watch_history', 'null'::jsonb) IS DISTINCT FROM COALESCE(old_profile->'watch_history', 'null'::jsonb)
     OR COALESCE(new_profile->'stats', 'null'::jsonb) IS DISTINCT FROM COALESCE(old_profile->'stats', 'null'::jsonb)
     OR COALESCE(new_profile->'account_kind', 'null'::jsonb) IS DISTINCT FROM COALESCE(old_profile->'account_kind', 'null'::jsonb)
     OR COALESCE(new_profile->'guest_expires_at', 'null'::jsonb) IS DISTINCT FROM COALESCE(old_profile->'guest_expires_at', 'null'::jsonb)
     OR COALESCE(new_profile->'guest_created_by', 'null'::jsonb) IS DISTINCT FROM COALESCE(old_profile->'guest_created_by', 'null'::jsonb)
     OR COALESCE(new_profile->'guest_secured_at', 'null'::jsonb) IS DISTINCT FROM COALESCE(old_profile->'guest_secured_at', 'null'::jsonb)
     OR COALESCE(new_profile->'guest_link_id', 'null'::jsonb) IS DISTINCT FROM COALESCE(old_profile->'guest_link_id', 'null'::jsonb)
     OR COALESCE(new_profile->'is_guest_hidden', 'null'::jsonb) IS DISTINCT FROM COALESCE(old_profile->'is_guest_hidden', 'null'::jsonb)
  THEN
    RAISE EXCEPTION 'Sensitive profile fields must be updated through trusted RPCs only';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_username text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  username text,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  safe_username text := NULLIF(btrim(COALESCE(p_username, '')), '');
  safe_avatar_url text := NULLIF(btrim(COALESCE(p_avatar_url, '')), '');
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF safe_username IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.profiles
       WHERE username = safe_username
         AND id <> requester_id
     )
  THEN
    RAISE EXCEPTION 'Username already taken';
  END IF;

  PERFORM set_config('app.trusted_profile_write', 'on', true);

  UPDATE public.profiles
  SET
    username = COALESCE(safe_username, username),
    avatar_url = COALESCE(safe_avatar_url, avatar_url)
  WHERE id = requester_id;

  RETURN QUERY
  SELECT profile.id, profile.username, profile.avatar_url
  FROM public.profiles profile
  WHERE profile.id = requester_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_my_recent_searches(
  p_recent_searches jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  normalized_searches jsonb := '[]'::jsonb;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF COALESCE(jsonb_typeof(p_recent_searches), 'null') <> 'array' THEN
    RAISE EXCEPTION 'Recent searches must be a JSON array';
  END IF;

  WITH cleaned AS (
    SELECT btrim(value) AS value, ord
    FROM jsonb_array_elements_text(COALESCE(p_recent_searches, '[]'::jsonb)) WITH ORDINALITY AS entry(value, ord)
    WHERE NULLIF(btrim(value), '') IS NOT NULL
  ),
  deduped AS (
    SELECT DISTINCT ON (lower(value)) value, ord
    FROM cleaned
    ORDER BY lower(value), ord
  ),
  limited AS (
    SELECT value, ord
    FROM deduped
    ORDER BY ord
    LIMIT 3
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(value) ORDER BY ord), '[]'::jsonb)
  INTO normalized_searches
  FROM limited;

  PERFORM set_config('app.trusted_profile_write', 'on', true);

  UPDATE public.profiles
  SET recent_searches = normalized_searches
  WHERE id = requester_id;

  RETURN normalized_searches;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_recent_search(
  p_query text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  safe_query text := NULLIF(btrim(COALESCE(p_query, '')), '');
  current_searches jsonb := '[]'::jsonb;
  next_searches jsonb := '[]'::jsonb;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF safe_query IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(recent_searches, '[]'::jsonb)
  INTO current_searches
  FROM public.profiles
  WHERE id = requester_id
  FOR UPDATE;

  WITH cleaned AS (
    SELECT safe_query AS value, 0::bigint AS ord
    UNION ALL
    SELECT btrim(value) AS value, ord
    FROM jsonb_array_elements_text(current_searches) WITH ORDINALITY AS entry(value, ord)
    WHERE NULLIF(btrim(value), '') IS NOT NULL
      AND lower(btrim(value)) <> lower(safe_query)
  ),
  deduped AS (
    SELECT DISTINCT ON (lower(value)) value, ord
    FROM cleaned
    ORDER BY lower(value), ord
  ),
  limited AS (
    SELECT value, ord
    FROM deduped
    ORDER BY ord
    LIMIT 3
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(value) ORDER BY ord), '[]'::jsonb)
  INTO next_searches
  FROM limited;

  PERFORM set_config('app.trusted_profile_write', 'on', true);

  UPDATE public.profiles
  SET recent_searches = next_searches
  WHERE id = requester_id;

  RETURN next_searches;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_announcements_seen()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  seen_at timestamptz := now();
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  PERFORM set_config('app.trusted_profile_write', 'on', true);

  UPDATE public.profiles
  SET last_seen_announcements = seen_at
  WHERE id = requester_id;

  RETURN seen_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_activity_seen()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  seen_at timestamptz := now();
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  PERFORM set_config('app.trusted_profile_write', 'on', true);

  UPDATE public.profiles
  SET last_seen_activity = seen_at
  WHERE id = requester_id;

  RETURN seen_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_user_role(
  p_user_id uuid,
  p_new_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_role text;
BEGIN
  SELECT profiles.role
  INTO requester_role
  FROM public.profiles
  WHERE profiles.id = auth.uid();

  IF requester_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_new_role NOT IN ('user', 'admin', 'moderator') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  IF p_user_id = auth.uid() AND p_new_role <> 'admin' THEN
    RAISE EXCEPTION 'Cannot change your own admin role';
  END IF;

  PERFORM set_config('app.trusted_profile_write', 'on', true);

  UPDATE public.profiles
  SET role = p_new_role
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_user_streaming_permission(
  p_user_id uuid,
  p_can_stream boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_role text;
BEGIN
  SELECT profiles.role
  INTO requester_role
  FROM public.profiles
  WHERE profiles.id = auth.uid();

  IF requester_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  PERFORM set_config('app.trusted_profile_write', 'on', true);

  UPDATE public.profiles
  SET can_stream = p_can_stream
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_guest_access_link(
  p_token text
)
RETURNS TABLE (
  profile_id uuid,
  username text,
  account_kind text,
  guest_expires_at timestamptz,
  guest_link_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  requester_profile public.profiles%ROWTYPE;
  link_record public.guest_access_links%ROWTYPE;
  guest_username text;
  is_anonymous_session boolean := COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false);
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF trim(COALESCE(p_token, '')) = '' THEN
    RAISE EXCEPTION 'Guest access token is required';
  END IF;

  SELECT *
  INTO link_record
  FROM public.guest_access_links
  WHERE token_hash = md5(trim(p_token))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid guest access link';
  END IF;

  SELECT *
  INTO requester_profile
  FROM public.profiles
  WHERE id = requester_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for current session';
  END IF;

  IF requester_profile.account_kind = 'guest'
     AND requester_profile.guest_link_id = link_record.id THEN
    RETURN QUERY
    SELECT
      requester_profile.id,
      requester_profile.username,
      requester_profile.account_kind,
      requester_profile.guest_expires_at,
      requester_profile.guest_link_id;
    RETURN;
  END IF;

  IF NOT is_anonymous_session THEN
    RAISE EXCEPTION 'Guest links can only be redeemed from a guest session';
  END IF;

  IF link_record.status = 'disabled' THEN
    RAISE EXCEPTION 'This guest access link has been disabled';
  END IF;

  IF link_record.expires_at <= now() THEN
    UPDATE public.guest_access_links
    SET status = 'expired'
    WHERE id = link_record.id
      AND status <> 'expired';

    RAISE EXCEPTION 'This guest access link has expired';
  END IF;

  IF link_record.used_count >= link_record.max_uses THEN
    UPDATE public.guest_access_links
    SET status = 'exhausted'
    WHERE id = link_record.id
      AND status <> 'exhausted';

    RAISE EXCEPTION 'This guest access link has already been used';
  END IF;

  IF requester_profile.guest_secured_at IS NOT NULL THEN
    RAISE EXCEPTION 'This session is already attached to a secured account';
  END IF;

  IF COALESCE(NULLIF(trim(requester_profile.username), ''), '') = '' THEN
    guest_username := public.build_unique_username(
      'guest_' || right(replace(requester_id::text, '-', ''), 8)
    );
  ELSE
    guest_username := requester_profile.username;
  END IF;

  PERFORM set_config('app.trusted_profile_write', 'on', true);

  UPDATE public.profiles
  SET
    username = guest_username,
    avatar_url = COALESCE(NULLIF(avatar_url, ''), 'https://ui-avatars.com/api/?name=Guest&background=27272a&color=ffffff&bold=true'),
    can_stream = true,
    account_kind = 'guest',
    guest_expires_at = link_record.expires_at,
    guest_created_by = link_record.created_by,
    guest_link_id = link_record.id,
    is_guest_hidden = true
  WHERE id = requester_id;

  UPDATE public.guest_access_links
  SET
    used_count = used_count + 1,
    status = CASE
      WHEN used_count + 1 >= max_uses THEN 'exhausted'
      ELSE status
    END
  WHERE id = link_record.id;

  RETURN QUERY
  SELECT
    profile.id,
    profile.username,
    profile.account_kind,
    profile.guest_expires_at,
    profile.guest_link_id
  FROM public.profiles profile
  WHERE profile.id = requester_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.secure_guest_account()
RETURNS TABLE (
  profile_id uuid,
  username text,
  account_kind text,
  guest_secured_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  requester_profile public.profiles%ROWTYPE;
  current_email text;
  current_email_confirmed_at timestamptz;
  next_username text;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO requester_profile
  FROM public.profiles
  WHERE id = requester_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF requester_profile.account_kind IS DISTINCT FROM 'guest' THEN
    RAISE EXCEPTION 'Only guest accounts can be secured';
  END IF;

  IF requester_profile.guest_expires_at IS NULL OR requester_profile.guest_expires_at <= now() THEN
    RAISE EXCEPTION 'Guest access has expired';
  END IF;

  SELECT email, email_confirmed_at
  INTO current_email, current_email_confirmed_at
  FROM auth.users
  WHERE id = requester_id;

  IF current_email IS NULL OR trim(current_email) = '' THEN
    RAISE EXCEPTION 'Add an email address before securing this account';
  END IF;

  IF current_email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Verify your email before securing this account';
  END IF;

  IF COALESCE(requester_profile.username, '') = ''
     OR requester_profile.username ~ '^guest[_-]'
  THEN
    next_username := public.build_unique_username(split_part(current_email, '@', 1));
  ELSE
    next_username := requester_profile.username;
  END IF;

  PERFORM set_config('app.trusted_profile_write', 'on', true);

  UPDATE public.profiles
  SET
    username = next_username,
    account_kind = 'standard',
    guest_secured_at = now(),
    guest_expires_at = NULL,
    is_guest_hidden = false
  WHERE id = requester_id;

  RETURN QUERY
  SELECT
    profile.id,
    profile.username,
    profile.account_kind,
    profile.guest_secured_at
  FROM public.profiles profile
  WHERE profile.id = requester_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_watch_history_v2(
  p_user_id uuid,
  p_tmdb_id text,
  p_data jsonb,
  p_idempotency_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_history jsonb;
  current_entry jsonb;
  existing_key text;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized to update watch history for this user.';
  END IF;

  SELECT watch_history
  INTO current_history
  FROM public.profiles
  WHERE id = p_user_id;

  IF current_history IS NULL THEN
    current_history := '{}'::jsonb;
  END IF;

  current_entry := COALESCE(current_history->p_tmdb_id, '{}'::jsonb);

  IF p_idempotency_key IS NOT NULL THEN
    existing_key := current_entry->>'idempotencyKey';
    IF existing_key = p_idempotency_key THEN
      RETURN;
    END IF;

    p_data := p_data || jsonb_build_object('idempotencyKey', p_idempotency_key);
  END IF;

  current_history := jsonb_set(current_history, array[p_tmdb_id], p_data, true);

  PERFORM set_config('app.trusted_profile_write', 'on', true);

  UPDATE public.profiles
  SET
    watch_history = current_history,
    last_seen_activity = now()
  WHERE id = p_user_id;
END;
$$;

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
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    user_id, session_id, tmdb_id, media_type, season, episode, provider_id, title, genres,
    active_seconds, session_date, started_at, last_heartbeat_at, updated_at
  )
  VALUES (
    current_user_id, p_session_id, p_tmdb_id, p_media_type, p_season, p_episode,
    p_provider_id, p_title, COALESCE(to_jsonb(p_genres), '[]'::jsonb),
    heartbeat_seconds, current_date, now(), now(), now()
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

    PERFORM set_config('app.trusted_profile_write', 'on', true);

    UPDATE public.profiles
    SET
      stats = current_stats,
      last_seen_activity = now()
    WHERE id = current_user_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_my_watch_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  PERFORM set_config('app.trusted_profile_write', 'on', true);

  UPDATE public.profiles
  SET
    watch_history = '{}'::jsonb,
    stats = public.reset_viewing_stats(stats, true),
    last_seen_activity = now()
  WHERE id = auth.uid();
END;
$$;
