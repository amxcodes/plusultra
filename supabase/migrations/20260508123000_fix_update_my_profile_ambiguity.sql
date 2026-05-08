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
       FROM public.profiles AS profile
       WHERE profile.username = safe_username
         AND profile.id <> requester_id
     )
  THEN
    RAISE EXCEPTION 'Username already taken';
  END IF;

  PERFORM set_config('app.trusted_profile_write', 'on', true);

  UPDATE public.profiles AS profile
  SET
    username = COALESCE(safe_username, profile.username),
    avatar_url = COALESCE(safe_avatar_url, profile.avatar_url)
  WHERE profile.id = requester_id;

  RETURN QUERY
  SELECT profile.id, profile.username, profile.avatar_url
  FROM public.profiles AS profile
  WHERE profile.id = requester_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_profile(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text) TO authenticated, service_role;
