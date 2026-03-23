-- PROVIDER ANALYTICS AUTOMATION
-- Automatic provider attempt tracking and scoring that complements manual server votes.

CREATE TABLE IF NOT EXISTS public.provider_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attempt_id text NOT NULL,
  session_id text,
  tmdb_id text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('movie', 'tv')),
  season integer,
  episode integer,
  provider_id text NOT NULL,
  active_seconds integer NOT NULL DEFAULT 0,
  progress_seconds integer NOT NULL DEFAULT 0,
  is_ready boolean NOT NULL DEFAULT false,
  ready_at timestamptz,
  is_success boolean NOT NULL DEFAULT false,
  ended_reason text,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, attempt_id)
);

CREATE INDEX IF NOT EXISTS idx_provider_attempts_lookup
  ON public.provider_attempts(tmdb_id, media_type, season, episode, provider_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_provider_attempts_provider_recent
  ON public.provider_attempts(provider_id, started_at DESC);

ALTER TABLE public.provider_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own provider attempts" ON public.provider_attempts;
CREATE POLICY "Users can view their own provider attempts"
  ON public.provider_attempts FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.start_provider_attempt(
  p_attempt_id text,
  p_session_id text,
  p_tmdb_id text,
  p_media_type text,
  p_season integer DEFAULT NULL,
  p_episode integer DEFAULT NULL,
  p_provider_id text DEFAULT NULL
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

  IF p_attempt_id IS NULL OR btrim(p_attempt_id) = '' THEN
    RAISE EXCEPTION 'Attempt id is required';
  END IF;

  INSERT INTO public.provider_attempts (
    user_id,
    attempt_id,
    session_id,
    tmdb_id,
    media_type,
    season,
    episode,
    provider_id,
    started_at,
    last_heartbeat_at,
    ended_at,
    updated_at
  )
  VALUES (
    current_user_id,
    p_attempt_id,
    NULLIF(p_session_id, ''),
    p_tmdb_id,
    p_media_type,
    p_season,
    p_episode,
    COALESCE(NULLIF(p_provider_id, ''), 'unknown'),
    now(),
    now(),
    NULL,
    now()
  )
  ON CONFLICT (user_id, attempt_id)
  DO UPDATE SET
    session_id = COALESCE(NULLIF(EXCLUDED.session_id, ''), public.provider_attempts.session_id),
    provider_id = COALESCE(NULLIF(EXCLUDED.provider_id, ''), public.provider_attempts.provider_id),
    last_heartbeat_at = now(),
    ended_at = NULL,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_provider_attempt_ready(
  p_attempt_id text
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

  UPDATE public.provider_attempts
  SET
    is_ready = true,
    ready_at = COALESCE(ready_at, now()),
    last_heartbeat_at = now(),
    updated_at = now()
  WHERE user_id = current_user_id
    AND attempt_id = p_attempt_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.heartbeat_provider_attempt(
  p_attempt_id text,
  p_progress_seconds integer DEFAULT NULL,
  p_active_increment integer DEFAULT 15
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  safe_increment integer := GREATEST(5, LEAST(COALESCE(p_active_increment, 15), 60));
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.provider_attempts
  SET
    active_seconds = active_seconds + safe_increment,
    progress_seconds = GREATEST(progress_seconds, COALESCE(p_progress_seconds, progress_seconds)),
    is_success = (
      GREATEST(progress_seconds, COALESCE(p_progress_seconds, progress_seconds)) >= 90
      OR (is_ready AND (active_seconds + safe_increment) >= 90)
      OR (active_seconds + safe_increment) >= 180
    ),
    last_heartbeat_at = now(),
    updated_at = now()
  WHERE user_id = current_user_id
    AND attempt_id = p_attempt_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_provider_attempt(
  p_attempt_id text,
  p_reason text DEFAULT NULL
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

  UPDATE public.provider_attempts
  SET
    ended_reason = COALESCE(NULLIF(p_reason, ''), ended_reason),
    ended_at = COALESCE(ended_at, now()),
    is_success = (
      is_success
      OR progress_seconds >= 90
      OR (is_ready AND active_seconds >= 90)
      OR active_seconds >= 180
    ),
    last_heartbeat_at = GREATEST(last_heartbeat_at, now()),
    updated_at = now()
  WHERE user_id = current_user_id
    AND attempt_id = p_attempt_id;
END;
$$;

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
  automatic_stats AS (
    SELECT
      pa.provider_id,
      COUNT(*)::integer AS attempt_count,
      COUNT(*) FILTER (WHERE pa.is_success)::integer AS success_count,
      COUNT(*) FILTER (
        WHERE COALESCE(pa.ended_at, now()) IS NOT NULL
          AND pa.is_success = false
      )::integer AS failure_count,
      COUNT(*) FILTER (
        WHERE COALESCE(pa.ended_at, now()) IS NOT NULL
          AND pa.active_seconds < 45
          AND COALESCE(pa.progress_seconds, 0) < 30
      )::integer AS quick_exit_count
    FROM public.provider_attempts pa
    WHERE pa.tmdb_id = p_tmdb_id
      AND pa.media_type = p_media_type
      AND COALESCE(pa.season, 1) = COALESCE(p_season, 1)
      AND COALESCE(pa.episode, 1) = COALESCE(p_episode, 1)
      AND pa.started_at >= (now() - interval '30 days')
    GROUP BY pa.provider_id
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
  attempt_stats AS (
    SELECT
      pa.provider_id,
      COUNT(*)::integer AS total_attempts,
      COUNT(*) FILTER (WHERE pa.is_success)::integer AS success_count,
      COUNT(*) FILTER (WHERE pa.is_success = false AND pa.ended_at IS NOT NULL)::integer AS failure_count,
      COUNT(*) FILTER (
        WHERE pa.ended_at IS NOT NULL
          AND pa.active_seconds < 45
          AND COALESCE(pa.progress_seconds, 0) < 30
      )::integer AS quick_exit_count,
      ROUND(AVG(pa.active_seconds))::integer AS avg_active_seconds,
      MAX(pa.started_at) AS last_attempt_at
    FROM public.provider_attempts pa
    WHERE pa.started_at >= (now() - make_interval(days => safe_days))
    GROUP BY pa.provider_id
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
    COALESCE(attempt_stats.avg_active_seconds, 0) AS avg_active_seconds,
    CASE
      WHEN COALESCE(attempt_stats.total_attempts, 0) = 0 THEN 0
      ELSE ROUND((attempt_stats.success_count::numeric / NULLIF(attempt_stats.total_attempts, 0)) * 100, 1)
    END AS success_rate,
    (
      COALESCE(attempt_stats.success_count, 0) * 3
      - COALESCE(attempt_stats.failure_count, 0) * 2
      - COALESCE(attempt_stats.quick_exit_count, 0) * 2
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

REVOKE ALL ON FUNCTION public.start_provider_attempt(text, text, text, text, integer, integer, text) FROM public;
GRANT EXECUTE ON FUNCTION public.start_provider_attempt(text, text, text, text, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_provider_attempt(text, text, text, text, integer, integer, text) TO service_role;

REVOKE ALL ON FUNCTION public.mark_provider_attempt_ready(text) FROM public;
GRANT EXECUTE ON FUNCTION public.mark_provider_attempt_ready(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_provider_attempt_ready(text) TO service_role;

REVOKE ALL ON FUNCTION public.heartbeat_provider_attempt(text, integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.heartbeat_provider_attempt(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat_provider_attempt(text, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.finish_provider_attempt(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.finish_provider_attempt(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_provider_attempt(text, text) TO service_role;

REVOKE ALL ON FUNCTION public.get_best_provider_for_content(text, text, integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_best_provider_for_content(text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_best_provider_for_content(text, text, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.admin_get_provider_analytics(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_get_provider_analytics(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_provider_analytics(integer) TO service_role;
