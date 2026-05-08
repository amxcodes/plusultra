CREATE TABLE IF NOT EXISTS public.watch_party_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text NOT NULL UNIQUE,
  host_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tmdb_id text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('movie', 'tv')),
  season integer,
  episode integer,
  title text,
  provider_id text,
  provider_label text,
  server_id text,
  server_label text,
  selected_source jsonb,
  source_state text NOT NULL DEFAULT 'pending' CHECK (source_state IN ('pending', 'portable', 'guest_recheck', 'host_only')),
  status text NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'ready', 'live', 'ended')),
  current_time_seconds double precision NOT NULL DEFAULT 0,
  is_paused boolean NOT NULL DEFAULT true,
  playback_updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '8 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.watch_party_room_members (
  room_id uuid NOT NULL REFERENCES public.watch_party_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('host', 'guest')),
  state text NOT NULL DEFAULT 'joined' CHECK (state IN ('joined', 'ready', 'left')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  ready_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_watch_party_rooms_host_id
ON public.watch_party_rooms(host_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_watch_party_rooms_room_code
ON public.watch_party_rooms(room_code);

CREATE INDEX IF NOT EXISTS idx_watch_party_room_members_user
ON public.watch_party_room_members(user_id, joined_at DESC);

ALTER TABLE public.watch_party_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_party_room_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Watch party members can view rooms" ON public.watch_party_rooms;
CREATE POLICY "Watch party members can view rooms"
ON public.watch_party_rooms FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.watch_party_room_members AS member
    WHERE member.room_id = watch_party_rooms.id
      AND member.user_id = auth.uid()
      AND member.state <> 'left'
  )
);

DROP POLICY IF EXISTS "Block direct room inserts" ON public.watch_party_rooms;
CREATE POLICY "Block direct room inserts"
ON public.watch_party_rooms FOR INSERT
WITH CHECK (false);

DROP POLICY IF EXISTS "Hosts can update watch party rooms" ON public.watch_party_rooms;
CREATE POLICY "Hosts can update watch party rooms"
ON public.watch_party_rooms FOR UPDATE
USING (host_id = auth.uid())
WITH CHECK (host_id = auth.uid());

DROP POLICY IF EXISTS "Hosts can delete watch party rooms" ON public.watch_party_rooms;
CREATE POLICY "Hosts can delete watch party rooms"
ON public.watch_party_rooms FOR DELETE
USING (host_id = auth.uid());

DROP POLICY IF EXISTS "Watch party members can view room members" ON public.watch_party_room_members;
CREATE POLICY "Watch party members can view room members"
ON public.watch_party_room_members FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.watch_party_room_members AS member
    WHERE member.room_id = watch_party_room_members.room_id
      AND member.user_id = auth.uid()
      AND member.state <> 'left'
  )
);

DROP POLICY IF EXISTS "Block direct room member inserts" ON public.watch_party_room_members;
CREATE POLICY "Block direct room member inserts"
ON public.watch_party_room_members FOR INSERT
WITH CHECK (false);

DROP POLICY IF EXISTS "Members can update own room membership" ON public.watch_party_room_members;
CREATE POLICY "Members can update own room membership"
ON public.watch_party_room_members FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Members can delete own room membership" ON public.watch_party_room_members;
CREATE POLICY "Members can delete own room membership"
ON public.watch_party_room_members FOR DELETE
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_watch_party_room_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_watch_party_room_updated_at ON public.watch_party_rooms;
CREATE TRIGGER trg_touch_watch_party_room_updated_at
BEFORE UPDATE ON public.watch_party_rooms
FOR EACH ROW
EXECUTE FUNCTION public.touch_watch_party_room_updated_at();

