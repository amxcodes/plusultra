-- COMMUNITY TRENDING TITLES
-- Ranks titles from qualified user watch sessions for homepage recommendation rows.

CREATE OR REPLACE FUNCTION public.get_community_trending_titles(
  p_limit integer DEFAULT 12,
  p_days integer DEFAULT 30
)
RETURNS TABLE (
  tmdb_id text,
  media_type text,
  title text,
  qualified_sessions integer,
  unique_watchers integer,
  trending_score numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_limit integer := LEAST(GREATEST(COALESCE(p_limit, 12), 1), 30);
  safe_days integer := LEAST(GREATEST(COALESCE(p_days, 30), 1), 90);
BEGIN
  RETURN QUERY
  WITH eligible AS (
    SELECT
      vs.tmdb_id,
      vs.media_type,
      COALESCE(NULLIF(vs.title, ''), vs.tmdb_id) AS title,
      vs.user_id,
      vs.last_heartbeat_at,
      CASE
        WHEN vs.last_heartbeat_at >= (now() - interval '7 days') THEN 1
        ELSE 0
      END AS recent_weight
    FROM public.view_sessions vs
    WHERE vs.is_qualified = true
      AND vs.last_heartbeat_at >= (now() - make_interval(days => safe_days))
      AND COALESCE(vs.confidence_score, 100) >= 45
  ),
  grouped AS (
    SELECT
      e.tmdb_id,
      e.media_type,
      MAX(e.title) AS title,
      COUNT(*)::integer AS qualified_sessions,
      COUNT(DISTINCT e.user_id)::integer AS unique_watchers,
      SUM(e.recent_weight)::integer AS recent_sessions
    FROM eligible e
    GROUP BY e.tmdb_id, e.media_type
  )
  SELECT
    g.tmdb_id,
    g.media_type,
    g.title,
    g.qualified_sessions,
    g.unique_watchers,
    (
      g.unique_watchers * 5
      + g.qualified_sessions * 2
      + g.recent_sessions * 3
    )::numeric AS trending_score
  FROM grouped g
  ORDER BY trending_score DESC, g.unique_watchers DESC, g.qualified_sessions DESC, g.title ASC
  LIMIT safe_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_community_trending_titles(integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_community_trending_titles(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_community_trending_titles(integer, integer) TO service_role;
