


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."admin_delete_user"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    deleted_user jsonb;
    is_admin boolean;
BEGIN
    -- Security: Only admins can call this
    SELECT role = 'admin' INTO is_admin
    FROM profiles WHERE id = auth.uid();
    
    IF NOT is_admin THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;
    
    -- Prevent self-deletion
    IF p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot delete your own account';
    END IF;
    
    -- Get user info before deletion (for confirmation/logging)
    SELECT jsonb_build_object(
        'id', id,
        'username', username,
        'role', role,
        'created_at', created_at,
        'deleted_at', now()
    ) INTO deleted_user
    FROM profiles WHERE id = p_user_id;
    
    -- Check if user exists
    IF deleted_user IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    -- Delete from profiles table
    -- Foreign key CASCADE will handle:
    --   - playlists (user_id FK)
    --   - playlist_items (via playlists cascade)
    --   - watch_party (created_by FK)  
    --   - watch_party_members (user_id FK)
    --   - playlist_likes (user_id FK)
    --   - follows (follower_id/following_id FK)
    DELETE FROM profiles WHERE id = p_user_id;
    
    -- Return deleted user info for audit logging
    RETURN deleted_user;
END;
$$;


ALTER FUNCTION "public"."admin_delete_user"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_all_profiles"("p_limit" integer DEFAULT 50) RETURNS TABLE("id" "uuid", "username" "text", "avatar_url" "text", "role" "text", "can_stream" boolean, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  requester_role text;
  safe_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 500);
BEGIN
  SELECT profiles.role
  INTO requester_role
  FROM public.profiles
  WHERE profiles.id = auth.uid();

  IF requester_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    profile.id,
    profile.username,
    profile.avatar_url,
    profile.role,
    profile.can_stream,
    profile.created_at
  FROM public.profiles profile
  ORDER BY profile.created_at DESC
  LIMIT safe_limit;
END;
$$;


