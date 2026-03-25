-- ============================================================================
-- Guest Access System
-- ============================================================================
-- Adds expiring admin-issued guest access links, guest account lifecycle fields,
-- guest-aware privacy/follow restrictions, and RPCs for redeeming and securing
-- guest accounts without changing the existing standard signup flow.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS account_kind text NOT NULL DEFAULT 'standard'
    CHECK (account_kind IN ('standard', 'guest')),
ADD COLUMN IF NOT EXISTS guest_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS guest_created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS guest_secured_at timestamptz,
ADD COLUMN IF NOT EXISTS guest_link_id uuid,
ADD COLUMN IF NOT EXISTS is_guest_hidden boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.account_kind IS 'User lifecycle type. Guest accounts are temporary until secured.';
COMMENT ON COLUMN public.profiles.guest_expires_at IS 'When guest access expires. Null for standard accounts or secured guests.';
COMMENT ON COLUMN public.profiles.guest_created_by IS 'Admin profile id that issued the guest access.';
COMMENT ON COLUMN public.profiles.guest_secured_at IS 'When a guest account was converted into a permanent standard account.';
COMMENT ON COLUMN public.profiles.guest_link_id IS 'Guest access link that originally created this account.';
COMMENT ON COLUMN public.profiles.is_guest_hidden IS 'When true, the profile is hidden from public discovery and search.';

CREATE TABLE IF NOT EXISTS public.guest_access_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  max_uses integer NOT NULL DEFAULT 1 CHECK (max_uses >= 1 AND max_uses <= 25),
  used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled', 'expired', 'exhausted')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_guest_link_id_fkey;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_guest_link_id_fkey
