-- ENHANCED SESSION + PRESENCE TRACKING
-- Adds richer context-aware heartbeat tracking without pretending to own iframe playback.
-- We track raw time, credited time, confidence, interaction state, and activity mode.

ALTER TABLE public.view_sessions
  ADD COLUMN IF NOT EXISTS raw_active_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visible_heartbeats integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS focused_heartbeats integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interaction_heartbeats integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_switch_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confidence_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_activity_mode text DEFAULT 'watch',
  ADD COLUMN IF NOT EXISTS last_interaction_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_resume_source text;

ALTER TABLE public.app_presence_sessions
  ADD COLUMN IF NOT EXISTS raw_active_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visible_heartbeats integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS focused_heartbeats integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interaction_heartbeats integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active_mode text DEFAULT 'browse',
  ADD COLUMN IF NOT EXISTS last_interaction_at timestamptz;

UPDATE public.view_sessions
SET raw_active_seconds = GREATEST(raw_active_seconds, active_seconds),
    visible_heartbeats = GREATEST(visible_heartbeats, CASE WHEN active_seconds > 0 THEN CEIL(active_seconds::numeric / 30.0)::integer ELSE 0 END),
    focused_heartbeats = GREATEST(focused_heartbeats, CASE WHEN active_seconds > 0 THEN CEIL(active_seconds::numeric / 30.0)::integer ELSE 0 END),
    interaction_heartbeats = GREATEST(interaction_heartbeats, CASE WHEN active_seconds > 0 THEN CEIL(active_seconds::numeric / 30.0)::integer ELSE 0 END),
    confidence_score = GREATEST(confidence_score, CASE WHEN active_seconds > 0 THEN LEAST(100, CEIL(active_seconds::numeric / 12.0)::integer) ELSE 0 END)
WHERE raw_active_seconds = 0 OR confidence_score = 0;

UPDATE public.app_presence_sessions
SET raw_active_seconds = GREATEST(raw_active_seconds, active_seconds),
    visible_heartbeats = GREATEST(visible_heartbeats, CASE WHEN active_seconds > 0 THEN CEIL(active_seconds::numeric / 60.0)::integer ELSE 0 END),
    focused_heartbeats = GREATEST(focused_heartbeats, CASE WHEN active_seconds > 0 THEN CEIL(active_seconds::numeric / 60.0)::integer ELSE 0 END),
    interaction_heartbeats = GREATEST(interaction_heartbeats, CASE WHEN active_seconds > 0 THEN CEIL(active_seconds::numeric / 60.0)::integer ELSE 0 END)
WHERE raw_active_seconds = 0;

CREATE INDEX IF NOT EXISTS idx_view_sessions_confidence_recent
  ON public.view_sessions(user_id, confidence_score DESC, last_heartbeat_at DESC);

CREATE INDEX IF NOT EXISTS idx_presence_mode_recent
  ON public.app_presence_sessions(user_id, active_mode, last_heartbeat_at DESC);

