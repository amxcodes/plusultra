ALTER TABLE public.watch_party_rooms
ADD COLUMN IF NOT EXISTS countdown_started_at timestamptz,
ADD COLUMN IF NOT EXISTS countdown_seconds integer NOT NULL DEFAULT 10;

CREATE OR REPLACE FUNCTION public.leave_watch_party_room(
  p_room_id uuid
)
RETURNS SETOF public.watch_party_room_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  updated_member public.watch_party_room_members%ROWTYPE;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.watch_party_room_members AS member
  SET
    state = 'left',
    ready_at = NULL,
    last_seen_at = now()
  WHERE member.room_id = p_room_id
    AND member.user_id = requester_id
  RETURNING *
  INTO updated_member;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room membership not found';
  END IF;

  RETURN NEXT updated_member;
END;
$$;

CREATE OR REPLACE FUNCTION public.end_watch_party_room(
  p_room_id uuid
)
RETURNS SETOF public.watch_party_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  updated_room public.watch_party_rooms%ROWTYPE;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.watch_party_rooms AS room
  SET
    status = 'ended',
    is_paused = true,
    countdown_started_at = NULL,
    playback_updated_at = now()
  WHERE room.id = p_room_id
    AND room.host_id = requester_id
  RETURNING *
  INTO updated_room;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found or not editable';
  END IF;

  UPDATE public.watch_party_room_members AS member
  SET
    state = CASE WHEN member.role = 'host' THEN 'left' ELSE member.state END,
    ready_at = NULL,
    last_seen_at = now()
  WHERE member.room_id = p_room_id
    AND member.user_id = requester_id;

  RETURN NEXT updated_room;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_watch_party_countdown(
  p_room_id uuid,
  p_countdown_seconds integer DEFAULT 10
)
RETURNS SETOF public.watch_party_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  updated_room public.watch_party_rooms%ROWTYPE;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.watch_party_rooms AS room
  SET
    status = 'ready',
    countdown_started_at = now(),
    countdown_seconds = GREATEST(COALESCE(p_countdown_seconds, 10), 3),
    playback_updated_at = now()
  WHERE room.id = p_room_id
    AND room.host_id = requester_id
    AND room.selected_source IS NOT NULL
    AND room.status <> 'ended'
  RETURNING *
  INTO updated_room;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found, source missing, or not editable';
  END IF;

  RETURN NEXT updated_room;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_watch_party_playback(
  p_room_id uuid,
  p_current_time_seconds double precision DEFAULT NULL,
  p_is_paused boolean DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS SETOF public.watch_party_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  next_status text;
  updated_room public.watch_party_rooms%ROWTYPE;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  next_status := COALESCE(LOWER(NULLIF(btrim(COALESCE(p_status, '')), '')), NULL);

  UPDATE public.watch_party_rooms AS room
  SET
    current_time_seconds = COALESCE(p_current_time_seconds, room.current_time_seconds),
    is_paused = COALESCE(p_is_paused, room.is_paused),
    status = COALESCE(next_status, room.status),
    countdown_started_at = CASE
      WHEN COALESCE(next_status, room.status) = 'live' THEN NULL
      ELSE room.countdown_started_at
    END,
    playback_updated_at = now()
  WHERE room.id = p_room_id
    AND room.host_id = requester_id
  RETURNING *
  INTO updated_room;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found or not editable';
  END IF;

  RETURN NEXT updated_room;
END;
$$;

REVOKE ALL ON FUNCTION public.leave_watch_party_room(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_watch_party_room(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.end_watch_party_room(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.end_watch_party_room(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.start_watch_party_countdown(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_watch_party_countdown(uuid, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.update_watch_party_playback(uuid, double precision, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_watch_party_playback(uuid, double precision, boolean, text) TO authenticated, service_role;
