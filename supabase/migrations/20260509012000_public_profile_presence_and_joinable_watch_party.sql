CREATE OR REPLACE FUNCTION public.join_watch_party_room_by_id(
  p_room_id uuid
)
RETURNS SETOF public.watch_party_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  target_room public.watch_party_rooms%ROWTYPE;
  pending_invite_id uuid;
  can_join boolean := false;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO target_room
  FROM public.watch_party_rooms AS room
  WHERE room.id = p_room_id
    AND room.status <> 'ended'
    AND room.expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  SELECT invite.id
  INTO pending_invite_id
  FROM public.watch_party_room_invites AS invite
  WHERE invite.room_id = target_room.id
    AND invite.recipient_id = requester_id
    AND invite.status = 'pending'
  ORDER BY invite.created_at DESC
  LIMIT 1;

  can_join := (
    requester_id = target_room.host_id
    OR pending_invite_id IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM public.watch_party_room_members AS member
      WHERE member.room_id = target_room.id
        AND member.user_id = requester_id
        AND member.state <> 'left'
    )
    OR EXISTS (
      SELECT 1
      FROM public.follows AS follow
      WHERE follow.follower_id = requester_id
        AND follow.following_id = target_room.host_id
    )
  );

  IF NOT can_join THEN
    RAISE EXCEPTION 'Room is not joinable';
  END IF;

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

  IF pending_invite_id IS NOT NULL THEN
    UPDATE public.watch_party_room_invites
    SET
      status = 'accepted',
      responded_at = now()
    WHERE id = pending_invite_id;

    UPDATE public.notifications
    SET is_read = true
    WHERE user_id = requester_id
      AND type = 'watch_party_invite'
      AND data ->> 'invite_id' = pending_invite_id::text;
  END IF;

  RETURN NEXT target_room;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_public_profile_presence(
  p_user_ids uuid[]
)
RETURNS TABLE (
  user_id uuid,
  state text,
  last_seen_at timestamptz,
  activity_mode text,
  room_id uuid,
  room_code text,
  room_title text,
  room_media_type text,
  room_season integer,
  room_episode integer,
  room_status text,
  watch_title text,
  viewer_is_following boolean,
  viewer_has_pending_invite boolean,
  viewer_is_room_member boolean,
  is_joinable boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH target_users AS (
    SELECT DISTINCT unnest(p_user_ids) AS user_id
  ),
  latest_presence AS (
    SELECT DISTINCT ON (aps.user_id)
      aps.user_id,
      aps.last_heartbeat_at,
      aps.active_mode
    FROM public.app_presence_sessions AS aps
    JOIN target_users AS target
      ON target.user_id = aps.user_id
    ORDER BY aps.user_id, aps.last_heartbeat_at DESC, aps.updated_at DESC
  ),
  latest_watch AS (
    SELECT DISTINCT ON (vs.user_id)
      vs.user_id,
      vs.title,
      vs.last_heartbeat_at,
      vs.last_activity_mode
    FROM public.view_sessions AS vs
    JOIN target_users AS target
      ON target.user_id = vs.user_id
    ORDER BY vs.user_id, vs.last_heartbeat_at DESC, vs.updated_at DESC
  ),
  active_rooms AS (
    SELECT DISTINCT ON (room.host_id)
      room.host_id,
      room.id AS room_id,
      room.room_code,
      room.title,
      room.media_type,
      room.season,
      room.episode,
      room.status,
      COALESCE(room.countdown_started_at, room.playback_updated_at, room.updated_at, room.created_at) AS started_at
    FROM public.watch_party_rooms AS room
    JOIN target_users AS target
      ON target.user_id = room.host_id
    WHERE room.status IN ('setup', 'ready', 'live')
      AND room.expires_at > now()
    ORDER BY room.host_id,
      CASE room.status
        WHEN 'live' THEN 0
        WHEN 'ready' THEN 1
        ELSE 2
      END,
      COALESCE(room.countdown_started_at, room.playback_updated_at, room.updated_at, room.created_at) DESC
  ),
  room_invites AS (
    SELECT
      invite.room_id,
      invite.recipient_id,
      bool_or(invite.status = 'pending') AS has_pending_invite
    FROM public.watch_party_room_invites AS invite
    WHERE invite.recipient_id = auth.uid()
    GROUP BY invite.room_id, invite.recipient_id
  ),
  room_members AS (
    SELECT
      member.room_id,
      member.user_id,
      bool_or(member.state <> 'left') AS is_member
    FROM public.watch_party_room_members AS member
    WHERE member.user_id = auth.uid()
    GROUP BY member.room_id, member.user_id
  )
  SELECT
    target.user_id,
    CASE
      WHEN room.room_id IS NOT NULL THEN 'hosting'
      WHEN watch.last_heartbeat_at >= (now() - interval '90 seconds') AND COALESCE(watch.last_activity_mode, latest.active_mode) = 'watch' THEN 'watching'
      WHEN latest.last_heartbeat_at >= (now() - interval '90 seconds') THEN 'online'
      WHEN latest.last_heartbeat_at >= (now() - interval '15 minutes') THEN 'idle'
      ELSE 'offline'
    END AS state,
    COALESCE(room.started_at, watch.last_heartbeat_at, latest.last_heartbeat_at) AS last_seen_at,
    latest.active_mode AS activity_mode,
    room.room_id,
    room.room_code,
    room.title AS room_title,
    room.media_type AS room_media_type,
    room.season AS room_season,
    room.episode AS room_episode,
    room.status AS room_status,
    watch.title AS watch_title,
    EXISTS (
      SELECT 1
      FROM public.follows AS follow
      WHERE follow.follower_id = auth.uid()
        AND follow.following_id = target.user_id
    ) AS viewer_is_following,
    COALESCE(invite.has_pending_invite, false) AS viewer_has_pending_invite,
    COALESCE(member.is_member, false) AS viewer_is_room_member,
    (
      room.room_id IS NOT NULL
      AND (
        target.user_id = auth.uid()
        OR COALESCE(invite.has_pending_invite, false)
        OR COALESCE(member.is_member, false)
        OR EXISTS (
          SELECT 1
          FROM public.follows AS follow
          WHERE follow.follower_id = auth.uid()
            AND follow.following_id = target.user_id
        )
      )
    ) AS is_joinable
  FROM target_users AS target
  LEFT JOIN latest_presence AS latest
    ON latest.user_id = target.user_id
  LEFT JOIN latest_watch AS watch
    ON watch.user_id = target.user_id
  LEFT JOIN active_rooms AS room
    ON room.host_id = target.user_id
  LEFT JOIN room_invites AS invite
    ON invite.room_id = room.room_id
   AND invite.recipient_id = auth.uid()
  LEFT JOIN room_members AS member
    ON member.room_id = room.room_id
   AND member.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.join_watch_party_room_by_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_watch_party_room_by_id(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.list_public_profile_presence(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_public_profile_presence(uuid[]) TO authenticated, service_role;