CREATE OR REPLACE FUNCTION public.generate_watch_party_room_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  candidate text;
BEGIN
  LOOP
    candidate := upper(substring(md5(gen_random_uuid()::text) FROM 1 FOR 6));
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.watch_party_rooms AS room
      WHERE room.room_code = candidate
    );
  END LOOP;

  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_watch_party_room(
  p_tmdb_id text,
  p_media_type text,
  p_season integer DEFAULT NULL,
  p_episode integer DEFAULT NULL,
  p_title text DEFAULT NULL
)
RETURNS SETOF public.watch_party_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  new_room public.watch_party_rooms%ROWTYPE;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NULLIF(btrim(COALESCE(p_tmdb_id, '')), '') IS NULL THEN
    RAISE EXCEPTION 'TMDB id is required';
  END IF;

  IF LOWER(NULLIF(btrim(COALESCE(p_media_type, '')), '')) NOT IN ('movie', 'tv') THEN
    RAISE EXCEPTION 'Invalid media type';
  END IF;

  INSERT INTO public.watch_party_rooms (
    room_code,
    host_id,
    tmdb_id,
    media_type,
    season,
    episode,
    title
  )
  VALUES (
    public.generate_watch_party_room_code(),
    requester_id,
    btrim(p_tmdb_id),
    LOWER(btrim(p_media_type)),
    CASE WHEN LOWER(btrim(p_media_type)) = 'tv' THEN COALESCE(p_season, 1) ELSE NULL END,
    CASE WHEN LOWER(btrim(p_media_type)) = 'tv' THEN COALESCE(p_episode, 1) ELSE NULL END,
    NULLIF(btrim(COALESCE(p_title, '')), '')
  )
  RETURNING *
  INTO new_room;

  INSERT INTO public.watch_party_room_members (
    room_id,
    user_id,
    role,
    state,
    ready_at
  )
  VALUES (
    new_room.id,
    requester_id,
    'host',
    'ready',
    now()
  )
  ON CONFLICT (room_id, user_id) DO UPDATE
  SET
    role = 'host',
    state = 'ready',
    ready_at = now(),
    last_seen_at = now();

  RETURN NEXT new_room;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_watch_party_room(
  p_room_code text
)
RETURNS SETOF public.watch_party_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  target_room public.watch_party_rooms%ROWTYPE;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO target_room
  FROM public.watch_party_rooms AS room
  WHERE room.room_code = upper(NULLIF(btrim(COALESCE(p_room_code, '')), ''))
    AND room.status <> 'ended'
    AND room.expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  INSERT INTO public.watch_party_room_members (
    room_id,
    user_id,
    role,
    state
  )
  VALUES (
    target_room.id,
    requester_id,
    CASE WHEN requester_id = target_room.host_id THEN 'host' ELSE 'guest' END,
    'joined'
  )
  ON CONFLICT (room_id, user_id) DO UPDATE
  SET
    state = 'joined',
    last_seen_at = now();

  RETURN NEXT target_room;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_watch_party_room_members(
  p_room_id uuid
)
RETURNS TABLE (
  room_id uuid,
  user_id uuid,
  role text,
  state text,
  joined_at timestamptz,
  ready_at timestamptz,
  last_seen_at timestamptz,
  profile jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    member.room_id,
    member.user_id,
    member.role,
    member.state,
    member.joined_at,
    member.ready_at,
    member.last_seen_at,
    jsonb_build_object(
      'id', profile.id,
      'username', profile.username,
      'avatar_url', profile.avatar_url,
      'created_at', profile.created_at
    ) AS profile
  FROM public.watch_party_room_members AS member
  JOIN public.profiles AS profile
    ON profile.id = member.user_id
  WHERE member.room_id = p_room_id
    AND EXISTS (
      SELECT 1
      FROM public.watch_party_room_members AS requester
      WHERE requester.room_id = p_room_id
        AND requester.user_id = auth.uid()
        AND requester.state <> 'left'
    )
  ORDER BY
    CASE WHEN member.role = 'host' THEN 0 ELSE 1 END,
    member.joined_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.update_watch_party_selected_source(
  p_room_id uuid,
  p_provider_id text,
  p_provider_label text,
  p_server_id text DEFAULT NULL,
  p_server_label text DEFAULT NULL,
  p_selected_source jsonb DEFAULT NULL,
  p_source_state text DEFAULT 'portable',
  p_status text DEFAULT 'ready'
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
    provider_id = NULLIF(btrim(COALESCE(p_provider_id, '')), ''),
    provider_label = NULLIF(btrim(COALESCE(p_provider_label, '')), ''),
    server_id = NULLIF(btrim(COALESCE(p_server_id, '')), ''),
    server_label = NULLIF(btrim(COALESCE(p_server_label, '')), ''),
    selected_source = p_selected_source,
    source_state = LOWER(NULLIF(btrim(COALESCE(p_source_state, 'portable')), '')),
    status = LOWER(NULLIF(btrim(COALESCE(p_status, 'ready')), ''))
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

CREATE OR REPLACE FUNCTION public.set_watch_party_member_ready(
  p_room_id uuid,
  p_is_ready boolean DEFAULT true
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
    state = CASE WHEN COALESCE(p_is_ready, true) THEN 'ready' ELSE 'joined' END,
    ready_at = CASE WHEN COALESCE(p_is_ready, true) THEN now() ELSE NULL END,
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
  updated_room public.watch_party_rooms%ROWTYPE;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.watch_party_rooms AS room
  SET
    current_time_seconds = COALESCE(p_current_time_seconds, room.current_time_seconds),
    is_paused = COALESCE(p_is_paused, room.is_paused),
    status = COALESCE(LOWER(NULLIF(btrim(COALESCE(p_status, '')), '')), room.status),
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

REVOKE ALL ON FUNCTION public.generate_watch_party_room_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_watch_party_room_code() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_watch_party_room(text, text, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_watch_party_room(text, text, integer, integer, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.join_watch_party_room(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_watch_party_room(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.list_watch_party_room_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_watch_party_room_members(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.update_watch_party_selected_source(uuid, text, text, text, text, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_watch_party_selected_source(uuid, text, text, text, text, jsonb, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.set_watch_party_member_ready(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_watch_party_member_ready(uuid, boolean) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.update_watch_party_playback(uuid, double precision, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_watch_party_playback(uuid, double precision, boolean, text) TO authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'watch_party_rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_party_rooms;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'watch_party_room_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_party_room_members;
  END IF;
END
$$;
