-- ADMIN ANALYTICS EVENT READ RPCS
-- Gives admins a compact view of buffered client analytics without exposing user-private rows directly.

CREATE OR REPLACE FUNCTION public.admin_get_analytics_summary(
  p_days integer DEFAULT 7
)
RETURNS TABLE (
  total_events bigint,
  unique_users bigint,
  player_events bigint,
  provider_events bigint,
  search_events bigint,
  download_events bigint,
  content_events bigint,
  playlist_events bigint,
  navigation_events bigint,
  failure_events bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  window_days integer := LEAST(GREATEST(COALESCE(p_days, 7), 1), 90);
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*)::bigint AS total_events,
    COUNT(DISTINCT ae.user_id)::bigint AS unique_users,
    COUNT(*) FILTER (WHERE ae.event_category = 'player')::bigint AS player_events,
    COUNT(*) FILTER (WHERE ae.event_name LIKE 'provider_%')::bigint AS provider_events,
    COUNT(*) FILTER (WHERE ae.event_category = 'search')::bigint AS search_events,
    COUNT(*) FILTER (WHERE ae.event_category = 'download')::bigint AS download_events,
    COUNT(*) FILTER (WHERE ae.event_category = 'content')::bigint AS content_events,
    COUNT(*) FILTER (WHERE ae.event_category = 'playlist')::bigint AS playlist_events,
    COUNT(*) FILTER (WHERE ae.event_category = 'navigation')::bigint AS navigation_events,
    COUNT(*) FILTER (
      WHERE ae.event_name LIKE '%failed%'
         OR ae.event_name LIKE '%error%'
         OR ae.event_name LIKE '%timeout%'
    )::bigint AS failure_events
  FROM public.analytics_events ae
  WHERE ae.occurred_at >= now() - make_interval(days => window_days);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_analytics_events(
  p_limit integer DEFAULT 120,
  p_category text DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  event_name text,
  event_category text,
  username text,
  user_id uuid,
  session_id text,
  attempt_id text,
  tmdb_id text,
  media_type text,
  season integer,
  episode integer,
  provider_id text,
  page_path text,
  client_context jsonb,
  payload jsonb,
  occurred_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_limit integer := LEAST(GREATEST(COALESCE(p_limit, 120), 25), 300);
  safe_search text := NULLIF(trim(COALESCE(p_search, '')), '');
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    ae.id,
    ae.event_name::text,
    ae.event_category::text,
    p.username::text,
    ae.user_id,
    ae.session_id::text,
    ae.attempt_id::text,
    ae.tmdb_id::text,
    ae.media_type::text,
    ae.season,
    ae.episode,
    ae.provider_id::text,
    ae.page_path::text,
    ae.client_context,
    ae.payload,
    ae.occurred_at
  FROM public.analytics_events ae
  LEFT JOIN public.profiles p ON p.id = ae.user_id
  WHERE (p_category IS NULL OR ae.event_category = p_category)
    AND (
      safe_search IS NULL
      OR ae.event_name ILIKE '%' || safe_search || '%'
      OR ae.event_category ILIKE '%' || safe_search || '%'
      OR ae.provider_id ILIKE '%' || safe_search || '%'
      OR ae.tmdb_id ILIKE '%' || safe_search || '%'
      OR p.username ILIKE '%' || safe_search || '%'
      OR ae.payload::text ILIKE '%' || safe_search || '%'
    )
  ORDER BY ae.occurred_at DESC
  LIMIT safe_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_analytics_summary(integer) FROM public;
REVOKE ALL ON FUNCTION public.admin_get_analytics_events(integer, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_get_analytics_summary(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_analytics_events(integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_analytics_summary(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_analytics_events(integer, text, text) TO service_role;
