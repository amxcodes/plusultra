-- ============================================================================
-- Fix guest access link token generation
-- ============================================================================
-- Remote project has gen_random_uuid() available but not gen_random_bytes().
-- Regenerate guest link tokens from UUIDs so admin_create_guest_access_link works.

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

  raw_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

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

REVOKE ALL ON FUNCTION public.admin_create_guest_access_link(timestamptz, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_guest_access_link(timestamptz, integer, text) TO authenticated, service_role;
