DO $$
BEGIN
  DELETE FROM public.notifications
  WHERE type = 'watch_party_invite'
     OR COALESCE(data::text, '') ILIKE '%watch_party%'
     OR COALESCE(data::text, '') ILIKE '%watch_part%';

  ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_type_check;

  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_type_check
    CHECK (
      type = ANY (ARRAY[
        'playlist_invite'::text,
        'system'::text,
        'follow'::text,
        'playlist_liked'::text,
        'follower_new_playlist'::text,
        'direct_message'::text
      ])
    );
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    deleted_user jsonb;
    is_admin boolean;
BEGIN
    SELECT role = 'admin' INTO is_admin
    FROM public.profiles WHERE id = auth.uid();

    IF NOT is_admin THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;

    IF p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot delete your own account';
    END IF;

    SELECT jsonb_build_object(
        'id', id,
        'username', username,
        'role', role,
        'created_at', created_at,
        'deleted_at', now()
    ) INTO deleted_user
    FROM public.profiles WHERE id = p_user_id;

    IF deleted_user IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    DELETE FROM public.profiles WHERE id = p_user_id;

    RETURN deleted_user;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated, service_role;
