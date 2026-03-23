-- PROVIDER ANALYTICS EMBED HEURISTICS
-- Refines provider scoring with embed-specific signals like no-ready timeouts,
-- early provider switches, and repeated retries on the same title.

DROP FUNCTION IF EXISTS public.admin_get_provider_analytics(integer);

CREATE OR REPLACE FUNCTION public.get_best_provider_for_content(
  p_tmdb_id text,
  p_media_type text,
  p_season integer DEFAULT 1,
  p_episode integer DEFAULT 1
)
RETURNS TABLE (
  provider_id text,
  vote_count integer,
  attempt_count integer,
  success_count integer,
  failure_count integer,
  quick_exit_count integer,
  total_score numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH provider_base AS (
    SELECT
      pp.id AS provider_id,
      pp.sort_order
    FROM public.player_providers pp
    WHERE pp.enabled = true
  ),
  manual_votes AS (
    SELECT
      sv.provider_id,
      COALESCE(SUM(sv.vote_count), 0)::integer AS vote_count
    FROM public.server_votes sv
    WHERE sv.tmdb_id = p_tmdb_id
      AND sv.media_type = p_media_type
      AND COALESCE(sv.season, 1) = COALESCE(p_season, 1)
      AND COALESCE(sv.episode, 1) = COALESCE(p_episode, 1)
    GROUP BY sv.provider_id
  ),
  recent_attempts AS (
    SELECT
      pa.*,
      ROW_NUMBER() OVER (
        PARTITION BY pa.user_id, pa.provider_id, pa.tmdb_id, pa.media_type, COALESCE(pa.season, 1), COALESCE(pa.episode, 1)
        ORDER BY pa.started_at
      ) AS retry_rank
    FROM public.provider_attempts pa
    WHERE pa.tmdb_id = p_tmdb_id
      AND pa.media_type = p_media_type
      AND COALESCE(pa.season, 1) = COALESCE(p_season, 1)
      AND COALESCE(pa.episode, 1) = COALESCE(p_episode, 1)
      AND pa.started_at >= (now() - interval '30 days')
  ),
  automatic_stats AS (
    SELECT
      ra.provider_id,
      COUNT(*)::integer AS attempt_count,
      COUNT(*) FILTER (WHERE ra.is_success)::integer AS success_count,
      COUNT(*) FILTER (
        WHERE COALESCE(ra.ended_at, now()) IS NOT NULL
          AND ra.is_success = false
      )::integer AS failure_count,
      COUNT(*) FILTER (
        WHERE COALESCE(ra.ended_at, now()) IS NOT NULL
          AND ra.active_seconds < 45
          AND COALESCE(ra.progress_seconds, 0) < 30
      )::integer AS quick_exit_count,
      COUNT(*) FILTER (
        WHERE ra.ended_reason = 'no_ready_timeout'
      )::integer AS no_ready_timeout_count,
      COUNT(*) FILTER (
        WHERE ra.ended_reason = 'switched_provider_early'
      )::integer AS switched_early_count,
      COUNT(*) FILTER (
        WHERE ra.retry_rank > 1
      )::integer AS retry_attempt_count
    FROM recent_attempts ra
    GROUP BY ra.provider_id
  )
  SELECT
    provider_base.provider_id,
    COALESCE(manual_votes.vote_count, 0) AS vote_count,
    COALESCE(automatic_stats.attempt_count, 0) AS attempt_count,
    COALESCE(automatic_stats.success_count, 0) AS success_count,
    COALESCE(automatic_stats.failure_count, 0) AS failure_count,
    COALESCE(automatic_stats.quick_exit_count, 0) AS quick_exit_count,
    (
      COALESCE(manual_votes.vote_count, 0) * 4
      + COALESCE(automatic_stats.success_count, 0) * 3
      - COALESCE(automatic_stats.failure_count, 0) * 2
      - COALESCE(automatic_stats.quick_exit_count, 0) * 2
      - COALESCE(automatic_stats.no_ready_timeout_count, 0) * 3
      - COALESCE(automatic_stats.switched_early_count, 0) * 2
      - COALESCE(automatic_stats.retry_attempt_count, 0)
      - (provider_base.sort_order::numeric / 1000.0)
    )::numeric AS total_score
  FROM provider_base
  LEFT JOIN manual_votes
    ON manual_votes.provider_id = provider_base.provider_id
  LEFT JOIN automatic_stats
    ON automatic_stats.provider_id = provider_base.provider_id
  ORDER BY total_score DESC, provider_base.sort_order ASC
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_provider_analytics(
  p_days integer DEFAULT 30
)
RETURNS TABLE (
  provider_id text,
  provider_name text,
  enabled boolean,
  render_mode text,
  risk_level text,
  sort_order integer,
  manual_votes integer,
  total_attempts integer,
  success_count integer,
  failure_count integer,
  quick_exit_count integer,
  no_ready_timeout_count integer,
  switched_early_count integer,
  retry_attempt_count integer,
  avg_active_seconds integer,
  success_rate numeric,
  automatic_score numeric,
  last_attempt_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_role text;
  safe_days integer := LEAST(GREATEST(COALESCE(p_days, 30), 1), 180);
BEGIN
  SELECT profiles.role
  INTO requester_role
  FROM public.profiles
  WHERE profiles.id = auth.uid();

  IF requester_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  WITH manual_votes AS (
    SELECT
      sv.provider_id,
      COALESCE(SUM(sv.vote_count), 0)::integer AS manual_votes
    FROM public.server_votes sv
    GROUP BY sv.provider_id
  ),
  recent_attempts AS (
    SELECT
      pa.*,
      ROW_NUMBER() OVER (
        PARTITION BY pa.user_id, pa.provider_id, pa.tmdb_id, pa.media_type, COALESCE(pa.season, 1), COALESCE(pa.episode, 1)
        ORDER BY pa.started_at
      ) AS retry_rank
    FROM public.provider_attempts pa
    WHERE pa.started_at >= (now() - make_interval(days => safe_days))
  ),
  attempt_stats AS (
    SELECT
      ra.provider_id,
      COUNT(*)::integer AS total_attempts,
      COUNT(*) FILTER (WHERE ra.is_success)::integer AS success_count,
      COUNT(*) FILTER (
        WHERE ra.is_success = false
          AND ra.ended_at IS NOT NULL
      )::integer AS failure_count,
      COUNT(*) FILTER (
        WHERE ra.ended_at IS NOT NULL
          AND ra.active_seconds < 45
          AND COALESCE(ra.progress_seconds, 0) < 30
      )::integer AS quick_exit_count,
      COUNT(*) FILTER (
        WHERE ra.ended_reason = 'no_ready_timeout'
      )::integer AS no_ready_timeout_count,
      COUNT(*) FILTER (
        WHERE ra.ended_reason = 'switched_provider_early'
      )::integer AS switched_early_count,
      COUNT(*) FILTER (
        WHERE ra.retry_rank > 1
      )::integer AS retry_attempt_count,
      ROUND(AVG(ra.active_seconds))::integer AS avg_active_seconds,
      MAX(ra.started_at) AS last_attempt_at
    FROM recent_attempts ra
    GROUP BY ra.provider_id
  )
  SELECT
    pp.id AS provider_id,
    pp.name AS provider_name,
    pp.enabled,
    pp.render_mode,
    pp.risk_level,
    pp.sort_order,
    COALESCE(manual_votes.manual_votes, 0) AS manual_votes,
    COALESCE(attempt_stats.total_attempts, 0) AS total_attempts,
    COALESCE(attempt_stats.success_count, 0) AS success_count,
    COALESCE(attempt_stats.failure_count, 0) AS failure_count,
    COALESCE(attempt_stats.quick_exit_count, 0) AS quick_exit_count,
    COALESCE(attempt_stats.no_ready_timeout_count, 0) AS no_ready_timeout_count,
    COALESCE(attempt_stats.switched_early_count, 0) AS switched_early_count,
    COALESCE(attempt_stats.retry_attempt_count, 0) AS retry_attempt_count,
    COALESCE(attempt_stats.avg_active_seconds, 0) AS avg_active_seconds,
    CASE
      WHEN COALESCE(attempt_stats.total_attempts, 0) = 0 THEN 0
      ELSE ROUND((attempt_stats.success_count::numeric / NULLIF(attempt_stats.total_attempts, 0)) * 100, 1)
    END AS success_rate,
    (
      COALESCE(attempt_stats.success_count, 0) * 3
      - COALESCE(attempt_stats.failure_count, 0) * 2
      - COALESCE(attempt_stats.quick_exit_count, 0) * 2
      - COALESCE(attempt_stats.no_ready_timeout_count, 0) * 3
      - COALESCE(attempt_stats.switched_early_count, 0) * 2
      - COALESCE(attempt_stats.retry_attempt_count, 0)
    )::numeric AS automatic_score,
    attempt_stats.last_attempt_at
  FROM public.player_providers pp
  LEFT JOIN manual_votes
    ON manual_votes.provider_id = pp.id
  LEFT JOIN attempt_stats
    ON attempt_stats.provider_id = pp.id
  ORDER BY pp.sort_order ASC, pp.name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_best_provider_for_content(text, text, integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_best_provider_for_content(text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_best_provider_for_content(text, text, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.admin_get_provider_analytics(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_get_provider_analytics(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_provider_analytics(integer) TO service_role;
