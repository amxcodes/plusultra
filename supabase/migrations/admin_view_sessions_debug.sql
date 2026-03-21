-- ADMIN VIEW SESSION DEBUG RPC
-- Lets admins inspect the recent session heartbeat stream without querying SQL.

CREATE OR REPLACE FUNCTION public.admin_get_recent_view_sessions(
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
  FROM public.profiles
  WHERE id = auth.uid();

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
      WHEN vs.active_seconds >= (
        CASE
          WHEN vs.media_type = 'movie' THEN 15 * 60
          ELSE 7 * 60
        END
      ) THEN 'close'
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

REVOKE ALL ON FUNCTION public.admin_get_recent_view_sessions(integer, uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_get_recent_view_sessions(integer, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_recent_view_sessions(integer, uuid, boolean) TO service_role;
