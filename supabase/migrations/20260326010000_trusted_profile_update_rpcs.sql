-- Route user profile mutations through trusted RPCs instead of direct table updates.

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

  UPDATE public.profiles
  SET
    username = COALESCE(safe_username, username),
    avatar_url = COALESCE(safe_avatar_url, avatar_url)
  WHERE id = requester_id;

  RETURN QUERY
  SELECT
    profile.id,
    profile.username,
    profile.avatar_url
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
    SELECT DISTINCT ON (lower(value))
      value,
      ord
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
    SELECT DISTINCT ON (lower(value))
      value,
      ord
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

  UPDATE public.profiles
  SET last_seen_activity = seen_at
  WHERE id = requester_id;

  RETURN seen_at;
END;
$$;

REVOKE UPDATE (username, avatar_url, recent_searches, last_seen_announcements, last_seen_activity)
ON public.profiles FROM authenticated;

REVOKE ALL ON FUNCTION public.update_my_profile(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.set_my_recent_searches(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_recent_searches(jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.save_recent_search(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_recent_search(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.mark_announcements_seen() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_announcements_seen() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.mark_activity_seen() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_activity_seen() TO authenticated, service_role;
