ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check
CHECK (
  type IN (
    'playlist_invite',
    'watch_party_invite',
    'system',
    'follow',
    'playlist_liked',
    'follower_new_playlist',
    'direct_message'
  )
);

CREATE TABLE IF NOT EXISTS public.watch_party_room_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.watch_party_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (room_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_watch_party_room_invites_room
ON public.watch_party_room_invites(room_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_watch_party_room_invites_recipient
ON public.watch_party_room_invites(recipient_id, status, created_at DESC);

ALTER TABLE public.watch_party_room_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Watch party invite participants can view invites" ON public.watch_party_room_invites;
CREATE POLICY "Watch party invite participants can view invites"
ON public.watch_party_room_invites FOR SELECT
USING (
  sender_id = auth.uid()
  OR recipient_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.watch_party_rooms AS room
    WHERE room.id = watch_party_room_invites.room_id
      AND room.host_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Block direct watch party invite inserts" ON public.watch_party_room_invites;
CREATE POLICY "Block direct watch party invite inserts"
ON public.watch_party_room_invites FOR INSERT
WITH CHECK (false);

DROP POLICY IF EXISTS "Block direct watch party invite updates" ON public.watch_party_room_invites;
CREATE POLICY "Block direct watch party invite updates"
ON public.watch_party_room_invites FOR UPDATE
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "Block direct watch party invite deletes" ON public.watch_party_room_invites;
CREATE POLICY "Block direct watch party invite deletes"
ON public.watch_party_room_invites FOR DELETE
USING (false);

CREATE OR REPLACE FUNCTION public.list_watch_party_room_invites(
  p_room_id uuid
)
RETURNS TABLE (
  id uuid,
  room_id uuid,
  sender_id uuid,
  recipient_id uuid,
  status text,
  created_at timestamptz,
  responded_at timestamptz,
  recipient_profile jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    invite.id,
    invite.room_id,
    invite.sender_id,
    invite.recipient_id,
    invite.status,
    invite.created_at,
    invite.responded_at,
    jsonb_build_object(
      'id', profile.id,
      'username', profile.username,
      'avatar_url', profile.avatar_url,
      'created_at', profile.created_at
    ) AS recipient_profile
  FROM public.watch_party_room_invites AS invite
  JOIN public.profiles AS profile
    ON profile.id = invite.recipient_id
  WHERE invite.room_id = p_room_id
    AND (
      invite.sender_id = auth.uid()
      OR invite.recipient_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.watch_party_rooms AS room
        WHERE room.id = invite.room_id
          AND room.host_id = auth.uid()
      )
    )
  ORDER BY invite.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.create_watch_party_room_invites(
  p_room_id uuid,
  p_recipient_ids uuid[]
)
RETURNS SETOF public.watch_party_room_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  target_room public.watch_party_rooms%ROWTYPE;
  recipient_id uuid;
  invite_row public.watch_party_room_invites%ROWTYPE;
  sender_name text;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_recipient_ids IS NULL OR array_length(p_recipient_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'At least one recipient is required';
  END IF;

  SELECT *
  INTO target_room
  FROM public.watch_party_rooms AS room
  WHERE room.id = p_room_id
    AND room.host_id = requester_id
    AND room.status <> 'ended'
    AND room.expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found or not editable';
  END IF;

  SELECT split_part(profile.username, '@', 1)
  INTO sender_name
  FROM public.profiles AS profile
  WHERE profile.id = requester_id;

  FOREACH recipient_id IN ARRAY p_recipient_ids LOOP
    IF recipient_id IS NULL OR recipient_id = requester_id THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.follows AS follow
      WHERE follow.follower_id = requester_id
        AND follow.following_id = recipient_id
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.watch_party_room_invites (
      room_id,
      sender_id,
      recipient_id,
      status,
      responded_at
    )
    VALUES (
      target_room.id,
      requester_id,
      recipient_id,
      'pending',
      NULL
    )
    ON CONFLICT (room_id, recipient_id) DO UPDATE
    SET
      sender_id = EXCLUDED.sender_id,
      status = 'pending',
      responded_at = NULL,
      created_at = now()
    RETURNING *
    INTO invite_row;

    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      recipient_id,
      'watch_party_invite',
      COALESCE(sender_name, 'Someone') || ' invited you to a watch party',
      'Join ' || COALESCE(NULLIF(target_room.title, ''), 'this title') || ' with room ' || target_room.room_code || '.',
      jsonb_build_object(
        'invite_id', invite_row.id,
        'room_id', target_room.id,
        'room_code', target_room.room_code,
        'tmdb_id', target_room.tmdb_id,
        'media_type', target_room.media_type,
        'season', target_room.season,
        'episode', target_room.episode,
        'title', target_room.title,
        'actor_id', requester_id,
        'actor_username', sender_name
      )
    );

    RETURN NEXT invite_row;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_watch_party_room_invite(
  p_invite_id uuid
)
RETURNS SETOF public.watch_party_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  target_invite public.watch_party_room_invites%ROWTYPE;
  target_room public.watch_party_rooms%ROWTYPE;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO target_invite
  FROM public.watch_party_room_invites AS invite
  WHERE invite.id = p_invite_id
    AND invite.recipient_id = requester_id
    AND invite.status = 'pending'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  SELECT *
  INTO target_room
  FROM public.watch_party_rooms AS room
  WHERE room.id = target_invite.room_id
    AND room.status <> 'ended'
    AND room.expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room is no longer available';
  END IF;

  UPDATE public.watch_party_room_invites AS invite
  SET
    status = 'accepted',
    responded_at = now()
  WHERE invite.id = target_invite.id;

  INSERT INTO public.watch_party_room_members (
    room_id,
    user_id,
    role,
    state,
    last_seen_at
  )
  VALUES (
    target_room.id,
    requester_id,
    CASE WHEN requester_id = target_room.host_id THEN 'host' ELSE 'guest' END,
    'joined',
    now()
  )
  ON CONFLICT (room_id, user_id) DO UPDATE
  SET
    state = 'joined',
    last_seen_at = now();

  UPDATE public.notifications
  SET is_read = true
  WHERE user_id = requester_id
    AND type = 'watch_party_invite'
    AND data ->> 'invite_id' = p_invite_id::text;

  RETURN NEXT target_room;
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_watch_party_room_invite(
  p_invite_id uuid
)
RETURNS SETOF public.watch_party_room_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  updated_invite public.watch_party_room_invites%ROWTYPE;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.watch_party_room_invites AS invite
  SET
    status = 'declined',
    responded_at = now()
  WHERE invite.id = p_invite_id
    AND invite.recipient_id = requester_id
    AND invite.status = 'pending'
  RETURNING *
  INTO updated_invite;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  UPDATE public.notifications
  SET is_read = true
  WHERE user_id = requester_id
    AND type = 'watch_party_invite'
    AND data ->> 'invite_id' = p_invite_id::text;

  RETURN NEXT updated_invite;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_watch_party_room_invite(
  p_invite_id uuid
)
RETURNS SETOF public.watch_party_room_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  updated_invite public.watch_party_room_invites%ROWTYPE;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.watch_party_room_invites AS invite
  SET
    status = 'revoked',
    responded_at = now()
  WHERE invite.id = p_invite_id
    AND invite.sender_id = requester_id
    AND invite.status = 'pending'
  RETURNING *
  INTO updated_invite;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  RETURN NEXT updated_invite;
END;
$$;

REVOKE ALL ON FUNCTION public.list_watch_party_room_invites(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_watch_party_room_invites(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_watch_party_room_invites(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_watch_party_room_invites(uuid, uuid[]) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.accept_watch_party_room_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_watch_party_room_invite(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.decline_watch_party_room_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_watch_party_room_invite(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.revoke_watch_party_room_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_watch_party_room_invite(uuid) TO authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'watch_party_room_invites'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_party_room_invites;
  END IF;
END
$$;