FOREIGN KEY (guest_link_id)
REFERENCES public.guest_access_links(id)
ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_guest_access_links_created_by
ON public.guest_access_links(created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_guest_access_links_status_expires_at
ON public.guest_access_links(status, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_guest_state
ON public.profiles(account_kind, guest_expires_at DESC, guest_secured_at DESC);

ALTER TABLE public.guest_access_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guest_access_links_no_direct_select" ON public.guest_access_links;
DROP POLICY IF EXISTS "guest_access_links_no_direct_insert" ON public.guest_access_links;
DROP POLICY IF EXISTS "guest_access_links_no_direct_update" ON public.guest_access_links;
DROP POLICY IF EXISTS "guest_access_links_no_direct_delete" ON public.guest_access_links;

CREATE POLICY "guest_access_links_no_direct_select"
ON public.guest_access_links FOR SELECT
USING (false);

CREATE POLICY "guest_access_links_no_direct_insert"
ON public.guest_access_links FOR INSERT
WITH CHECK (false);

CREATE POLICY "guest_access_links_no_direct_update"
ON public.guest_access_links FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "guest_access_links_no_direct_delete"
ON public.guest_access_links FOR DELETE
USING (false);

CREATE OR REPLACE FUNCTION public.is_admin_user(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  requester_role text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT profiles.role
  INTO requester_role
  FROM public.profiles
  WHERE profiles.id = p_user_id;

  RETURN requester_role = 'admin';
END;
$$;

CREATE OR REPLACE FUNCTION public.build_unique_username(p_base text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_base text;
  candidate text;
  suffix integer := 0;
BEGIN
  normalized_base := lower(regexp_replace(COALESCE(p_base, 'guest'), '[^a-zA-Z0-9]+', '_', 'g'));
  normalized_base := regexp_replace(normalized_base, '^_+|_+$', '', 'g');

  IF normalized_base = '' THEN
    normalized_base := 'guest';
  END IF;

  candidate := left(normalized_base, 48);

  WHILE EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE username = candidate
  ) LOOP
    suffix := suffix + 1;
    candidate := left(normalized_base, GREATEST(1, 48 - length(suffix::text) - 1)) || '_' || suffix::text;
  END LOOP;

  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_public_profiles(
  p_query text,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  username text,
  avatar_url text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_query text := trim(COALESCE(p_query, ''));
  safe_limit integer := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
BEGIN
  IF safe_query = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    profile.id,
    profile.username,
    profile.avatar_url,
    profile.created_at
  FROM public.profiles profile
  WHERE profile.account_kind = 'standard'
    AND COALESCE(profile.is_guest_hidden, false) = false
    AND profile.username ILIKE '%' || safe_query || '%'
  ORDER BY profile.created_at DESC
  LIMIT safe_limit;
END;
$$;

DROP FUNCTION IF EXISTS public.get_private_profile(uuid);

CREATE OR REPLACE FUNCTION public.get_private_profile(
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  username text,
  avatar_url text,
  role text,
  can_stream boolean,
  account_kind text,
  guest_expires_at timestamptz,
  guest_created_by uuid,
  guest_secured_at timestamptz,
  guest_link_id uuid,
  is_guest_hidden boolean,
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
    profile.account_kind,
    profile.guest_expires_at,
    profile.guest_created_by,
    profile.guest_secured_at,
    profile.guest_link_id,
    profile.is_guest_hidden,
    profile.recent_searches,
    profile.stats,
    profile.last_seen_announcements,
    profile.last_seen_activity,
    profile.created_at
  FROM public.profiles profile
  WHERE profile.id = target_user_id;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_get_all_profiles(integer);

CREATE OR REPLACE FUNCTION public.admin_get_all_profiles(
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  username text,
  avatar_url text,
  role text,
  can_stream boolean,
  account_kind text,
  guest_expires_at timestamptz,
  guest_secured_at timestamptz,
  is_guest_hidden boolean,
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
    profile.account_kind,
    profile.guest_expires_at,
    profile.guest_secured_at,
    profile.is_guest_hidden,
    profile.created_at
  FROM public.profiles profile
  ORDER BY profile.created_at DESC
  LIMIT safe_limit;
END;
$$;

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
     OR COALESCE(new_profile->'account_kind', 'null'::jsonb) IS DISTINCT FROM COALESCE(old_profile->'account_kind', 'null'::jsonb)
     OR COALESCE(new_profile->'guest_expires_at', 'null'::jsonb) IS DISTINCT FROM COALESCE(old_profile->'guest_expires_at', 'null'::jsonb)
     OR COALESCE(new_profile->'guest_created_by', 'null'::jsonb) IS DISTINCT FROM COALESCE(old_profile->'guest_created_by', 'null'::jsonb)
     OR COALESCE(new_profile->'guest_secured_at', 'null'::jsonb) IS DISTINCT FROM COALESCE(old_profile->'guest_secured_at', 'null'::jsonb)
     OR COALESCE(new_profile->'guest_link_id', 'null'::jsonb) IS DISTINCT FROM COALESCE(old_profile->'guest_link_id', 'null'::jsonb)
     OR COALESCE(new_profile->'is_guest_hidden', 'null'::jsonb) IS DISTINCT FROM COALESCE(old_profile->'is_guest_hidden', 'null'::jsonb)
  THEN
    RAISE EXCEPTION 'Sensitive profile fields must be updated through trusted RPCs only';
  END IF;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "profiles_select_public_safe" ON public.profiles;

CREATE POLICY "profiles_select_public_safe"
ON public.profiles FOR SELECT
USING (
  COALESCE(is_guest_hidden, false) = false
  OR id = auth.uid()
  OR public.is_admin_user(auth.uid())
);

DROP POLICY IF EXISTS "Users can follow others" ON public.follows;
CREATE POLICY "Users can follow others"
ON public.follows FOR INSERT
WITH CHECK (
  follower_id = (SELECT auth.uid())
  AND follower_id <> following_id
  AND EXISTS (
    SELECT 1
    FROM public.profiles follower
    WHERE follower.id = follower_id
      AND follower.account_kind = 'standard'
  )
  AND EXISTS (
    SELECT 1
    FROM public.profiles following
    WHERE following.id = following_id
      AND following.account_kind = 'standard'
  )
);

DROP POLICY IF EXISTS "Users can unfollow" ON public.follows;
CREATE POLICY "Users can unfollow"
ON public.follows FOR DELETE
USING (
  follower_id = (SELECT auth.uid())
);

CREATE OR REPLACE FUNCTION public.admin_create_guest_access_link(
  p_expires_at timestamptz,
  p_max_uses integer DEFAULT 1,
  p_note text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  token text,
  expires_at timestamptz,
  max_uses integer,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  raw_token text;
BEGIN
  IF NOT public.is_admin_user(requester_id) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_expires_at IS NULL OR p_expires_at <= now() THEN
    RAISE EXCEPTION 'Guest access expiry must be in the future';
  END IF;

  IF COALESCE(p_max_uses, 1) < 1 OR COALESCE(p_max_uses, 1) > 25 THEN
    RAISE EXCEPTION 'Guest access links must allow between 1 and 25 uses';
  END IF;

  raw_token := encode(gen_random_bytes(24), 'hex');

  RETURN QUERY
  INSERT INTO public.guest_access_links (
    token_hash,
    created_by,
    expires_at,
    max_uses,
    note
  )
  VALUES (
    md5(raw_token),
    requester_id,
    p_expires_at,
    COALESCE(p_max_uses, 1),
    NULLIF(trim(COALESCE(p_note, '')), '')
  )
  RETURNING
    guest_access_links.id,
    raw_token,
    guest_access_links.expires_at,
    guest_access_links.max_uses,
    guest_access_links.status,
    guest_access_links.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_guest_access_link(
  p_token text
)
RETURNS TABLE (
  profile_id uuid,
  username text,
  account_kind text,
  guest_expires_at timestamptz,
  guest_link_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  requester_profile public.profiles%ROWTYPE;
  link_record public.guest_access_links%ROWTYPE;
  guest_username text;
  is_anonymous_session boolean := COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false);
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF trim(COALESCE(p_token, '')) = '' THEN
    RAISE EXCEPTION 'Guest access token is required';
  END IF;

  SELECT *
  INTO link_record
  FROM public.guest_access_links
  WHERE token_hash = md5(trim(p_token))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid guest access link';
  END IF;

  SELECT *
  INTO requester_profile
  FROM public.profiles
  WHERE id = requester_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for current session';
  END IF;

  IF requester_profile.account_kind = 'guest'
     AND requester_profile.guest_link_id = link_record.id THEN
    RETURN QUERY
    SELECT
      requester_profile.id,
      requester_profile.username,
      requester_profile.account_kind,
      requester_profile.guest_expires_at,
      requester_profile.guest_link_id;
    RETURN;
  END IF;

  IF NOT is_anonymous_session THEN
    RAISE EXCEPTION 'Guest links can only be redeemed from a guest session';
  END IF;

  IF link_record.status = 'disabled' THEN
    RAISE EXCEPTION 'This guest access link has been disabled';
  END IF;

  IF link_record.expires_at <= now() THEN
    UPDATE public.guest_access_links
    SET status = 'expired'
    WHERE id = link_record.id
      AND status <> 'expired';

    RAISE EXCEPTION 'This guest access link has expired';
  END IF;

  IF link_record.used_count >= link_record.max_uses THEN
    UPDATE public.guest_access_links
    SET status = 'exhausted'
    WHERE id = link_record.id
      AND status <> 'exhausted';

    RAISE EXCEPTION 'This guest access link has already been used';
  END IF;

  IF requester_profile.guest_secured_at IS NOT NULL THEN
    RAISE EXCEPTION 'This session is already attached to a secured account';
  END IF;

  IF COALESCE(NULLIF(trim(requester_profile.username), ''), '') = '' THEN
    guest_username := public.build_unique_username(
      'guest_' || right(replace(requester_id::text, '-', ''), 8)
    );
  ELSE
    guest_username := requester_profile.username;
  END IF;

  UPDATE public.profiles
  SET
    username = guest_username,
    avatar_url = COALESCE(NULLIF(avatar_url, ''), 'https://ui-avatars.com/api/?name=Guest&background=27272a&color=ffffff&bold=true'),
    can_stream = true,
    account_kind = 'guest',
    guest_expires_at = link_record.expires_at,
    guest_created_by = link_record.created_by,
    guest_link_id = link_record.id,
    is_guest_hidden = true
  WHERE id = requester_id;

  UPDATE public.guest_access_links
  SET
    used_count = used_count + 1,
    status = CASE
      WHEN used_count + 1 >= max_uses THEN 'exhausted'
      ELSE status
    END
  WHERE id = link_record.id;

  RETURN QUERY
  SELECT
    profile.id,
    profile.username,
    profile.account_kind,
    profile.guest_expires_at,
    profile.guest_link_id
  FROM public.profiles profile
  WHERE profile.id = requester_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.secure_guest_account()
RETURNS TABLE (
  profile_id uuid,
  username text,
  account_kind text,
  guest_secured_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  requester_profile public.profiles%ROWTYPE;
  current_email text;
  current_email_confirmed_at timestamptz;
  next_username text;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO requester_profile
  FROM public.profiles
  WHERE id = requester_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF requester_profile.account_kind IS DISTINCT FROM 'guest' THEN
    RAISE EXCEPTION 'Only guest accounts can be secured';
  END IF;

  IF requester_profile.guest_expires_at IS NULL OR requester_profile.guest_expires_at <= now() THEN
    RAISE EXCEPTION 'Guest access has expired';
  END IF;

  SELECT email, email_confirmed_at
  INTO current_email, current_email_confirmed_at
  FROM auth.users
  WHERE id = requester_id;

  IF current_email IS NULL OR trim(current_email) = '' THEN
    RAISE EXCEPTION 'Add an email address before securing this account';
  END IF;

  IF current_email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Verify your email before securing this account';
  END IF;

  IF COALESCE(requester_profile.username, '') = ''
     OR requester_profile.username ~ '^guest[_-]'
  THEN
    next_username := public.build_unique_username(split_part(current_email, '@', 1));
  ELSE
    next_username := requester_profile.username;
  END IF;

  UPDATE public.profiles
  SET
    username = next_username,
    account_kind = 'standard',
    guest_secured_at = now(),
    guest_expires_at = NULL,
    is_guest_hidden = false
  WHERE id = requester_id;

  RETURN QUERY
  SELECT
    profile.id,
    profile.username,
    profile.account_kind,
    profile.guest_secured_at
  FROM public.profiles profile
  WHERE profile.id = requester_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_guest_accounts(
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  username text,
  avatar_url text,
  can_stream boolean,
  account_kind text,
  created_at timestamptz,
  guest_expires_at timestamptz,
  guest_secured_at timestamptz,
  is_guest_hidden boolean,
  guest_link_id uuid,
  guest_created_by uuid,
  created_by_username text,
  is_expired boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_limit integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    profile.id,
    profile.username,
    profile.avatar_url,
    profile.can_stream,
    profile.account_kind,
    profile.created_at,
    profile.guest_expires_at,
    profile.guest_secured_at,
    profile.is_guest_hidden,
    profile.guest_link_id,
    profile.guest_created_by,
    creator.username,
    profile.account_kind = 'guest' AND profile.guest_expires_at IS NOT NULL AND profile.guest_expires_at <= now()
  FROM public.profiles profile
  LEFT JOIN public.profiles creator
    ON creator.id = profile.guest_created_by
  WHERE profile.guest_link_id IS NOT NULL
     OR profile.account_kind = 'guest'
     OR profile.guest_secured_at IS NOT NULL
  ORDER BY COALESCE(profile.guest_expires_at, profile.guest_secured_at, profile.created_at) DESC
  LIMIT safe_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_guest_access_links(
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  expires_at timestamptz,
  max_uses integer,
  used_count integer,
  status text,
  note text,
  created_by uuid,
  created_by_username text,
  redeemed_profile_id uuid,
  redeemed_username text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_limit integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    link.id,
    link.created_at,
    link.expires_at,
    link.max_uses,
    link.used_count,
    link.status,
    link.note,
    link.created_by,
    creator.username,
    guest.id,
    guest.username
  FROM public.guest_access_links link
  LEFT JOIN public.profiles creator
    ON creator.id = link.created_by
  LEFT JOIN public.profiles guest
    ON guest.guest_link_id = link.id
  ORDER BY link.created_at DESC
  LIMIT safe_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_extend_guest_access(
  p_user_id uuid,
  p_expires_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_link_id uuid;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_expires_at IS NULL OR p_expires_at <= now() THEN
    RAISE EXCEPTION 'Guest expiry must be in the future';
  END IF;

  UPDATE public.profiles
  SET guest_expires_at = p_expires_at
  WHERE id = p_user_id
    AND account_kind = 'guest'
  RETURNING guest_link_id INTO target_link_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active guest account not found';
  END IF;

  IF target_link_id IS NOT NULL THEN
    UPDATE public.guest_access_links
    SET expires_at = GREATEST(expires_at, p_expires_at)
    WHERE id = target_link_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_disable_guest_link(
  p_link_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE public.guest_access_links
  SET status = 'disabled'
  WHERE id = p_link_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Guest access link not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_user(uuid) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.build_unique_username(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.build_unique_username(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.search_public_profiles(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_public_profiles(text, integer) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_private_profile(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_private_profile(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_get_all_profiles(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_all_profiles(integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_create_guest_access_link(timestamptz, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_guest_access_link(timestamptz, integer, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.redeem_guest_access_link(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_guest_access_link(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.secure_guest_account() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.secure_guest_account() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_get_guest_accounts(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_guest_accounts(integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_get_guest_access_links(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_guest_access_links(integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_extend_guest_access(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_extend_guest_access(uuid, timestamptz) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_disable_guest_link(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_disable_guest_link(uuid) TO authenticated, service_role;
