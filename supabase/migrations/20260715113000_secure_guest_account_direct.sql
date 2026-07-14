CREATE OR REPLACE FUNCTION public.secure_guest_account_direct(
  p_email text,
  p_password text
)
RETURNS TABLE (
  profile_id uuid,
  username text,
  account_kind text,
  guest_secured_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  requester_id uuid := auth.uid();
  requester_profile public.profiles%ROWTYPE;
  safe_email text := lower(btrim(COALESCE(p_email, '')));
  safe_password text := COALESCE(p_password, '');
  next_username text;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF safe_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'Enter a valid email address';
  END IF;

  IF length(safe_password) < 6 THEN
    RAISE EXCEPTION 'Choose a password with at least 6 characters';
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

  IF EXISTS (
    SELECT 1
    FROM auth.users auth_user
    WHERE lower(auth_user.email) = safe_email
      AND auth_user.id <> requester_id
  ) THEN
    RAISE EXCEPTION 'Email is already in use';
  END IF;

  IF COALESCE(requester_profile.username, '') = ''
     OR requester_profile.username ~ '^guest[_-]'
  THEN
    next_username := public.build_unique_username(split_part(safe_email, '@', 1));
  ELSE
    next_username := requester_profile.username;
  END IF;

  UPDATE auth.users
  SET
    email = safe_email,
    encrypted_password = extensions.crypt(safe_password, extensions.gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    confirmation_token = '',
    email_change = '',
    email_change_token_current = '',
    email_change_token_new = '',
    recovery_token = '',
    updated_at = now(),
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('email', safe_email)
  WHERE id = requester_id;

  UPDATE auth.identities
  SET
    provider = 'email',
    provider_id = safe_email,
    identity_data = COALESCE(identity_data, '{}'::jsonb)
      || jsonb_build_object('sub', requester_id::text, 'email', safe_email, 'email_verified', true),
    updated_at = now()
  WHERE user_id = requester_id
    AND provider IN ('email', 'anonymous');

  IF NOT FOUND THEN
    INSERT INTO auth.identities (
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    VALUES (
      safe_email,
      requester_id,
      jsonb_build_object('sub', requester_id::text, 'email', safe_email, 'email_verified', true),
      'email',
      now(),
      now(),
      now()
    );
  END IF;

  PERFORM set_config('app.trusted_profile_write', 'on', true);

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

REVOKE ALL ON FUNCTION public.secure_guest_account_direct(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.secure_guest_account_direct(text, text) TO authenticated, service_role;
