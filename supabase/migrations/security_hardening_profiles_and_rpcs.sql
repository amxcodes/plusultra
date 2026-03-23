-- SECURITY HARDENING
-- Locks down profile privacy, blocks self-privilege escalation, hardens
-- SECURITY DEFINER playlist RPCs, and disables the legacy watch_party table.

-- ---------------------------------------------------------------------------
-- PROFILE READ BOUNDARIES
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_private_profile(
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  username text,
  avatar_url text,
  role text,
  can_stream boolean,
  recent_searches jsonb,
  stats jsonb,
  last_seen_announcements timestamptz,
  last_seen_activity timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.get_private_watch_history(
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.admin_get_all_profiles(
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  username text,
  avatar_url text,
  role text,
  can_stream boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_public_safe" ON public.profiles;

CREATE POLICY "profiles_select_public_safe"
ON public.profiles FOR SELECT
USING (true);

REVOKE SELECT ON public.profiles FROM anon, authenticated;
REVOKE SELECT (watch_history, recent_searches, role, can_stream, stats, last_seen_announcements, last_seen_activity)
ON public.profiles FROM anon, authenticated;

GRANT SELECT (id, username, avatar_url, created_at)
ON public.profiles TO anon, authenticated;

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (username, avatar_url, recent_searches, last_seen_announcements, last_seen_activity)
ON public.profiles TO authenticated;

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

DROP TRIGGER IF EXISTS prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER prevent_profile_privilege_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- ---------------------------------------------------------------------------
-- ADMIN MUTATION RPCS
-- ---------------------------------------------------------------------------

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

  UPDATE public.profiles
  SET can_stream = p_can_stream
  WHERE id = p_user_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- PLAYLIST RPC HARDENING
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.like_playlist(p_playlist_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.unlike_playlist(p_playlist_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.track_playlist_view(p_playlist_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  current_analytics := (SELECT analytics FROM public.playlists WHERE id = p_playlist_id);

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

CREATE OR REPLACE FUNCTION public.clear_my_watch_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.get_private_profile(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_private_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_private_profile(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_private_watch_history(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_private_watch_history(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_private_watch_history(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.admin_get_all_profiles(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_all_profiles(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_all_profiles(integer) TO service_role;

REVOKE ALL ON FUNCTION public.admin_update_user_role(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.admin_update_user_streaming_permission(uuid, boolean) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_streaming_permission(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_streaming_permission(uuid, boolean) TO service_role;

REVOKE ALL ON FUNCTION public.like_playlist(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.like_playlist(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.like_playlist(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.unlike_playlist(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unlike_playlist(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlike_playlist(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.track_playlist_view(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_playlist_view(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_playlist_view(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.clear_my_watch_history() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_my_watch_history() TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_my_watch_history() TO service_role;

-- ---------------------------------------------------------------------------
-- LEGACY WATCH PARTY LOCKDOWN
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can view active parties" ON public.watch_parties;
DROP POLICY IF EXISTS "Users can create parties" ON public.watch_parties;
DROP POLICY IF EXISTS "Host can update party" ON public.watch_parties;
DROP POLICY IF EXISTS "Host can delete party" ON public.watch_parties;
DROP POLICY IF EXISTS "watch_parties_disabled_select" ON public.watch_parties;
DROP POLICY IF EXISTS "watch_parties_disabled_insert" ON public.watch_parties;
DROP POLICY IF EXISTS "watch_parties_disabled_update" ON public.watch_parties;
DROP POLICY IF EXISTS "watch_parties_disabled_delete" ON public.watch_parties;

CREATE POLICY "watch_parties_disabled_select"
ON public.watch_parties FOR SELECT
USING (false);

CREATE POLICY "watch_parties_disabled_insert"
ON public.watch_parties FOR INSERT
WITH CHECK (false);

CREATE POLICY "watch_parties_disabled_update"
ON public.watch_parties FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "watch_parties_disabled_delete"
ON public.watch_parties FOR DELETE
USING (false);

COMMENT ON TABLE public.watch_parties IS
  'LEGACY / DISABLED. Watch-together now relies on the browser extension flow, not database-backed party records.';
