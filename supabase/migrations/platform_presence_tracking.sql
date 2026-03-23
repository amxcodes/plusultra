-- PLATFORM PRESENCE TRACKING
-- Tracks whole-app activity so admins can see who is online and how much time
-- users have actually spent on the platform outside of embedded player telemetry.

CREATE TABLE IF NOT EXISTS public.app_presence_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  session_date date NOT NULL DEFAULT current_date,
  last_path text,
  user_agent text,
  active_seconds integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_app_presence_sessions_user_date
  ON public.app_presence_sessions(user_id, session_date DESC);

CREATE INDEX IF NOT EXISTS idx_app_presence_sessions_last_heartbeat
  ON public.app_presence_sessions(last_heartbeat_at DESC);

ALTER TABLE public.app_presence_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own presence sessions" ON public.app_presence_sessions;
CREATE POLICY "Users can view their own presence sessions"
  ON public.app_presence_sessions FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.heartbeat_app_presence(
  p_session_id text,
  p_path text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_heartbeat_seconds integer DEFAULT 60
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  heartbeat_seconds integer;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_session_id IS NULL OR btrim(p_session_id) = '' THEN
    RAISE EXCEPTION 'Session id is required';
  END IF;

  heartbeat_seconds := GREATEST(30, LEAST(COALESCE(p_heartbeat_seconds, 60), 120));

  INSERT INTO public.app_presence_sessions (
    user_id,
    session_id,
    session_date,
    last_path,
    user_agent,
    active_seconds,
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
    heartbeat_seconds,
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
    active_seconds = public.app_presence_sessions.active_seconds + heartbeat_seconds,
    last_heartbeat_at = now(),
    ended_at = NULL,
    updated_at = now();

  UPDATE public.profiles
  SET last_seen_activity = now()
  WHERE id = current_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.end_app_presence_session(
  p_session_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.app_presence_sessions
  SET ended_at = now(),
      updated_at = now(),
      last_heartbeat_at = GREATEST(last_heartbeat_at, now())
  WHERE user_id = current_user_id
    AND session_id = p_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_platform_presence(
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
  last_path text
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
      aps.last_path
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
    latest.last_path
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

REVOKE ALL ON FUNCTION public.heartbeat_app_presence(text, text, text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.heartbeat_app_presence(text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat_app_presence(text, text, text, integer) TO service_role;

REVOKE ALL ON FUNCTION public.end_app_presence_session(text) FROM public;
GRANT EXECUTE ON FUNCTION public.end_app_presence_session(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_app_presence_session(text) TO service_role;

REVOKE ALL ON FUNCTION public.admin_get_platform_presence(integer, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_get_platform_presence(integer, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_platform_presence(integer, text, boolean) TO service_role;
