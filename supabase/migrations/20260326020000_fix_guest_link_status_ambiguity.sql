CREATE OR REPLACE FUNCTION public.inspect_guest_access_link(
  p_token text
)
RETURNS TABLE (
  status text,
  expires_at timestamptz,
  remaining_uses integer,
  can_redeem boolean,
  reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_record public.guest_access_links%ROWTYPE;
  safe_token text := trim(COALESCE(p_token, ''));
BEGIN
  IF safe_token = '' THEN
    RETURN QUERY
    SELECT
      'invalid'::text,
      NULL::timestamptz,
      0,
      false,
      'Guest access token is required'::text;
    RETURN;
  END IF;

  SELECT *
  INTO link_record
  FROM public.guest_access_links
  WHERE token_hash = md5(safe_token);

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      'invalid'::text,
      NULL::timestamptz,
      0,
      false,
      'Invalid guest access link'::text;
    RETURN;
  END IF;

  IF link_record.status = 'disabled' THEN
    RETURN QUERY
    SELECT
      'disabled'::text,
      link_record.expires_at,
      GREATEST(link_record.max_uses - link_record.used_count, 0),
      false,
      'This guest access link has been disabled'::text;
    RETURN;
  END IF;

  IF link_record.expires_at <= now() THEN
    UPDATE public.guest_access_links
    SET status = 'expired'
    WHERE id = link_record.id
      AND public.guest_access_links.status <> 'expired';

    RETURN QUERY
    SELECT
      'expired'::text,
      link_record.expires_at,
      0,
      false,
      'This guest access link has expired'::text;
    RETURN;
  END IF;

  IF link_record.used_count >= link_record.max_uses THEN
    UPDATE public.guest_access_links
    SET status = 'exhausted'
    WHERE id = link_record.id
      AND public.guest_access_links.status <> 'exhausted';

    RETURN QUERY
    SELECT
      'exhausted'::text,
      link_record.expires_at,
      0,
      false,
      'This guest access link has already been used'::text;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    link_record.status,
    link_record.expires_at,
    GREATEST(link_record.max_uses - link_record.used_count, 0),
    true,
    NULL::text;
END;
$$;