ALTER FUNCTION "public"."admin_get_all_profiles"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_platform_presence"("p_limit" integer DEFAULT 100, "p_search" "text" DEFAULT NULL::"text", "p_online_only" boolean DEFAULT false) RETURNS TABLE("user_id" "uuid", "username" "text", "avatar_url" "text", "role" "text", "can_stream" boolean, "is_online" boolean, "last_seen_at" timestamp with time zone, "current_session_started_at" timestamp with time zone, "current_online_seconds" integer, "today_active_seconds" integer, "total_active_seconds" integer, "session_count" integer, "last_path" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."admin_get_platform_presence"("p_limit" integer, "p_search" "text", "p_online_only" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_provider_analytics"("p_days" integer DEFAULT 30) RETURNS TABLE("provider_id" "text", "provider_name" "text", "enabled" boolean, "render_mode" "text", "risk_level" "text", "sort_order" integer, "manual_votes" integer, "total_attempts" integer, "success_count" integer, "failure_count" integer, "quick_exit_count" integer, "no_ready_timeout_count" integer, "switched_early_count" integer, "retry_attempt_count" integer, "avg_active_seconds" integer, "success_rate" numeric, "automatic_score" numeric, "last_attempt_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."admin_get_provider_analytics"("p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_recent_view_sessions"("p_limit" integer DEFAULT 75, "p_user_id" "uuid" DEFAULT NULL::"uuid", "p_only_unqualified" boolean DEFAULT false) RETURNS TABLE("id" "uuid", "user_id" "uuid", "username" "text", "session_id" "text", "tmdb_id" "text", "title" "text", "media_type" "text", "season" integer, "episode" integer, "provider_id" "text", "active_seconds" integer, "threshold_seconds" integer, "remaining_seconds" integer, "is_qualified" boolean, "qualification_state" "text", "qualified_at" timestamp with time zone, "session_date" "date", "started_at" timestamp with time zone, "last_heartbeat_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."admin_get_recent_view_sessions"("p_limit" integer, "p_user_id" "uuid", "p_only_unqualified" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_update_user_role"("p_user_id" "uuid", "p_new_role" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

  UPDATE public.profiles
  SET role = p_new_role
  WHERE id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."admin_update_user_role"("p_user_id" "uuid", "p_new_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_update_user_streaming_permission"("p_user_id" "uuid", "p_can_stream" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

  UPDATE public.profiles
  SET can_stream = p_can_stream
  WHERE id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."admin_update_user_streaming_permission"("p_user_id" "uuid", "p_can_stream" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_fulfill_request"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    UPDATE public.movie_requests
    SET status = 'fulfilled', updated_at = NOW()
    WHERE id = NEW.request_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_fulfill_request"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_taste_compatibility"("user_a" "uuid", "user_b" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    genres_a JSONB;
    genres_b JSONB;
    total_score INTEGER := 0;
    shared_genres TEXT[] := ARRAY[]::TEXT[];
    key TEXT;
    val_a INTEGER;
    val_b INTEGER;
BEGIN
    SELECT stats->'genre_counts' INTO genres_a FROM public.profiles WHERE id = user_a;
    SELECT stats->'genre_counts' INTO genres_b FROM public.profiles WHERE id = user_b;
    
    IF genres_a IS NULL OR genres_b IS NULL THEN
        RETURN jsonb_build_object('score', 0, 'shared', ARRAY[]::TEXT[], 'message', 'Not enough data');
    END IF;

    FOR key IN SELECT jsonb_object_keys(genres_a) LOOP
        IF genres_b ? key THEN
            val_a := (genres_a->>key)::INTEGER;
            val_b := (genres_b->>key)::INTEGER;
            total_score := total_score + (LEAST(val_a, val_b) * 5);
            shared_genres := array_append(shared_genres, key);
        END IF;
    END LOOP;
    
    IF total_score > 100 THEN total_score := 100; END IF;
    RETURN jsonb_build_object('score', total_score, 'shared', shared_genres);
END;
$$;


ALTER FUNCTION "public"."calculate_taste_compatibility"("user_a" "uuid", "user_b" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_registration_enabled"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    is_enabled text;
BEGIN
    -- Check app_settings for registration status
    -- Use exception handling to avoid 500 errors
    BEGIN
        SELECT value INTO is_enabled 
        FROM public.app_settings 
        WHERE key = 'registration_enabled';
    EXCEPTION
        WHEN OTHERS THEN
            -- If table doesn't exist or query fails, allow registration (fail-safe)
            RETURN NEW;
    END;
    
    -- Block signup if explicitly disabled
    IF is_enabled = 'false' THEN
        RAISE EXCEPTION 'New user registration is currently disabled. Please contact an administrator.'
            USING HINT = 'Registration can be enabled by an admin in the dashboard';
    END IF;
    
    -- Allow registration (if enabled or setting not found)
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_registration_enabled"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_parties"() RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  delete from public.watch_parties where expires_at < now();
$$;


ALTER FUNCTION "public"."cleanup_expired_parties"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clear_my_watch_history"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  is_enabled text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT value
  INTO is_enabled
  FROM public.app_settings
  WHERE key = 'clear_history_enabled';

  IF is_enabled != 'true' THEN
    RAISE EXCEPTION 'This feature is currently disabled by the administrator.';
  END IF;

  UPDATE public.profiles
  SET watch_history = '{}'::jsonb
  WHERE id = auth.uid();
END;
$$;


ALTER FUNCTION "public"."clear_my_watch_history"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."end_app_presence_session"("p_session_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."end_app_presence_session"("p_session_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finish_provider_attempt"("p_attempt_id" "text", "p_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."finish_provider_attempt"("p_attempt_id" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_invite_code"() RETURNS "text"
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  select upper(substring(md5(random()::text) from 1 for 6));
$$;


ALTER FUNCTION "public"."generate_invite_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_best_provider_for_content"("p_tmdb_id" "text", "p_media_type" "text", "p_season" integer DEFAULT 1, "p_episode" integer DEFAULT 1) RETURNS TABLE("provider_id" "text", "vote_count" integer, "attempt_count" integer, "success_count" integer, "failure_count" integer, "quick_exit_count" integer, "total_score" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_best_provider_for_content"("p_tmdb_id" "text", "p_media_type" "text", "p_season" integer, "p_episode" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_community_stats"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result jsonb;
  user_stats jsonb;
  user_total int;
  user_movies int;
  user_shows int;
  user_streak int;
  user_rewatches int;
  cache_age interval;
  use_cache boolean := false;
BEGIN
  -- Get user's stats
  SELECT stats INTO user_stats 
  FROM public.profiles 
  WHERE id = p_user_id;
  
  -- If user has no stats, return null
  IF user_stats IS NULL OR user_stats = '{}'::jsonb THEN
    RETURN jsonb_build_object(
      'error', 'No stats available for user',
      'user_percentile', jsonb_build_object(
        'total_content', 0,
        'streak', 0,
        'rewatches', 0
      )
    );
  END IF;
  
  -- Extract user's metrics
  user_movies := COALESCE((user_stats->>'total_movies')::int, 0);
  user_shows := COALESCE((user_stats->>'total_shows')::int, 0);
  user_total := user_movies + user_shows;
  user_streak := COALESCE((user_stats->>'max_streak')::int, 0);
  user_rewatches := COALESCE((user_stats->>'rewatch_count')::int, 0);
  
  -- Check if cache is fresh (less than 24 hours old)
  SELECT EXTRACT(EPOCH FROM (now() - updated_at))::int / 3600 < 24 INTO use_cache
  FROM public.community_stats_cache WHERE id = 1;
  
  -- Calculate community stats (with or without cache)
  WITH community_data AS (
    SELECT 
      -- Averages
      ROUND(AVG(COALESCE((stats->>'total_movies')::int, 0) + 
                COALESCE((stats->>'total_shows')::int, 0)), 1) as avg_total,
      ROUND(AVG(COALESCE((stats->>'total_movies')::int, 0)), 1) as avg_movies,
      ROUND(AVG(COALESCE((stats->>'total_shows')::int, 0)), 1) as avg_shows,
      ROUND(AVG(COALESCE((stats->>'max_streak')::int, 0)), 1) as avg_streak,
      ROUND(AVG(COALESCE((stats->>'rewatch_count')::int, 0)), 1) as avg_rewatches,
      
      -- Count active users
      COUNT(*) as total_users,
      
      -- Medians for reference
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY 
        COALESCE((stats->>'total_movies')::int, 0) + 
        COALESCE((stats->>'total_shows')::int, 0)) as median_total,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY 
        COALESCE((stats->>'max_streak')::int, 0)) as median_streak
    FROM public.profiles
    WHERE stats IS NOT NULL 
      AND stats != '{}'::jsonb
      AND (COALESCE((stats->>'total_movies')::int, 0) + 
           COALESCE((stats->>'total_shows')::int, 0)) > 0
  ),
  user_percentiles AS (
    SELECT
      -- Percentile: % of users this user is better than
      ROUND(
        (COUNT(CASE 
          WHEN (COALESCE((stats->>'total_movies')::int, 0) + 
                COALESCE((stats->>'total_shows')::int, 0)) < user_total 
          THEN 1 END)::float / NULLIF(COUNT(*)::float, 0) * 100)::numeric, 
        1
      ) as total_percentile,
      
      ROUND(
        (COUNT(CASE 
          WHEN COALESCE((stats->>'max_streak')::int, 0) < user_streak 
          THEN 1 END)::float / NULLIF(COUNT(*)::float, 0) * 100)::numeric, 
        1
      ) as streak_percentile,
      
      ROUND(
        (COUNT(CASE 
          WHEN COALESCE((stats->>'rewatch_count')::int, 0) < user_rewatches 
          THEN 1 END)::float / NULLIF(COUNT(*)::float, 0) * 100)::numeric, 
        1
      ) as rewatch_percentile
    FROM public.profiles
    WHERE stats IS NOT NULL 
      AND stats != '{}'::jsonb
      AND (COALESCE((stats->>'total_movies')::int, 0) + 
           COALESCE((stats->>'total_shows')::int, 0)) > 0
  ),
  top_community_genres AS (
    -- Aggregate all genre counts across users
    SELECT 
      genre,
      SUM(count::int) as total_count
    FROM public.profiles,
    LATERAL jsonb_each_text(COALESCE(stats->'genre_counts', '{}'::jsonb)) AS genre_data(genre, count)
    WHERE stats IS NOT NULL
    GROUP BY genre
    ORDER BY total_count DESC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'avg_total_content', COALESCE(cd.avg_total, 0),
    'avg_movies', COALESCE(cd.avg_movies, 0),
    'avg_shows', COALESCE(cd.avg_shows, 0),
    'avg_streak', COALESCE(cd.avg_streak, 0),
    'avg_rewatch_count', COALESCE(cd.avg_rewatches, 0),
    'median_total', COALESCE(cd.median_total, 0),
    'median_streak', COALESCE(cd.median_streak, 0),
    'total_users', COALESCE(cd.total_users, 0),
    'user_percentile', jsonb_build_object(
      'total_content', COALESCE(up.total_percentile, 0),
      'streak', COALESCE(up.streak_percentile, 0),
      'rewatches', COALESCE(up.rewatch_percentile, 0)
    ),
    'top_community_genres', (
      SELECT jsonb_agg(jsonb_build_object('genre', genre, 'count', total_count))
      FROM top_community_genres
    ),
    'user_stats', jsonb_build_object(
      'total_content', user_total,
      'movies', user_movies,
      'shows', user_shows,
      'streak', user_streak,
      'rewatches', user_rewatches
    ),
    'cache_used', use_cache,
    'generated_at', now()
  ) INTO result
  FROM community_data cd
  CROSS JOIN user_percentiles up;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_community_stats"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_playlist_collaboration_stats"("p_playlist_id" "uuid") RETURNS TABLE("user_id" "uuid", "username" "text", "avatar_url" "text", "items_added" integer, "role" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    -- 1. Collaborators (Accepted)
    SELECT p.id, p.username, p.avatar_url, COALESCE(COUNT(pi.tmdb_id)::INTEGER, 0), pc.role
    FROM public.playlist_collaborators pc
    JOIN public.profiles p ON p.id = pc.user_id
    LEFT JOIN public.playlist_items pi ON pi.playlist_id = pc.playlist_id AND pi.added_by_user_id = pc.user_id
    WHERE pc.playlist_id = p_playlist_id AND pc.status = 'accepted'
    GROUP BY p.id, p.username, p.avatar_url, pc.role
    
    UNION ALL
    
    -- 2. Owner
    SELECT pl.user_id, prof.username, prof.avatar_url, COALESCE(COUNT(pi.tmdb_id)::INTEGER, 0), 'owner'::TEXT
    FROM public.playlists pl
    JOIN public.profiles prof ON prof.id = pl.user_id
    LEFT JOIN public.playlist_items pi ON pi.playlist_id = pl.id AND pi.added_by_user_id = pl.user_id
    WHERE pl.id = p_playlist_id
    GROUP BY pl.user_id, prof.username, prof.avatar_url;
END;
$$;


ALTER FUNCTION "public"."get_playlist_collaboration_stats"("p_playlist_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_private_profile"("p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "username" "text", "avatar_url" "text", "role" "text", "can_stream" boolean, "recent_searches" "jsonb", "stats" "jsonb", "last_seen_announcements" timestamp with time zone, "last_seen_activity" timestamp with time zone, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  requester_id uuid := auth.uid();
  requester_role text;
  target_user_id uuid := COALESCE(p_user_id, requester_id);
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF target_user_id IS DISTINCT FROM requester_id THEN
    SELECT profiles.role
    INTO requester_role
    FROM public.profiles
    WHERE profiles.id = requester_id;

    IF requester_role IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'Admin access required';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    profile.id,
    profile.username,
    profile.avatar_url,
    profile.role,
    profile.can_stream,
    profile.recent_searches,
    profile.stats,
    profile.last_seen_announcements,
    profile.last_seen_activity,
    profile.created_at
  FROM public.profiles profile
  WHERE profile.id = target_user_id;
END;
$$;


ALTER FUNCTION "public"."get_private_profile"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_private_watch_history"("p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  requester_id uuid := auth.uid();
  requester_role text;
  target_user_id uuid := COALESCE(p_user_id, requester_id);
  history jsonb;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF target_user_id IS DISTINCT FROM requester_id THEN
    SELECT profiles.role
    INTO requester_role
    FROM public.profiles
    WHERE profiles.id = requester_id;

    IF requester_role IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'Admin access required';
    END IF;
  END IF;

  SELECT COALESCE(profile.watch_history, '{}'::jsonb)
  INTO history
  FROM public.profiles profile
  WHERE profile.id = target_user_id;

  RETURN COALESCE(history, '{}'::jsonb);
END;
$$;


ALTER FUNCTION "public"."get_private_watch_history"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- 1. Create Profile
  insert into public.profiles (id, username, avatar_url, role)
  values (new.id, new.email, new.raw_user_meta_data->>'avatar_url', 'user');

  -- 2. Create Default 'Watch Later' Playlist
  insert into public.playlists (user_id, name, is_public, type)
  values (new.id, 'Watch Later', false, 'watch_later');

  -- 3. Create Default 'Favorites' Playlist
  insert into public.playlists (user_id, name, is_public, type)
  values (new.id, 'Favorites', true, 'favorites');

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_reply_vote"("p_reply_id" "uuid", "p_vote" integer) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    current_vote INT;
    new_total INT;
BEGIN
    -- Check if user already voted
    SELECT vote INTO current_vote
    FROM public.reply_votes
    WHERE reply_id = p_reply_id AND user_id = auth.uid();

    IF current_vote IS NOT NULL THEN
        -- If same vote, ignore (or could toggle off, but let's just ignore for now)
        IF current_vote = p_vote THEN
            RETURN (SELECT upvotes FROM public.request_replies WHERE id = p_reply_id);
        END IF;

        -- Update existing vote
        UPDATE public.reply_votes
        SET vote = p_vote
        WHERE reply_id = p_reply_id AND user_id = auth.uid();

        -- Update total count (Difference is 2 if flipping 1 -> -1 or -1 -> 1)
        -- Actually easier to just re-count or simple math
        UPDATE public.request_replies
        SET upvotes = upvotes + (p_vote - current_vote)
        WHERE id = p_reply_id
        RETURNING upvotes INTO new_total;
    ELSE
        -- Insert new vote
        INSERT INTO public.reply_votes (reply_id, user_id, vote)
        VALUES (p_reply_id, auth.uid(), p_vote);

        -- Update total count
        UPDATE public.request_replies
        SET upvotes = upvotes + p_vote
        WHERE id = p_reply_id
        RETURNING upvotes INTO new_total;
    END IF;

    RETURN new_total;
END;
$$;


ALTER FUNCTION "public"."handle_reply_vote"("p_reply_id" "uuid", "p_vote" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."heartbeat_app_presence"("p_session_id" "text", "p_path" "text" DEFAULT NULL::"text", "p_user_agent" "text" DEFAULT NULL::"text", "p_heartbeat_seconds" integer DEFAULT 60) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."heartbeat_app_presence"("p_session_id" "text", "p_path" "text", "p_user_agent" "text", "p_heartbeat_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."heartbeat_provider_attempt"("p_attempt_id" "text", "p_progress_seconds" integer DEFAULT NULL::integer, "p_active_increment" integer DEFAULT 15) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."heartbeat_provider_attempt"("p_attempt_id" "text", "p_progress_seconds" integer, "p_active_increment" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."heartbeat_view_session"("p_session_id" "text", "p_tmdb_id" "text", "p_media_type" "text", "p_season" integer DEFAULT NULL::integer, "p_episode" integer DEFAULT NULL::integer, "p_provider_id" "text" DEFAULT NULL::"text", "p_title" "text" DEFAULT NULL::"text", "p_genres" "text"[] DEFAULT NULL::"text"[], "p_heartbeat_seconds" integer DEFAULT 30) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
$$;


ALTER FUNCTION "public"."heartbeat_view_session"("p_session_id" "text", "p_tmdb_id" "text", "p_media_type" "text", "p_season" integer, "p_episode" integer, "p_provider_id" "text", "p_title" "text", "p_genres" "text"[], "p_heartbeat_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_server_vote"("p_tmdb_id" "text", "p_media_type" "text", "p_season" integer, "p_episode" integer, "p_provider_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.server_votes (tmdb_id, media_type, season, episode, provider_id, vote_count)
  VALUES (p_tmdb_id, p_media_type, p_season, p_episode, p_provider_id, 1)
  ON CONFLICT (tmdb_id, media_type, season, episode, provider_id)
  DO UPDATE SET 
    vote_count = server_votes.vote_count + 1,
    last_updated = NOW();
END;
$$;


ALTER FUNCTION "public"."increment_server_vote"("p_tmdb_id" "text", "p_media_type" "text", "p_season" integer, "p_episode" integer, "p_provider_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_current_user_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_current_user_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_playlist_collaborator"("p_playlist_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.playlist_collaborators
    WHERE playlist_id = p_playlist_id
      AND user_id = p_user_id
      AND status = 'accepted'
  );
END;
$$;


ALTER FUNCTION "public"."is_playlist_collaborator"("p_playlist_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_playlist_owner"("p_playlist_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.playlists
    WHERE id = p_playlist_id
      AND user_id = p_user_id
  );
END;
$$;


ALTER FUNCTION "public"."is_playlist_owner"("p_playlist_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."like_playlist"("p_playlist_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  inserted_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO public.playlist_likes (user_id, playlist_id)
  VALUES (auth.uid(), p_playlist_id)
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  IF inserted_count > 0 THEN
    UPDATE public.playlists
    SET likes_count = likes_count + 1
    WHERE id = p_playlist_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."like_playlist"("p_playlist_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_provider_attempt_ready"("p_attempt_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."mark_provider_attempt_ready"("p_attempt_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_followers_of_public_playlist"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  creator_name text;
BEGIN
  IF NEW.is_public IS DISTINCT FROM true OR NEW.type NOT IN ('custom', 'curated') THEN
    RETURN NEW;
  END IF;

  SELECT split_part(username, '@', 1)
  INTO creator_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, message, data)
  SELECT
    follows.follower_id,
    'follower_new_playlist',
    'New Playlist',
    COALESCE(creator_name, 'Someone') || ' created a new playlist "' || COALESCE(NEW.name, 'Untitled') || '"',
    jsonb_build_object(
      'playlist_id', NEW.id,
      'playlist_name', NEW.name,
      'actor_id', NEW.user_id,
      'actor_username', creator_name
    )
  FROM public.follows
  WHERE follows.following_id = NEW.user_id
    AND follows.follower_id <> NEW.user_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_followers_of_public_playlist"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_playlist_invite"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  p_name text;
  inviter_name text;
BEGIN
  SELECT name INTO p_name FROM public.playlists WHERE id = NEW.playlist_id;
  SELECT split_part(username, '@', 1) INTO inviter_name
  FROM public.profiles
  WHERE id = (SELECT user_id FROM public.playlists WHERE id = NEW.playlist_id);

  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    NEW.user_id,
    'playlist_invite',
    'Playlist Invitation',
    COALESCE(inviter_name, 'Someone') || ' invited you to collaborate on "' || COALESCE(p_name, 'Untitled') || '"',
    jsonb_build_object('playlist_id', NEW.playlist_id, 'invite_id', NEW.id)
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_playlist_invite"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_playlist_like"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  playlist_owner_id uuid;
  playlist_name text;
  liker_name text;
BEGIN
  SELECT user_id, name
  INTO playlist_owner_id, playlist_name
  FROM public.playlists
  WHERE id = NEW.playlist_id;

  IF playlist_owner_id IS NULL OR playlist_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT split_part(username, '@', 1)
  INTO liker_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    playlist_owner_id,
    'playlist_liked',
    'Playlist Liked',
    COALESCE(liker_name, 'Someone') || ' liked your playlist "' || COALESCE(playlist_name, 'Untitled') || '"',
    jsonb_build_object(
      'playlist_id', NEW.playlist_id,
      'playlist_name', playlist_name,
      'actor_id', NEW.user_id,
      'actor_username', liker_name
    )
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_playlist_like"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_profile_privilege_escalation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  requester_role text;
  new_profile jsonb := to_jsonb(NEW);
  old_profile jsonb := to_jsonb(OLD);
BEGIN
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
  THEN
    RAISE EXCEPTION 'Sensitive profile fields must be updated through trusted RPCs only';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_profile_privilege_escalation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prune_watch_history"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  user_record RECORD;
  new_history JSONB;
  cutoff_ms BIGINT;
BEGIN
  -- 60 days ago in milliseconds
  cutoff_ms := (EXTRACT(EPOCH FROM NOW()) - (60 * 24 * 60 * 60)) * 1000;

  FOR user_record IN SELECT id, watch_history FROM public.profiles WHERE watch_history IS NOT NULL LOOP
    
    -- Filter items older than 60 days
    SELECT jsonb_object_agg(key, value)
    INTO new_history
    FROM jsonb_each(user_record.watch_history)
    WHERE (value->>'lastUpdated')::bigint >= cutoff_ms;

    -- Update if changed
    IF new_history IS DISTINCT FROM user_record.watch_history THEN
      UPDATE public.profiles
      SET watch_history = COALESCE(new_history, '{}'::jsonb)
      WHERE id = user_record.id;
    END IF;
    
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."prune_watch_history"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_community_stats_cache"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  cached_stats jsonb;
  active_users int;
BEGIN
  -- Calculate community-wide statistics
  WITH community_aggregates AS (
    SELECT 
      ROUND(AVG(COALESCE((stats->>'total_movies')::int, 0) + 
                COALESCE((stats->>'total_shows')::int, 0)), 1) as avg_total,
      ROUND(AVG(COALESCE((stats->>'total_movies')::int, 0)), 1) as avg_movies,
      ROUND(AVG(COALESCE((stats->>'total_shows')::int, 0)), 1) as avg_shows,
      ROUND(AVG(COALESCE((stats->>'max_streak')::int, 0)), 1) as avg_streak,
      ROUND(AVG(COALESCE((stats->>'rewatch_count')::int, 0)), 1) as avg_rewatches,
      COUNT(*) as total_users,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY 
        COALESCE((stats->>'total_movies')::int, 0) + 
        COALESCE((stats->>'total_shows')::int, 0)) as median_total
    FROM public.profiles
    WHERE stats IS NOT NULL 
      AND stats != '{}'::jsonb
      AND (COALESCE((stats->>'total_movies')::int, 0) + 
           COALESCE((stats->>'total_shows')::int, 0)) > 0
  ),
  top_genres AS (
    SELECT 
      genre,
      SUM(count::int) as total_count
    FROM public.profiles,
    LATERAL jsonb_each_text(COALESCE(stats->'genre_counts', '{}'::jsonb)) AS genre_data(genre, count)
    WHERE stats IS NOT NULL
    GROUP BY genre
    ORDER BY total_count DESC
    LIMIT 10
  )
  SELECT 
    jsonb_build_object(
      'avg_total_content', ca.avg_total,
      'avg_movies', ca.avg_movies,
      'avg_shows', ca.avg_shows,
      'avg_streak', ca.avg_streak,
      'avg_rewatch_count', ca.avg_rewatches,
      'median_total', ca.median_total,
      'top_genres', (SELECT jsonb_agg(jsonb_build_object('genre', genre, 'count', total_count)) FROM top_genres)
    ),
    ca.total_users
  INTO cached_stats, active_users
  FROM community_aggregates ca;
  
  -- Update cache
  UPDATE public.community_stats_cache
  SET 
    stats = cached_stats,
    user_count = active_users,
    updated_at = now()
  WHERE id = 1;
  
  RAISE NOTICE 'Community stats cache refreshed for % users', active_users;
END;
$$;


ALTER FUNCTION "public"."refresh_community_stats_cache"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_viewing_stats"("p_existing_stats" "jsonb" DEFAULT NULL::"jsonb", "p_reset_past_years" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."reset_viewing_stats"("p_existing_stats" "jsonb", "p_reset_past_years" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_curator_memories_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
    new.updated_at = now();
    return new;
end;
$$;


ALTER FUNCTION "public"."set_curator_memories_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."start_provider_attempt"("p_attempt_id" "text", "p_session_id" "text", "p_tmdb_id" "text", "p_media_type" "text", "p_season" integer DEFAULT NULL::integer, "p_episode" integer DEFAULT NULL::integer, "p_provider_id" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."start_provider_attempt"("p_attempt_id" "text", "p_session_id" "text", "p_tmdb_id" "text", "p_media_type" "text", "p_season" integer, "p_episode" integer, "p_provider_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_playlist_view"("p_playlist_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_analytics jsonb;
  current_week text;
  current_month text;
  stored_week text;
  stored_month text;
  new_analytics jsonb;
  requester_id uuid := auth.uid();
  last_viewer jsonb;
  last_timestamp bigint := 0;
  six_hours_ago bigint := extract(epoch from (now() - interval '6 hours'))::bigint;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT analytics
  INTO current_analytics
  FROM public.playlists
  WHERE id = p_playlist_id
  FOR UPDATE;

  IF current_analytics IS NULL THEN
    RETURN;
  END IF;

  SELECT viewer
  INTO last_viewer
  FROM jsonb_array_elements(COALESCE(current_analytics->'last_viewers', '[]'::jsonb)) viewer
  WHERE viewer->>'user_id' = requester_id::text
  ORDER BY COALESCE((viewer->>'timestamp')::bigint, 0) DESC
  LIMIT 1;

  IF last_viewer IS NOT NULL THEN
    last_timestamp := COALESCE((last_viewer->>'timestamp')::bigint, 0);
    IF last_timestamp >= six_hours_ago THEN
      RETURN;
    END IF;
  END IF;

  current_week := to_char(now(), 'IYYY-IW');
  current_month := to_char(now(), 'YYYY-MM');
  stored_week := current_analytics->>'week_start';
  stored_month := current_analytics->>'month_start';

  new_analytics := jsonb_build_object(
    'total_views', COALESCE((current_analytics->>'total_views')::int, 0) + 1,
    'weekly_views', CASE WHEN stored_week = current_week THEN COALESCE((current_analytics->>'weekly_views')::int, 0) + 1 ELSE 1 END,
    'monthly_views', CASE WHEN stored_month = current_month THEN COALESCE((current_analytics->>'monthly_views')::int, 0) + 1 ELSE 1 END,
    'week_start', current_week,
    'month_start', current_month,
    'last_viewers', (
      SELECT jsonb_agg(viewer ORDER BY (viewer->>'timestamp')::bigint DESC)
      FROM (
        SELECT viewer
        FROM jsonb_array_elements(COALESCE(current_analytics->'last_viewers', '[]'::jsonb)) viewer
        WHERE viewer->>'user_id' <> requester_id::text
        UNION ALL
        SELECT jsonb_build_object('user_id', requester_id::text, 'timestamp', extract(epoch from now())::bigint)
        LIMIT 10
      ) viewers
    )
  );

  UPDATE public.playlists
  SET analytics = new_analytics
  WHERE id = p_playlist_id;
END;
$$;


ALTER FUNCTION "public"."track_playlist_view"("p_playlist_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unlike_playlist"("p_playlist_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  deleted_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  DELETE FROM public.playlist_likes
  WHERE user_id = auth.uid()
    AND playlist_id = p_playlist_id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF deleted_count > 0 THEN
    UPDATE public.playlists
    SET likes_count = GREATEST(likes_count - 1, 0)
    WHERE id = p_playlist_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."unlike_playlist"("p_playlist_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_watch_history_v2"("p_user_id" "uuid", "p_tmdb_id" "text", "p_data" "jsonb", "p_idempotency_key" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_history JSONB;
  current_entry JSONB;
  existing_key TEXT;
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

  UPDATE public.profiles
  SET
    watch_history = current_history,
    last_seen_activity = now()
  WHERE id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."update_watch_history_v2"("p_user_id" "uuid", "p_tmdb_id" "text", "p_data" "jsonb", "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_friend_compatibility"("p_user_1" "uuid", "p_user_2" "uuid", "p_score" integer, "p_shared_genres" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    u_a UUID;
    u_b UUID;
BEGIN
    -- Ensure consistent ordering to match table constraint
    IF p_user_1 < p_user_2 THEN
        u_a := p_user_1;
        u_b := p_user_2;
    ELSE
        u_a := p_user_2;
        u_b := p_user_1;
    END IF;

    INSERT INTO public.friend_compatibility (user_a, user_b, score, shared_genres, updated_at)
    VALUES (u_a, u_b, p_score, p_shared_genres, NOW())
    ON CONFLICT (user_a, user_b)
    DO UPDATE SET 
        score = EXCLUDED.score,
        shared_genres = EXCLUDED.shared_genres,
        updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."upsert_friend_compatibility"("p_user_1" "uuid", "p_user_2" "uuid", "p_score" integer, "p_shared_genres" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_can_edit_playlist"("p_playlist_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_owner_id uuid;
  v_is_editor boolean;
BEGIN
  SELECT user_id
  INTO v_owner_id
  FROM public.playlists
  WHERE id = p_playlist_id;

  SELECT EXISTS (
    SELECT 1
    FROM public.playlist_collaborators
    WHERE playlist_id = p_playlist_id
      AND user_id = v_user_id
      AND status = 'accepted'
      AND role = 'editor'
  )
  INTO v_is_editor;

  RETURN (
    v_owner_id = v_user_id
    OR public.is_current_user_admin()
    OR v_is_editor
  );
END;
$$;


ALTER FUNCTION "public"."user_can_edit_playlist"("p_playlist_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_can_view_playlist"("p_playlist_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_public boolean;
  v_is_featured boolean;
  v_owner_id uuid;
BEGIN
  SELECT is_public, is_featured, user_id
  INTO v_is_public, v_is_featured, v_owner_id
  FROM public.playlists
  WHERE id = p_playlist_id;

  RETURN (
    v_is_public = true
    OR v_is_featured = true
    OR v_owner_id = v_user_id
    OR public.is_current_user_admin()
    OR public.is_playlist_collaborator(p_playlist_id, v_user_id)
  );
END;
$$;


ALTER FUNCTION "public"."user_can_view_playlist"("p_playlist_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."announcements" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "type" "text" DEFAULT 'info'::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "announcements_type_check" CHECK (("type" = ANY (ARRAY['info'::"text", 'warning'::"text", 'success'::"text"])))
);


ALTER TABLE "public"."announcements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_presence_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "text" NOT NULL,
    "session_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "last_path" "text",
    "user_agent" "text",
    "active_seconds" integer DEFAULT 0 NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_heartbeat_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_presence_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_settings" (
    "key" "text" NOT NULL,
    "value" "text"
);


ALTER TABLE "public"."app_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_stats" (
    "id" integer DEFAULT 1 NOT NULL,
    "trending_daily" "jsonb" DEFAULT '[]'::"jsonb",
    "trending_weekly" "jsonb" DEFAULT '[]'::"jsonb",
    "most_watched_all_time" "jsonb" DEFAULT '[]'::"jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "community_stats_id_check" CHECK (("id" = 1))
);


ALTER TABLE "public"."community_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_stats_cache" (
    "id" integer DEFAULT 1 NOT NULL,
    "stats" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_count" integer DEFAULT 0,
    CONSTRAINT "only_one_row" CHECK (("id" = 1))
);


ALTER TABLE "public"."community_stats_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."curator_memories" (
    "user_id" "uuid" NOT NULL,
    "memory" "jsonb" DEFAULT "jsonb_build_object"('sessions', 0, 'promptHistory', '[]'::"jsonb", 'smashed', '[]'::"jsonb", 'passed', '[]'::"jsonb", 'updatedAt', ("floor"((EXTRACT(epoch FROM "now"()) * (1000)::numeric)))::bigint) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."curator_memories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."featured_movies" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tmdb_id" "text" NOT NULL,
    "media_type" "text" NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."featured_movies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."featured_sections" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "content_type" "text",
    "display_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "items" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "featured_sections_content_type_check" CHECK (("content_type" = ANY (ARRAY['movie'::"text", 'tv'::"text", 'mixed'::"text"])))
);


ALTER TABLE "public"."featured_sections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."follows" (
    "follower_id" "uuid" NOT NULL,
    "following_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."friend_compatibility" (
    "user_a" "uuid" NOT NULL,
    "user_b" "uuid" NOT NULL,
    "score" integer NOT NULL,
    "shared_genres" "jsonb" DEFAULT '[]'::"jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "users_ordered" CHECK (("user_a" < "user_b"))
);


ALTER TABLE "public"."friend_compatibility" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."movie_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tmdb_id" "text" NOT NULL,
    "media_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "poster_path" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "movie_requests_media_type_check" CHECK (("media_type" = ANY (ARRAY['movie'::"text", 'tv'::"text"]))),
    CONSTRAINT "movie_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'fulfilled'::"text"])))
);


ALTER TABLE "public"."movie_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['playlist_invite'::"text", 'system'::"text", 'follow'::"text", 'playlist_liked'::"text", 'follower_new_playlist'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."notifications" IS 'User notifications for invites and system messages';



CREATE TABLE IF NOT EXISTS "public"."player_providers" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "render_mode" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "has_events" boolean DEFAULT false NOT NULL,
    "risk_level" "text" DEFAULT 'medium'::"text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "best_for" "text",
    "movie_embed_template" "text",
    "tv_embed_template" "text",
    "movie_direct_template" "text",
    "tv_direct_template" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "player_providers_render_mode_check" CHECK (("render_mode" = ANY (ARRAY['embed'::"text", 'direct'::"text"]))),
    CONSTRAINT "player_providers_risk_level_check" CHECK (("risk_level" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"])))
);


ALTER TABLE "public"."player_providers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."playlist_collaborators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "playlist_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'editor'::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "playlist_collaborators_role_check" CHECK (("role" = ANY (ARRAY['editor'::"text", 'viewer'::"text"]))),
    CONSTRAINT "playlist_collaborators_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."playlist_collaborators" OWNER TO "postgres";


COMMENT ON TABLE "public"."playlist_collaborators" IS 'Tracks which users can collaborate on playlists';



CREATE TABLE IF NOT EXISTS "public"."playlist_items" (
    "playlist_id" "uuid" NOT NULL,
    "tmdb_id" "text" NOT NULL,
    "media_type" "text" NOT NULL,
    "metadata" "jsonb",
    "added_at" timestamp with time zone DEFAULT "now"(),
    "added_by_user_id" "uuid"
);


ALTER TABLE "public"."playlist_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."playlist_items"."added_by_user_id" IS 'Tracks which user added this item (for collaborative playlists)';



CREATE TABLE IF NOT EXISTS "public"."playlist_likes" (
    "user_id" "uuid" NOT NULL,
    "playlist_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."playlist_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."playlists" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_public" boolean DEFAULT true,
    "type" "text" DEFAULT 'custom'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_featured" boolean DEFAULT false,
    "likes_count" integer DEFAULT 0,
    "analytics" "jsonb" DEFAULT '{"week_start": null, "month_start": null, "total_views": 0, "last_viewers": [], "weekly_views": 0, "monthly_views": 0}'::"jsonb",
    CONSTRAINT "playlists_type_check" CHECK (("type" = ANY (ARRAY['custom'::"text", 'watch_later'::"text", 'favorites'::"text", 'curated'::"text"])))
);


ALTER TABLE "public"."playlists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text",
    "avatar_url" "text",
    "role" "text" DEFAULT 'user'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "watch_history" "jsonb" DEFAULT '{}'::"jsonb",
    "last_seen_announcements" timestamp with time zone DEFAULT "now"(),
    "last_seen_activity" timestamp with time zone DEFAULT "now"(),
    "recent_searches" "jsonb" DEFAULT '[]'::"jsonb",
    "stats" "jsonb" DEFAULT '{"streak_days": 0, "total_shows": 0, "genre_counts": {}, "last_watched": null, "total_movies": 0}'::"jsonb",
    "can_stream" boolean DEFAULT false,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'admin'::"text", 'moderator'::"text"])))
);

ALTER TABLE ONLY "public"."profiles" REPLICA IDENTITY FULL;


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."can_stream" IS 'Permission flag: if false, user cannot access streaming features (Play buttons, Continue Watching, Requests, Player)';



CREATE TABLE IF NOT EXISTS "public"."provider_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "attempt_id" "text" NOT NULL,
    "session_id" "text",
    "tmdb_id" "text" NOT NULL,
    "media_type" "text" NOT NULL,
    "season" integer,
    "episode" integer,
    "provider_id" "text" NOT NULL,
    "active_seconds" integer DEFAULT 0 NOT NULL,
    "progress_seconds" integer DEFAULT 0 NOT NULL,
    "is_ready" boolean DEFAULT false NOT NULL,
    "ready_at" timestamp with time zone,
    "is_success" boolean DEFAULT false NOT NULL,
    "ended_reason" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_heartbeat_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "provider_attempts_media_type_check" CHECK (("media_type" = ANY (ARRAY['movie'::"text", 'tv'::"text"])))
);


ALTER TABLE "public"."provider_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reply_votes" (
    "reply_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "vote" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reply_votes_vote_check" CHECK (("vote" = ANY (ARRAY[1, '-1'::integer])))
);


ALTER TABLE "public"."reply_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."request_replies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid",
    "tmdb_id" "text" NOT NULL,
    "content" "text" NOT NULL,
    "link_type" "text" DEFAULT 'other'::"text",
    "instructions" "text",
    "upvotes" integer DEFAULT 0,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."request_replies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."server_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tmdb_id" "text" NOT NULL,
    "media_type" "text" NOT NULL,
    "season" integer DEFAULT 1,
    "episode" integer DEFAULT 1,
    "provider_id" "text" NOT NULL,
    "vote_count" integer DEFAULT 0,
    "last_updated" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "server_votes_media_type_check" CHECK (("media_type" = ANY (ARRAY['movie'::"text", 'tv'::"text"])))
);


ALTER TABLE "public"."server_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."upcoming_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "poster_url" "text",
    "starts_at" timestamp with time zone NOT NULL,
    "tmdb_id" "text",
    "media_type" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."upcoming_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."view_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "text" NOT NULL,
    "tmdb_id" "text" NOT NULL,
    "media_type" "text" NOT NULL,
    "season" integer,
    "episode" integer,
    "provider_id" "text",
    "title" "text",
    "genres" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "active_seconds" integer DEFAULT 0 NOT NULL,
    "is_qualified" boolean DEFAULT false NOT NULL,
    "qualified_at" timestamp with time zone,
    "session_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_heartbeat_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "view_sessions_media_type_check" CHECK (("media_type" = ANY (ARRAY['movie'::"text", 'tv'::"text"])))
);


ALTER TABLE "public"."view_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."watch_history" (
    "user_id" "uuid" NOT NULL,
    "tmdb_id" "text" NOT NULL,
    "media_type" "text" NOT NULL,
    "progress" double precision DEFAULT 0,
    "duration" integer DEFAULT 0,
    "metadata" "jsonb",
    "last_watched" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."watch_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."watch_history" IS 'LEGACY / DEPRECATED. The app now stores history in profiles.watch_history and session-based tracking in public.view_sessions. This table is retained only for archival compatibility.';



CREATE TABLE IF NOT EXISTS "public"."watch_parties" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "host_id" "uuid" NOT NULL,
    "tmdb_id" "text" NOT NULL,
    "media_type" "text" NOT NULL,
    "season" integer,
    "episode" integer,
    "current_server" "text" DEFAULT 'cinemaos'::"text",
    "invite_code" "text" DEFAULT "public"."generate_invite_code"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '04:00:00'::interval),
    "max_participants" integer DEFAULT 4,
    CONSTRAINT "watch_parties_media_type_check" CHECK (("media_type" = ANY (ARRAY['movie'::"text", 'tv'::"text"])))
);


ALTER TABLE "public"."watch_parties" OWNER TO "postgres";


COMMENT ON TABLE "public"."watch_parties" IS 'LEGACY / DISABLED. Watch-together now relies on the browser extension flow, not database-backed party records.';



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_presence_sessions"
    ADD CONSTRAINT "app_presence_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_presence_sessions"
    ADD CONSTRAINT "app_presence_sessions_user_id_session_id_key" UNIQUE ("user_id", "session_id");



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."community_stats_cache"
    ADD CONSTRAINT "community_stats_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_stats"
    ADD CONSTRAINT "community_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."curator_memories"
    ADD CONSTRAINT "curator_memories_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."featured_movies"
    ADD CONSTRAINT "featured_movies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."featured_sections"
    ADD CONSTRAINT "featured_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_id", "following_id");



ALTER TABLE ONLY "public"."friend_compatibility"
    ADD CONSTRAINT "friend_compatibility_pkey" PRIMARY KEY ("user_a", "user_b");



ALTER TABLE ONLY "public"."movie_requests"
    ADD CONSTRAINT "movie_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."movie_requests"
    ADD CONSTRAINT "movie_requests_tmdb_media_unique" UNIQUE ("tmdb_id", "media_type");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_providers"
    ADD CONSTRAINT "player_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."playlist_collaborators"
    ADD CONSTRAINT "playlist_collaborators_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."playlist_collaborators"
    ADD CONSTRAINT "playlist_collaborators_playlist_id_user_id_key" UNIQUE ("playlist_id", "user_id");



ALTER TABLE ONLY "public"."playlist_items"
    ADD CONSTRAINT "playlist_items_pkey" PRIMARY KEY ("playlist_id", "tmdb_id");



ALTER TABLE ONLY "public"."playlist_likes"
    ADD CONSTRAINT "playlist_likes_pkey" PRIMARY KEY ("user_id", "playlist_id");



ALTER TABLE ONLY "public"."playlists"
    ADD CONSTRAINT "playlists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."provider_attempts"
    ADD CONSTRAINT "provider_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_attempts"
    ADD CONSTRAINT "provider_attempts_user_id_attempt_id_key" UNIQUE ("user_id", "attempt_id");



ALTER TABLE ONLY "public"."reply_votes"
    ADD CONSTRAINT "reply_votes_pkey" PRIMARY KEY ("reply_id", "user_id");



ALTER TABLE ONLY "public"."request_replies"
    ADD CONSTRAINT "request_replies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."server_votes"
    ADD CONSTRAINT "server_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."server_votes"
    ADD CONSTRAINT "server_votes_tmdb_id_media_type_season_episode_provider_id_key" UNIQUE ("tmdb_id", "media_type", "season", "episode", "provider_id");



ALTER TABLE ONLY "public"."upcoming_events"
    ADD CONSTRAINT "upcoming_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."view_sessions"
    ADD CONSTRAINT "view_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."view_sessions"
    ADD CONSTRAINT "view_sessions_user_id_session_id_key" UNIQUE ("user_id", "session_id");



ALTER TABLE ONLY "public"."watch_history"
    ADD CONSTRAINT "watch_history_pkey" PRIMARY KEY ("user_id", "tmdb_id");



ALTER TABLE ONLY "public"."watch_parties"
    ADD CONSTRAINT "watch_parties_invite_code_key" UNIQUE ("invite_code");



ALTER TABLE ONLY "public"."watch_parties"
    ADD CONSTRAINT "watch_parties_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_app_presence_sessions_last_heartbeat" ON "public"."app_presence_sessions" USING "btree" ("last_heartbeat_at" DESC);



CREATE INDEX "idx_app_presence_sessions_user_date" ON "public"."app_presence_sessions" USING "btree" ("user_id", "session_date" DESC);



CREATE INDEX "idx_collaborators_playlist" ON "public"."playlist_collaborators" USING "btree" ("playlist_id");



CREATE INDEX "idx_collaborators_user" ON "public"."playlist_collaborators" USING "btree" ("user_id");



CREATE INDEX "idx_movie_requests_status" ON "public"."movie_requests" USING "btree" ("status");



CREATE INDEX "idx_movie_requests_tmdb" ON "public"."movie_requests" USING "btree" ("tmdb_id");



CREATE INDEX "idx_notifications_user" ON "public"."notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_player_providers_sort_order" ON "public"."player_providers" USING "btree" ("sort_order", "created_at");



CREATE INDEX "idx_playlist_collaborators_lookup" ON "public"."playlist_collaborators" USING "btree" ("playlist_id", "user_id", "status");



CREATE INDEX "idx_playlist_items_added_at" ON "public"."playlist_items" USING "btree" ("playlist_id", "added_at" DESC);



CREATE INDEX "idx_playlist_items_added_by" ON "public"."playlist_items" USING "btree" ("added_by_user_id");



CREATE INDEX "idx_playlist_items_playlist_id" ON "public"."playlist_items" USING "btree" ("playlist_id");



CREATE INDEX "idx_playlist_likes_user_playlist" ON "public"."playlist_likes" USING "btree" ("user_id", "playlist_id");



CREATE INDEX "idx_playlists_featured" ON "public"."playlists" USING "btree" ("is_featured", "is_public") WHERE ("is_featured" = true);



CREATE INDEX "idx_playlists_likes_count" ON "public"."playlists" USING "btree" ("likes_count" DESC);



CREATE INDEX "idx_playlists_monthly_views" ON "public"."playlists" USING "btree" ((("analytics" -> 'monthly_views'::"text")));



CREATE INDEX "idx_playlists_public" ON "public"."playlists" USING "btree" ("is_public") WHERE ("is_public" = true);



CREATE INDEX "idx_playlists_user_id" ON "public"."playlists" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_playlists_weekly_views" ON "public"."playlists" USING "btree" ((("analytics" -> 'weekly_views'::"text")));



CREATE INDEX "idx_profiles_stats_gin" ON "public"."profiles" USING "gin" ("stats");



CREATE INDEX "idx_profiles_stats_not_null" ON "public"."profiles" USING "btree" ("id") WHERE (("stats" IS NOT NULL) AND ("stats" <> '{}'::"jsonb"));



CREATE INDEX "idx_provider_attempts_lookup" ON "public"."provider_attempts" USING "btree" ("tmdb_id", "media_type", "season", "episode", "provider_id", "started_at" DESC);



CREATE INDEX "idx_provider_attempts_provider_recent" ON "public"."provider_attempts" USING "btree" ("provider_id", "started_at" DESC);



CREATE INDEX "idx_replies_request" ON "public"."request_replies" USING "btree" ("request_id");



CREATE INDEX "idx_replies_tmdb" ON "public"."request_replies" USING "btree" ("tmdb_id");



CREATE INDEX "idx_server_votes_lookup" ON "public"."server_votes" USING "btree" ("tmdb_id", "media_type", "season", "episode");



CREATE INDEX "idx_view_sessions_user_content" ON "public"."view_sessions" USING "btree" ("user_id", "media_type", "tmdb_id", "season", "episode");



CREATE INDEX "idx_view_sessions_user_date" ON "public"."view_sessions" USING "btree" ("user_id", "session_date" DESC);



CREATE OR REPLACE TRIGGER "curator_memories_set_updated_at" BEFORE UPDATE ON "public"."curator_memories" FOR EACH ROW EXECUTE FUNCTION "public"."set_curator_memories_updated_at"();



CREATE OR REPLACE TRIGGER "on_playlist_invite" AFTER INSERT ON "public"."playlist_collaborators" FOR EACH ROW WHEN (("new"."status" = 'pending'::"text")) EXECUTE FUNCTION "public"."notify_playlist_invite"();



CREATE OR REPLACE TRIGGER "on_playlist_like_notification" AFTER INSERT ON "public"."playlist_likes" FOR EACH ROW EXECUTE FUNCTION "public"."notify_playlist_like"();



CREATE OR REPLACE TRIGGER "on_public_playlist_created_notification" AFTER INSERT ON "public"."playlists" FOR EACH ROW EXECUTE FUNCTION "public"."notify_followers_of_public_playlist"();



CREATE OR REPLACE TRIGGER "on_reply_added" AFTER INSERT ON "public"."request_replies" FOR EACH ROW EXECUTE FUNCTION "public"."auto_fulfill_request"();



CREATE OR REPLACE TRIGGER "prevent_profile_privilege_escalation" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_profile_privilege_escalation"();



ALTER TABLE ONLY "public"."app_presence_sessions"
    ADD CONSTRAINT "app_presence_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."curator_memories"
    ADD CONSTRAINT "curator_memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friend_compatibility"
    ADD CONSTRAINT "friend_compatibility_user_a_fkey" FOREIGN KEY ("user_a") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friend_compatibility"
    ADD CONSTRAINT "friend_compatibility_user_b_fkey" FOREIGN KEY ("user_b") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."movie_requests"
    ADD CONSTRAINT "movie_requests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."playlist_collaborators"
    ADD CONSTRAINT "playlist_collaborators_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."playlist_collaborators"
    ADD CONSTRAINT "playlist_collaborators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."playlist_items"
    ADD CONSTRAINT "playlist_items_added_by_user_id_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."playlist_items"
    ADD CONSTRAINT "playlist_items_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."playlist_likes"
    ADD CONSTRAINT "playlist_likes_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."playlist_likes"
    ADD CONSTRAINT "playlist_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."playlists"
    ADD CONSTRAINT "playlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."provider_attempts"
    ADD CONSTRAINT "provider_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reply_votes"
    ADD CONSTRAINT "reply_votes_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "public"."request_replies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reply_votes"
    ADD CONSTRAINT "reply_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."request_replies"
    ADD CONSTRAINT "request_replies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."request_replies"
    ADD CONSTRAINT "request_replies_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."movie_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."view_sessions"
    ADD CONSTRAINT "view_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."watch_history"
    ADD CONSTRAINT "watch_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."watch_parties"
    ADD CONSTRAINT "watch_parties_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can delete replies" ON "public"."request_replies" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can delete requests" ON "public"."movie_requests" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can manage providers" ON "public"."player_providers" USING ("public"."is_current_user_admin"()) WITH CHECK ("public"."is_current_user_admin"());



CREATE POLICY "Admins can update requests" ON "public"."movie_requests" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Anyone can view server votes" ON "public"."server_votes" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can read enabled providers" ON "public"."player_providers" FOR SELECT USING (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND (("enabled" = true) OR "public"."is_current_user_admin"())));



CREATE POLICY "Authenticated users can vote" ON "public"."server_votes" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "Follows viewable by everyone" ON "public"."follows" FOR SELECT USING (true);



CREATE POLICY "Public community stats" ON "public"."community_stats" FOR SELECT USING (true);



CREATE POLICY "Replies are viewable by everyone" ON "public"."request_replies" FOR SELECT USING (true);



CREATE POLICY "Requests are viewable by everyone" ON "public"."movie_requests" FOR SELECT USING (true);



CREATE POLICY "Users can add replies" ON "public"."request_replies" FOR INSERT WITH CHECK (("created_by" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can change their vote" ON "public"."reply_votes" FOR UPDATE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can create requests" ON "public"."movie_requests" FOR INSERT WITH CHECK (("created_by" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can follow others" ON "public"."follows" FOR INSERT WITH CHECK (("follower_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can insert their own profile." ON "public"."profiles" FOR INSERT WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can unfollow" ON "public"."follows" FOR DELETE USING (("follower_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view their own presence sessions" ON "public"."app_presence_sessions" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own provider attempts" ON "public"."provider_attempts" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own sessions" ON "public"."view_sessions" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can vote" ON "public"."reply_votes" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Votes are viewable by everyone" ON "public"."reply_votes" FOR SELECT USING (true);



ALTER TABLE "public"."announcements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "announcements_admin_delete" ON "public"."announcements" FOR DELETE USING ("public"."is_current_user_admin"());



CREATE POLICY "announcements_admin_insert" ON "public"."announcements" FOR INSERT WITH CHECK ("public"."is_current_user_admin"());



CREATE POLICY "announcements_admin_update" ON "public"."announcements" FOR UPDATE USING ("public"."is_current_user_admin"()) WITH CHECK ("public"."is_current_user_admin"());



CREATE POLICY "announcements_select_public" ON "public"."announcements" FOR SELECT USING (true);



ALTER TABLE "public"."app_presence_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "app_settings_admin_delete" ON "public"."app_settings" FOR DELETE USING ("public"."is_current_user_admin"());



CREATE POLICY "app_settings_admin_insert" ON "public"."app_settings" FOR INSERT WITH CHECK ("public"."is_current_user_admin"());



CREATE POLICY "app_settings_admin_update" ON "public"."app_settings" FOR UPDATE USING ("public"."is_current_user_admin"()) WITH CHECK ("public"."is_current_user_admin"());



CREATE POLICY "app_settings_select_public" ON "public"."app_settings" FOR SELECT USING (true);



CREATE POLICY "collaborators_delete" ON "public"."playlist_collaborators" FOR DELETE USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_playlist_owner"("playlist_id", ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_current_user_admin"()));



CREATE POLICY "collaborators_insert" ON "public"."playlist_collaborators" FOR INSERT WITH CHECK (("public"."is_playlist_owner"("playlist_id", ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_current_user_admin"()));



CREATE POLICY "collaborators_select" ON "public"."playlist_collaborators" FOR SELECT USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_playlist_owner"("playlist_id", ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_playlist_collaborator"("playlist_id", ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_current_user_admin"()));



CREATE POLICY "collaborators_update" ON "public"."playlist_collaborators" FOR UPDATE USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_playlist_owner"("playlist_id", ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_current_user_admin"())) WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_playlist_owner"("playlist_id", ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_current_user_admin"()));



ALTER TABLE "public"."community_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."community_stats_cache" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "community_stats_cache_select_public" ON "public"."community_stats_cache" FOR SELECT USING (true);



ALTER TABLE "public"."curator_memories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "curator_memories_delete_own" ON "public"."curator_memories" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "curator_memories_insert_own" ON "public"."curator_memories" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "curator_memories_select_own" ON "public"."curator_memories" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "curator_memories_update_own" ON "public"."curator_memories" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."featured_movies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "featured_movies_admin_delete" ON "public"."featured_movies" FOR DELETE USING ("public"."is_current_user_admin"());



CREATE POLICY "featured_movies_admin_insert" ON "public"."featured_movies" FOR INSERT WITH CHECK ("public"."is_current_user_admin"());



CREATE POLICY "featured_movies_admin_update" ON "public"."featured_movies" FOR UPDATE USING ("public"."is_current_user_admin"()) WITH CHECK ("public"."is_current_user_admin"());



CREATE POLICY "featured_movies_select_public" ON "public"."featured_movies" FOR SELECT USING (true);



ALTER TABLE "public"."featured_sections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "featured_sections_admin_delete" ON "public"."featured_sections" FOR DELETE USING ("public"."is_current_user_admin"());



CREATE POLICY "featured_sections_admin_insert" ON "public"."featured_sections" FOR INSERT WITH CHECK ("public"."is_current_user_admin"());



CREATE POLICY "featured_sections_admin_update" ON "public"."featured_sections" FOR UPDATE USING ("public"."is_current_user_admin"()) WITH CHECK ("public"."is_current_user_admin"());



CREATE POLICY "featured_sections_select_public" ON "public"."featured_sections" FOR SELECT USING ((("is_active" = true) OR "public"."is_current_user_admin"()));



ALTER TABLE "public"."follows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."friend_compatibility" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "friend_compatibility_delete_own" ON "public"."friend_compatibility" FOR DELETE USING ((("user_a" = ( SELECT "auth"."uid"() AS "uid")) OR ("user_b" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "friend_compatibility_insert_own" ON "public"."friend_compatibility" FOR INSERT WITH CHECK ((("user_a" = ( SELECT "auth"."uid"() AS "uid")) OR ("user_b" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "friend_compatibility_select_own" ON "public"."friend_compatibility" FOR SELECT USING ((("user_a" = ( SELECT "auth"."uid"() AS "uid")) OR ("user_b" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "friend_compatibility_update_own" ON "public"."friend_compatibility" FOR UPDATE USING ((("user_a" = ( SELECT "auth"."uid"() AS "uid")) OR ("user_b" = ( SELECT "auth"."uid"() AS "uid")))) WITH CHECK ((("user_a" = ( SELECT "auth"."uid"() AS "uid")) OR ("user_b" = ( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."movie_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_insert" ON "public"."notifications" FOR INSERT WITH CHECK (false);



CREATE POLICY "notifications_select" ON "public"."notifications" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "notifications_update" ON "public"."notifications" FOR UPDATE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."player_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."playlist_collaborators" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."playlist_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "playlist_items_delete" ON "public"."playlist_items" FOR DELETE USING ("public"."user_can_edit_playlist"("playlist_id"));



CREATE POLICY "playlist_items_insert" ON "public"."playlist_items" FOR INSERT WITH CHECK ("public"."user_can_edit_playlist"("playlist_id"));



CREATE POLICY "playlist_items_select_optimized" ON "public"."playlist_items" FOR SELECT USING ("public"."user_can_view_playlist"("playlist_id"));



ALTER TABLE "public"."playlist_likes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "playlist_likes_delete_own" ON "public"."playlist_likes" FOR DELETE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "playlist_likes_insert_own" ON "public"."playlist_likes" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "playlist_likes_select_public" ON "public"."playlist_likes" FOR SELECT USING (true);



ALTER TABLE "public"."playlists" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "playlists_delete" ON "public"."playlists" FOR DELETE USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_current_user_admin"()));



CREATE POLICY "playlists_insert" ON "public"."playlists" FOR INSERT WITH CHECK (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "playlists_select" ON "public"."playlists" FOR SELECT USING ("public"."user_can_view_playlist"("id"));



CREATE POLICY "playlists_update" ON "public"."playlists" FOR UPDATE USING ("public"."user_can_edit_playlist"("id")) WITH CHECK ("public"."user_can_edit_playlist"("id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_public_safe" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "profiles_update_own_or_admin" ON "public"."profiles" FOR UPDATE USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_current_user_admin"())) WITH CHECK ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_current_user_admin"()));



ALTER TABLE "public"."provider_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reply_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."request_replies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."server_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."upcoming_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "upcoming_events_admin_delete" ON "public"."upcoming_events" FOR DELETE USING ("public"."is_current_user_admin"());



CREATE POLICY "upcoming_events_admin_insert" ON "public"."upcoming_events" FOR INSERT WITH CHECK ("public"."is_current_user_admin"());



CREATE POLICY "upcoming_events_admin_update" ON "public"."upcoming_events" FOR UPDATE USING ("public"."is_current_user_admin"()) WITH CHECK ("public"."is_current_user_admin"());



CREATE POLICY "upcoming_events_select_public" ON "public"."upcoming_events" FOR SELECT USING ((("is_active" = true) OR "public"."is_current_user_admin"()));



ALTER TABLE "public"."view_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."watch_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."watch_parties" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "watch_parties_disabled_delete" ON "public"."watch_parties" FOR DELETE USING (false);



CREATE POLICY "watch_parties_disabled_insert" ON "public"."watch_parties" FOR INSERT WITH CHECK (false);



CREATE POLICY "watch_parties_disabled_select" ON "public"."watch_parties" FOR SELECT USING (false);



CREATE POLICY "watch_parties_disabled_update" ON "public"."watch_parties" FOR UPDATE USING (false) WITH CHECK (false);



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_delete_user"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_delete_user"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_delete_user"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_get_all_profiles"("p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_get_all_profiles"("p_limit" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."admin_get_all_profiles"("p_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_get_platform_presence"("p_limit" integer, "p_search" "text", "p_online_only" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_get_platform_presence"("p_limit" integer, "p_search" "text", "p_online_only" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_get_platform_presence"("p_limit" integer, "p_search" "text", "p_online_only" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_platform_presence"("p_limit" integer, "p_search" "text", "p_online_only" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_get_provider_analytics"("p_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_get_provider_analytics"("p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_get_provider_analytics"("p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_provider_analytics"("p_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_get_recent_view_sessions"("p_limit" integer, "p_user_id" "uuid", "p_only_unqualified" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_get_recent_view_sessions"("p_limit" integer, "p_user_id" "uuid", "p_only_unqualified" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_get_recent_view_sessions"("p_limit" integer, "p_user_id" "uuid", "p_only_unqualified" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_recent_view_sessions"("p_limit" integer, "p_user_id" "uuid", "p_only_unqualified" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_update_user_role"("p_user_id" "uuid", "p_new_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_update_user_role"("p_user_id" "uuid", "p_new_role" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."admin_update_user_role"("p_user_id" "uuid", "p_new_role" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_update_user_streaming_permission"("p_user_id" "uuid", "p_can_stream" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_update_user_streaming_permission"("p_user_id" "uuid", "p_can_stream" boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."admin_update_user_streaming_permission"("p_user_id" "uuid", "p_can_stream" boolean) TO "authenticated";



GRANT ALL ON FUNCTION "public"."auto_fulfill_request"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_fulfill_request"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_fulfill_request"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_taste_compatibility"("user_a" "uuid", "user_b" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_taste_compatibility"("user_a" "uuid", "user_b" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_taste_compatibility"("user_a" "uuid", "user_b" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_registration_enabled"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_registration_enabled"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_registration_enabled"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_parties"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_parties"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_parties"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."clear_my_watch_history"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."clear_my_watch_history"() TO "service_role";
GRANT ALL ON FUNCTION "public"."clear_my_watch_history"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."end_app_presence_session"("p_session_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."end_app_presence_session"("p_session_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."end_app_presence_session"("p_session_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."end_app_presence_session"("p_session_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."finish_provider_attempt"("p_attempt_id" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finish_provider_attempt"("p_attempt_id" "text", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."finish_provider_attempt"("p_attempt_id" "text", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."finish_provider_attempt"("p_attempt_id" "text", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_invite_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invite_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invite_code"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_best_provider_for_content"("p_tmdb_id" "text", "p_media_type" "text", "p_season" integer, "p_episode" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_best_provider_for_content"("p_tmdb_id" "text", "p_media_type" "text", "p_season" integer, "p_episode" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_best_provider_for_content"("p_tmdb_id" "text", "p_media_type" "text", "p_season" integer, "p_episode" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_best_provider_for_content"("p_tmdb_id" "text", "p_media_type" "text", "p_season" integer, "p_episode" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_community_stats"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_community_stats"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_community_stats"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_playlist_collaboration_stats"("p_playlist_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_playlist_collaboration_stats"("p_playlist_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_playlist_collaboration_stats"("p_playlist_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_private_profile"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_private_profile"("p_user_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_private_profile"("p_user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_private_watch_history"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_private_watch_history"("p_user_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_private_watch_history"("p_user_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_reply_vote"("p_reply_id" "uuid", "p_vote" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."handle_reply_vote"("p_reply_id" "uuid", "p_vote" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_reply_vote"("p_reply_id" "uuid", "p_vote" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."heartbeat_app_presence"("p_session_id" "text", "p_path" "text", "p_user_agent" "text", "p_heartbeat_seconds" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."heartbeat_app_presence"("p_session_id" "text", "p_path" "text", "p_user_agent" "text", "p_heartbeat_seconds" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."heartbeat_app_presence"("p_session_id" "text", "p_path" "text", "p_user_agent" "text", "p_heartbeat_seconds" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."heartbeat_app_presence"("p_session_id" "text", "p_path" "text", "p_user_agent" "text", "p_heartbeat_seconds" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."heartbeat_provider_attempt"("p_attempt_id" "text", "p_progress_seconds" integer, "p_active_increment" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."heartbeat_provider_attempt"("p_attempt_id" "text", "p_progress_seconds" integer, "p_active_increment" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."heartbeat_provider_attempt"("p_attempt_id" "text", "p_progress_seconds" integer, "p_active_increment" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."heartbeat_provider_attempt"("p_attempt_id" "text", "p_progress_seconds" integer, "p_active_increment" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."heartbeat_view_session"("p_session_id" "text", "p_tmdb_id" "text", "p_media_type" "text", "p_season" integer, "p_episode" integer, "p_provider_id" "text", "p_title" "text", "p_genres" "text"[], "p_heartbeat_seconds" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."heartbeat_view_session"("p_session_id" "text", "p_tmdb_id" "text", "p_media_type" "text", "p_season" integer, "p_episode" integer, "p_provider_id" "text", "p_title" "text", "p_genres" "text"[], "p_heartbeat_seconds" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."heartbeat_view_session"("p_session_id" "text", "p_tmdb_id" "text", "p_media_type" "text", "p_season" integer, "p_episode" integer, "p_provider_id" "text", "p_title" "text", "p_genres" "text"[], "p_heartbeat_seconds" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_server_vote"("p_tmdb_id" "text", "p_media_type" "text", "p_season" integer, "p_episode" integer, "p_provider_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_server_vote"("p_tmdb_id" "text", "p_media_type" "text", "p_season" integer, "p_episode" integer, "p_provider_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_server_vote"("p_tmdb_id" "text", "p_media_type" "text", "p_season" integer, "p_episode" integer, "p_provider_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_current_user_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_playlist_collaborator"("p_playlist_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_playlist_collaborator"("p_playlist_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_playlist_collaborator"("p_playlist_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_playlist_owner"("p_playlist_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_playlist_owner"("p_playlist_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_playlist_owner"("p_playlist_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."like_playlist"("p_playlist_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."like_playlist"("p_playlist_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."like_playlist"("p_playlist_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."mark_provider_attempt_ready"("p_attempt_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_provider_attempt_ready"("p_attempt_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_provider_attempt_ready"("p_attempt_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_provider_attempt_ready"("p_attempt_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_followers_of_public_playlist"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_followers_of_public_playlist"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_followers_of_public_playlist"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_playlist_invite"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_playlist_invite"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_playlist_invite"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_playlist_like"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_playlist_like"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_playlist_like"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_profile_privilege_escalation"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_profile_privilege_escalation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_profile_privilege_escalation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prune_watch_history"() TO "anon";
GRANT ALL ON FUNCTION "public"."prune_watch_history"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prune_watch_history"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_community_stats_cache"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_community_stats_cache"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_community_stats_cache"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_viewing_stats"("p_existing_stats" "jsonb", "p_reset_past_years" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."reset_viewing_stats"("p_existing_stats" "jsonb", "p_reset_past_years" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_viewing_stats"("p_existing_stats" "jsonb", "p_reset_past_years" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_curator_memories_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_curator_memories_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_curator_memories_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."start_provider_attempt"("p_attempt_id" "text", "p_session_id" "text", "p_tmdb_id" "text", "p_media_type" "text", "p_season" integer, "p_episode" integer, "p_provider_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."start_provider_attempt"("p_attempt_id" "text", "p_session_id" "text", "p_tmdb_id" "text", "p_media_type" "text", "p_season" integer, "p_episode" integer, "p_provider_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."start_provider_attempt"("p_attempt_id" "text", "p_session_id" "text", "p_tmdb_id" "text", "p_media_type" "text", "p_season" integer, "p_episode" integer, "p_provider_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_provider_attempt"("p_attempt_id" "text", "p_session_id" "text", "p_tmdb_id" "text", "p_media_type" "text", "p_season" integer, "p_episode" integer, "p_provider_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."track_playlist_view"("p_playlist_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."track_playlist_view"("p_playlist_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."track_playlist_view"("p_playlist_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."unlike_playlist"("p_playlist_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."unlike_playlist"("p_playlist_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."unlike_playlist"("p_playlist_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."update_watch_history_v2"("p_user_id" "uuid", "p_tmdb_id" "text", "p_data" "jsonb", "p_idempotency_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_watch_history_v2"("p_user_id" "uuid", "p_tmdb_id" "text", "p_data" "jsonb", "p_idempotency_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_watch_history_v2"("p_user_id" "uuid", "p_tmdb_id" "text", "p_data" "jsonb", "p_idempotency_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_friend_compatibility"("p_user_1" "uuid", "p_user_2" "uuid", "p_score" integer, "p_shared_genres" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_friend_compatibility"("p_user_1" "uuid", "p_user_2" "uuid", "p_score" integer, "p_shared_genres" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_friend_compatibility"("p_user_1" "uuid", "p_user_2" "uuid", "p_score" integer, "p_shared_genres" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_can_edit_playlist"("p_playlist_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_can_edit_playlist"("p_playlist_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_edit_playlist"("p_playlist_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_can_view_playlist"("p_playlist_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_can_view_playlist"("p_playlist_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_view_playlist"("p_playlist_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."announcements" TO "anon";
GRANT ALL ON TABLE "public"."announcements" TO "authenticated";
GRANT ALL ON TABLE "public"."announcements" TO "service_role";



GRANT ALL ON TABLE "public"."app_presence_sessions" TO "anon";
GRANT ALL ON TABLE "public"."app_presence_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."app_presence_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."app_settings" TO "anon";
GRANT ALL ON TABLE "public"."app_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."app_settings" TO "service_role";



GRANT ALL ON TABLE "public"."community_stats" TO "anon";
GRANT ALL ON TABLE "public"."community_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."community_stats" TO "service_role";



GRANT ALL ON TABLE "public"."community_stats_cache" TO "anon";
GRANT ALL ON TABLE "public"."community_stats_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."community_stats_cache" TO "service_role";



GRANT ALL ON TABLE "public"."curator_memories" TO "anon";
GRANT ALL ON TABLE "public"."curator_memories" TO "authenticated";
GRANT ALL ON TABLE "public"."curator_memories" TO "service_role";



GRANT ALL ON TABLE "public"."featured_movies" TO "anon";
GRANT ALL ON TABLE "public"."featured_movies" TO "authenticated";
GRANT ALL ON TABLE "public"."featured_movies" TO "service_role";



GRANT ALL ON TABLE "public"."featured_sections" TO "anon";
GRANT ALL ON TABLE "public"."featured_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."featured_sections" TO "service_role";



GRANT ALL ON TABLE "public"."follows" TO "anon";
GRANT ALL ON TABLE "public"."follows" TO "authenticated";
GRANT ALL ON TABLE "public"."follows" TO "service_role";



GRANT ALL ON TABLE "public"."friend_compatibility" TO "anon";
GRANT ALL ON TABLE "public"."friend_compatibility" TO "authenticated";
GRANT ALL ON TABLE "public"."friend_compatibility" TO "service_role";



GRANT ALL ON TABLE "public"."movie_requests" TO "anon";
GRANT ALL ON TABLE "public"."movie_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."movie_requests" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."player_providers" TO "anon";
GRANT ALL ON TABLE "public"."player_providers" TO "authenticated";
GRANT ALL ON TABLE "public"."player_providers" TO "service_role";



GRANT ALL ON TABLE "public"."playlist_collaborators" TO "anon";
GRANT ALL ON TABLE "public"."playlist_collaborators" TO "authenticated";
GRANT ALL ON TABLE "public"."playlist_collaborators" TO "service_role";



GRANT ALL ON TABLE "public"."playlist_items" TO "anon";
GRANT ALL ON TABLE "public"."playlist_items" TO "authenticated";
GRANT ALL ON TABLE "public"."playlist_items" TO "service_role";



GRANT ALL ON TABLE "public"."playlist_likes" TO "anon";
GRANT ALL ON TABLE "public"."playlist_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."playlist_likes" TO "service_role";



GRANT ALL ON TABLE "public"."playlists" TO "anon";
GRANT ALL ON TABLE "public"."playlists" TO "authenticated";
GRANT ALL ON TABLE "public"."playlists" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "anon";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("id") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("username"),UPDATE("username") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("username") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("avatar_url"),UPDATE("avatar_url") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("avatar_url") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("created_at") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("created_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("last_seen_announcements") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("last_seen_activity") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("recent_searches") ON TABLE "public"."profiles" TO "authenticated";



GRANT ALL ON TABLE "public"."provider_attempts" TO "anon";
GRANT ALL ON TABLE "public"."provider_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."reply_votes" TO "anon";
GRANT ALL ON TABLE "public"."reply_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."reply_votes" TO "service_role";



GRANT ALL ON TABLE "public"."request_replies" TO "anon";
GRANT ALL ON TABLE "public"."request_replies" TO "authenticated";
GRANT ALL ON TABLE "public"."request_replies" TO "service_role";



GRANT ALL ON TABLE "public"."server_votes" TO "anon";
GRANT ALL ON TABLE "public"."server_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."server_votes" TO "service_role";



GRANT ALL ON TABLE "public"."upcoming_events" TO "anon";
GRANT ALL ON TABLE "public"."upcoming_events" TO "authenticated";
GRANT ALL ON TABLE "public"."upcoming_events" TO "service_role";



GRANT ALL ON TABLE "public"."view_sessions" TO "anon";
GRANT ALL ON TABLE "public"."view_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."view_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."watch_history" TO "service_role";



GRANT ALL ON TABLE "public"."watch_parties" TO "anon";
GRANT ALL ON TABLE "public"."watch_parties" TO "authenticated";
GRANT ALL ON TABLE "public"."watch_parties" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