CREATE OR REPLACE FUNCTION public.heartbeat_app_presence_v2(
  p_session_id text,
  p_path text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_heartbeat_seconds integer DEFAULT 60,
  p_context jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  heartbeat_seconds integer;
  credited_seconds integer := 0;
  is_visible boolean := COALESCE((p_context->>'is_visible')::boolean, true);
  is_focused boolean := COALESCE((p_context->>'is_focused')::boolean, false);
  has_recent_interaction boolean := COALESCE((p_context->>'has_recent_interaction')::boolean, true);
  idle_seconds integer := GREATEST(0, LEAST(COALESCE((p_context->>'idle_seconds')::integer, 0), 86400));
  activity_mode text := COALESCE(NULLIF(p_context->>'activity_mode', ''), 'browse');
  visible_increment integer := CASE WHEN is_visible THEN 1 ELSE 0 END;
  focused_increment integer := CASE WHEN is_focused THEN 1 ELSE 0 END;
  interaction_increment integer := CASE WHEN has_recent_interaction THEN 1 ELSE 0 END;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_session_id IS NULL OR btrim(p_session_id) = '' THEN
    RAISE EXCEPTION 'Session id is required';
  END IF;

  heartbeat_seconds := GREATEST(30, LEAST(COALESCE(p_heartbeat_seconds, 60), 120));

  IF is_visible AND is_focused AND has_recent_interaction THEN
    credited_seconds := heartbeat_seconds;
  ELSIF is_visible AND (is_focused OR has_recent_interaction OR idle_seconds <= 180) THEN
    credited_seconds := GREATEST(30, heartbeat_seconds / 2);
  END IF;

  IF credited_seconds > 0 THEN
    PERFORM public.heartbeat_app_presence(
      p_session_id,
      p_path,
      p_user_agent,
      credited_seconds
    );
  END IF;

  INSERT INTO public.app_presence_sessions (
    user_id,
    session_id,
    session_date,
    last_path,
    user_agent,
    active_seconds,
    raw_active_seconds,
    visible_heartbeats,
    focused_heartbeats,
    interaction_heartbeats,
    active_mode,
    last_interaction_at,
    started_at,
    last_heartbeat_at,
    ended_at,
    updated_at
  )
  VALUES (
    current_user_id,
    p_session_id,
    current_date,
    NULLIF(p_path, ''),
    NULLIF(p_user_agent, ''),
    0,
    heartbeat_seconds,
    visible_increment,
    focused_increment,
    interaction_increment,
    activity_mode,
    CASE WHEN has_recent_interaction THEN now() ELSE NULL END,
    now(),
    now(),
    NULL,
    now()
  )
  ON CONFLICT (user_id, session_id)
  DO UPDATE SET
    session_date = current_date,
    last_path = COALESCE(NULLIF(EXCLUDED.last_path, ''), public.app_presence_sessions.last_path),
    user_agent = COALESCE(NULLIF(EXCLUDED.user_agent, ''), public.app_presence_sessions.user_agent),
    raw_active_seconds = public.app_presence_sessions.raw_active_seconds + heartbeat_seconds,
    visible_heartbeats = public.app_presence_sessions.visible_heartbeats + visible_increment,
    focused_heartbeats = public.app_presence_sessions.focused_heartbeats + focused_increment,
    interaction_heartbeats = public.app_presence_sessions.interaction_heartbeats + interaction_increment,
    active_mode = activity_mode,
    last_interaction_at = CASE
      WHEN has_recent_interaction THEN now()
      ELSE public.app_presence_sessions.last_interaction_at
    END,
    last_heartbeat_at = now(),
    ended_at = NULL,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.heartbeat_view_session_v2(
  p_session_id text,
  p_tmdb_id text,
  p_media_type text,
  p_season integer DEFAULT NULL,
  p_episode integer DEFAULT NULL,
  p_provider_id text DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_genres text[] DEFAULT NULL,
  p_heartbeat_seconds integer DEFAULT 30,
  p_context jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  heartbeat_seconds integer;
  credited_seconds integer := 0;
  qualified_threshold integer;
  is_visible boolean := COALESCE((p_context->>'is_visible')::boolean, true);
  is_focused boolean := COALESCE((p_context->>'is_focused')::boolean, false);
  has_recent_interaction boolean := COALESCE((p_context->>'has_recent_interaction')::boolean, true);
  idle_seconds integer := GREATEST(0, LEAST(COALESCE((p_context->>'idle_seconds')::integer, 0), 86400));
  activity_mode text := COALESCE(NULLIF(p_context->>'activity_mode', ''), 'watch');
  resume_source text := NULLIF(p_context->>'resume_source', '');
  visible_increment integer := CASE WHEN is_visible THEN 1 ELSE 0 END;
  focused_increment integer := CASE WHEN is_focused THEN 1 ELSE 0 END;
  interaction_increment integer := CASE WHEN has_recent_interaction THEN 1 ELSE 0 END;
  session_record public.view_sessions%ROWTYPE;
  confidence_value integer := 0;
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

  IF is_visible AND is_focused AND has_recent_interaction THEN
    credited_seconds := heartbeat_seconds;
  ELSIF is_visible AND (is_focused OR has_recent_interaction OR idle_seconds <= 120) THEN
    credited_seconds := GREATEST(15, heartbeat_seconds / 2);
  END IF;

  IF credited_seconds > 0 THEN
    PERFORM public.heartbeat_view_session(
      p_session_id,
      p_tmdb_id,
      p_media_type,
      p_season,
      p_episode,
      p_provider_id,
      p_title,
      p_genres,
      credited_seconds
    );
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
    raw_active_seconds,
    visible_heartbeats,
    focused_heartbeats,
    interaction_heartbeats,
    provider_switch_count,
    confidence_score,
    last_activity_mode,
    last_interaction_at,
    last_resume_source,
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
    0,
    heartbeat_seconds,
    visible_increment,
    focused_increment,
    interaction_increment,
    0,
    0,
    activity_mode,
    CASE WHEN has_recent_interaction THEN now() ELSE NULL END,
    resume_source,
    current_date,
    now(),
    now(),
    now()
  )
  ON CONFLICT (user_id, session_id)
  DO UPDATE SET
    session_date = current_date,
    raw_active_seconds = public.view_sessions.raw_active_seconds + heartbeat_seconds,
    visible_heartbeats = public.view_sessions.visible_heartbeats + visible_increment,
    focused_heartbeats = public.view_sessions.focused_heartbeats + focused_increment,
    interaction_heartbeats = public.view_sessions.interaction_heartbeats + interaction_increment,
    provider_switch_count = public.view_sessions.provider_switch_count + CASE
      WHEN NULLIF(EXCLUDED.provider_id, '') IS NOT NULL
        AND public.view_sessions.provider_id IS NOT NULL
        AND public.view_sessions.provider_id IS DISTINCT FROM EXCLUDED.provider_id
      THEN 1
      ELSE 0
    END,
    provider_id = COALESCE(NULLIF(EXCLUDED.provider_id, ''), public.view_sessions.provider_id),
    title = COALESCE(NULLIF(EXCLUDED.title, ''), public.view_sessions.title),
    genres = CASE
      WHEN EXCLUDED.genres IS NULL OR EXCLUDED.genres = 'null'::jsonb OR EXCLUDED.genres = '[]'::jsonb
        THEN public.view_sessions.genres
      ELSE EXCLUDED.genres
    END,
    last_activity_mode = activity_mode,
    last_interaction_at = CASE
      WHEN has_recent_interaction THEN now()
      ELSE public.view_sessions.last_interaction_at
    END,
    last_resume_source = COALESCE(resume_source, public.view_sessions.last_resume_source),
    last_heartbeat_at = now(),
    updated_at = now();

  SELECT *
  INTO session_record
  FROM public.view_sessions
  WHERE user_id = current_user_id
    AND session_id = p_session_id
  FOR UPDATE;

  confidence_value := LEAST(
    100,
    GREATEST(
      0,
      ROUND(LEAST(session_record.active_seconds::numeric / qualified_threshold::numeric, 1) * 60)::integer
      + LEAST(session_record.visible_heartbeats * 2, 12)
      + LEAST(session_record.focused_heartbeats, 8)
      + LEAST(session_record.interaction_heartbeats * 2, 12)
      - LEAST(session_record.provider_switch_count * 8, 24)
      - CASE
          WHEN session_record.raw_active_seconds > session_record.active_seconds THEN 10
          ELSE 0
        END
    )
  );

  UPDATE public.view_sessions
  SET confidence_score = confidence_value
  WHERE id = session_record.id;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_get_recent_view_sessions(integer, uuid, boolean);

CREATE FUNCTION public.admin_get_recent_view_sessions(
  p_limit integer DEFAULT 75,
  p_user_id uuid DEFAULT NULL,
  p_only_unqualified boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  username text,
  session_id text,
  tmdb_id text,
  title text,
  media_type text,
  season integer,
  episode integer,
  provider_id text,
  active_seconds integer,
  raw_active_seconds integer,
  confidence_score integer,
  provider_switch_count integer,
  last_activity_mode text,
  threshold_seconds integer,
  remaining_seconds integer,
  is_qualified boolean,
  qualification_state text,
  qualified_at timestamptz,
  session_date date,
  started_at timestamptz,
  last_heartbeat_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_role text;
  safe_limit integer := least(greatest(coalesce(p_limit, 75), 1), 250);
BEGIN
  SELECT role
  INTO requester_role
  FROM public.profiles profile_row
  WHERE profile_row.id = auth.uid();

  IF requester_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    vs.id,
    vs.user_id,
    profile.username,
    vs.session_id,
    vs.tmdb_id,
    vs.title,
    vs.media_type,
    vs.season,
    vs.episode,
    vs.provider_id,
    vs.active_seconds,
    vs.raw_active_seconds,
    vs.confidence_score,
    vs.provider_switch_count,
    vs.last_activity_mode,
    CASE
      WHEN vs.media_type = 'movie' THEN 20 * 60
      ELSE 10 * 60
    END AS threshold_seconds,
    GREATEST(
      CASE
        WHEN vs.media_type = 'movie' THEN (20 * 60) - vs.active_seconds
        ELSE (10 * 60) - vs.active_seconds
      END,
      0
    ) AS remaining_seconds,
    vs.is_qualified,
    CASE
      WHEN vs.is_qualified THEN 'qualified'
      WHEN vs.confidence_score >= 60 THEN 'close'
      ELSE 'in_progress'
    END AS qualification_state,
    vs.qualified_at,
    vs.session_date,
    vs.started_at,
    vs.last_heartbeat_at,
    vs.updated_at
  FROM public.view_sessions vs
  LEFT JOIN public.profiles profile
    ON profile.id = vs.user_id
  WHERE (p_user_id IS NULL OR vs.user_id = p_user_id)
    AND (NOT p_only_unqualified OR vs.is_qualified = false)
  ORDER BY vs.last_heartbeat_at DESC, vs.updated_at DESC
  LIMIT safe_limit;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_get_platform_presence(integer, text, boolean);

CREATE FUNCTION public.admin_get_platform_presence(
  p_limit integer DEFAULT 100,
  p_search text DEFAULT NULL,
  p_online_only boolean DEFAULT false
)
RETURNS TABLE (
  user_id uuid,
  username text,
  avatar_url text,
  role text,
  can_stream boolean,
  is_online boolean,
  last_seen_at timestamptz,
  current_session_started_at timestamptz,
  current_online_seconds integer,
  today_active_seconds integer,
  total_active_seconds integer,
  session_count integer,
  last_path text,
  active_mode text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_role text;
  safe_limit integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 250);
  search_term text := NULLIF(lower(trim(COALESCE(p_search, ''))), '');
BEGIN
  SELECT profiles.role
  INTO requester_role
  FROM public.profiles
  WHERE profiles.id = auth.uid();

  IF requester_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  WITH latest_session AS (
    SELECT DISTINCT ON (aps.user_id)
      aps.user_id,
      aps.started_at,
      aps.last_heartbeat_at,
      aps.active_seconds,
      aps.last_path,
      aps.active_mode
    FROM public.app_presence_sessions aps
    ORDER BY aps.user_id, aps.last_heartbeat_at DESC, aps.updated_at DESC
  ),
  aggregated AS (
    SELECT
      aps.user_id,
      LEAST(COALESCE(SUM(aps.active_seconds), 0), 2147483647)::integer AS total_active_seconds,
      LEAST(
        COALESCE(SUM(aps.active_seconds) FILTER (WHERE aps.session_date = current_date), 0),
        2147483647
      )::integer AS today_active_seconds,
      LEAST(COALESCE(COUNT(*), 0), 2147483647)::integer AS session_count
    FROM public.app_presence_sessions aps
    GROUP BY aps.user_id
  )
  SELECT
    profile.id AS user_id,
    profile.username,
    profile.avatar_url,
    profile.role,
    profile.can_stream,
    COALESCE(latest.last_heartbeat_at >= (now() - interval '90 seconds'), false) AS is_online,
    latest.last_heartbeat_at AS last_seen_at,
    CASE
      WHEN latest.last_heartbeat_at >= (now() - interval '90 seconds') THEN latest.started_at
      ELSE NULL
    END AS current_session_started_at,
    CASE
      WHEN latest.last_heartbeat_at >= (now() - interval '90 seconds') THEN COALESCE(latest.active_seconds, 0)
      ELSE 0
    END::integer AS current_online_seconds,
    COALESCE(aggregated.today_active_seconds, 0) AS today_active_seconds,
    COALESCE(aggregated.total_active_seconds, 0) AS total_active_seconds,
    COALESCE(aggregated.session_count, 0) AS session_count,
    latest.last_path,
    latest.active_mode
  FROM public.profiles profile
  LEFT JOIN latest_session latest
    ON latest.user_id = profile.id
  LEFT JOIN aggregated
    ON aggregated.user_id = profile.id
  WHERE (
      search_term IS NULL
      OR lower(COALESCE(profile.username, '')) LIKE '%' || search_term || '%'
    )
    AND (
      NOT p_online_only
      OR COALESCE(latest.last_heartbeat_at >= (now() - interval '90 seconds'), false)
    )
  ORDER BY
    COALESCE(latest.last_heartbeat_at >= (now() - interval '90 seconds'), false) DESC,
    latest.last_heartbeat_at DESC NULLS LAST,
    profile.created_at DESC
  LIMIT safe_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.heartbeat_app_presence_v2(text, text, text, integer, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.heartbeat_app_presence_v2(text, text, text, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat_app_presence_v2(text, text, text, integer, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.heartbeat_view_session_v2(text, text, text, integer, integer, text, text, text[], integer, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.heartbeat_view_session_v2(text, text, text, integer, integer, text, text, text[], integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat_view_session_v2(text, text, text, integer, integer, text, text, text[], integer, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.admin_get_recent_view_sessions(integer, uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_get_recent_view_sessions(integer, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_recent_view_sessions(integer, uuid, boolean) TO service_role;

REVOKE ALL ON FUNCTION public.admin_get_platform_presence(integer, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_get_platform_presence(integer, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_platform_presence(integer, text, boolean) TO service_role;
