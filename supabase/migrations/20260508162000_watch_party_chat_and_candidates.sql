CREATE TABLE IF NOT EXISTS public.watch_party_source_candidates (
  room_id uuid NOT NULL REFERENCES public.watch_party_rooms(id) ON DELETE CASCADE,
  candidate_id text NOT NULL,
  provider_id text NOT NULL,
  provider_label text,
  server_id text,
  server_label text,
  resolved_url text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('mp4', 'm3u8', 'mpd', 'unknown')),
  portability text NOT NULL CHECK (portability IN ('pending', 'portable', 'guest_recheck', 'host_only')),
  status text NOT NULL DEFAULT 'discovered' CHECK (status IN ('discovered', 'selected', 'failed')),
  note text,
  discovered_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, candidate_id)
);

CREATE TABLE IF NOT EXISTS public.watch_party_room_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.watch_party_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_watch_party_source_candidates_room
ON public.watch_party_source_candidates(room_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_watch_party_room_messages_room
ON public.watch_party_room_messages(room_id, created_at DESC);

ALTER TABLE public.watch_party_source_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_party_room_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Watch party members can view source candidates" ON public.watch_party_source_candidates;
CREATE POLICY "Watch party members can view source candidates"
ON public.watch_party_source_candidates FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.watch_party_room_members AS member
    WHERE member.room_id = watch_party_source_candidates.room_id
      AND member.user_id = auth.uid()
      AND member.state <> 'left'
  )
);

DROP POLICY IF EXISTS "Block direct candidate inserts" ON public.watch_party_source_candidates;
CREATE POLICY "Block direct candidate inserts"
ON public.watch_party_source_candidates FOR INSERT
WITH CHECK (false);

DROP POLICY IF EXISTS "Block direct candidate updates" ON public.watch_party_source_candidates;
CREATE POLICY "Block direct candidate updates"
ON public.watch_party_source_candidates FOR UPDATE
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "Watch party members can view room messages" ON public.watch_party_room_messages;
CREATE POLICY "Watch party members can view room messages"
ON public.watch_party_room_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.watch_party_room_members AS member
    WHERE member.room_id = watch_party_room_messages.room_id
      AND member.user_id = auth.uid()
      AND member.state <> 'left'
  )
);

DROP POLICY IF EXISTS "Block direct room message inserts" ON public.watch_party_room_messages;
CREATE POLICY "Block direct room message inserts"
ON public.watch_party_room_messages FOR INSERT
WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.touch_watch_party_candidate_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_watch_party_candidate_updated_at ON public.watch_party_source_candidates;
CREATE TRIGGER trg_touch_watch_party_candidate_updated_at
BEFORE UPDATE ON public.watch_party_source_candidates
FOR EACH ROW
EXECUTE FUNCTION public.touch_watch_party_candidate_updated_at();

CREATE OR REPLACE FUNCTION public.upsert_watch_party_source_candidate(
  p_room_id uuid,
  p_candidate_id text,
  p_provider_id text,
  p_provider_label text DEFAULT NULL,
  p_server_id text DEFAULT NULL,
  p_server_label text DEFAULT NULL,
  p_resolved_url text DEFAULT NULL,
  p_source_type text DEFAULT 'unknown',
  p_portability text DEFAULT 'pending',
  p_status text DEFAULT 'discovered',
  p_note text DEFAULT NULL
)
RETURNS SETOF public.watch_party_source_candidates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  room_host_id uuid;
  row_out public.watch_party_source_candidates%ROWTYPE;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT room.host_id
  INTO room_host_id
  FROM public.watch_party_rooms AS room
  WHERE room.id = p_room_id;

  IF room_host_id IS NULL OR room_host_id <> requester_id THEN
    RAISE EXCEPTION 'Room not found or not editable';
  END IF;

  INSERT INTO public.watch_party_source_candidates (
    room_id,
    candidate_id,
    provider_id,
    provider_label,
    server_id,
    server_label,
    resolved_url,
    source_type,
    portability,
    status,
    note,
    discovered_by
  )
  VALUES (
    p_room_id,
    btrim(p_candidate_id),
    btrim(p_provider_id),
    NULLIF(btrim(COALESCE(p_provider_label, '')), ''),
    NULLIF(btrim(COALESCE(p_server_id, '')), ''),
    NULLIF(btrim(COALESCE(p_server_label, '')), ''),
    btrim(COALESCE(p_resolved_url, '')),
    LOWER(NULLIF(btrim(COALESCE(p_source_type, 'unknown')), '')),
    LOWER(NULLIF(btrim(COALESCE(p_portability, 'pending')), '')),
    LOWER(NULLIF(btrim(COALESCE(p_status, 'discovered')), '')),
    NULLIF(btrim(COALESCE(p_note, '')), ''),
    requester_id
  )
  ON CONFLICT (room_id, candidate_id) DO UPDATE
  SET
    provider_id = EXCLUDED.provider_id,
    provider_label = EXCLUDED.provider_label,
    server_id = EXCLUDED.server_id,
    server_label = EXCLUDED.server_label,
    resolved_url = EXCLUDED.resolved_url,
    source_type = EXCLUDED.source_type,
    portability = EXCLUDED.portability,
    status = EXCLUDED.status,
    note = EXCLUDED.note,
    discovered_by = EXCLUDED.discovered_by
  RETURNING *
  INTO row_out;

  RETURN NEXT row_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_watch_party_source_candidates(
  p_room_id uuid
)
RETURNS SETOF public.watch_party_source_candidates
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT candidate.*
  FROM public.watch_party_source_candidates AS candidate
  WHERE candidate.room_id = p_room_id
    AND EXISTS (
      SELECT 1
      FROM public.watch_party_room_members AS requester
      WHERE requester.room_id = p_room_id
        AND requester.user_id = auth.uid()
        AND requester.state <> 'left'
    )
  ORDER BY
    CASE candidate.status WHEN 'selected' THEN 0 WHEN 'discovered' THEN 1 ELSE 2 END,
    candidate.updated_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.send_watch_party_room_message(
  p_room_id uuid,
  p_body text
)
RETURNS SETOF public.watch_party_room_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  row_out public.watch_party_room_messages%ROWTYPE;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NULLIF(btrim(COALESCE(p_body, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Message is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.watch_party_room_members AS member
    WHERE member.room_id = p_room_id
      AND member.user_id = requester_id
      AND member.state <> 'left'
  ) THEN
    RAISE EXCEPTION 'Room membership not found';
  END IF;

  INSERT INTO public.watch_party_room_messages (
    room_id,
    sender_id,
    body
  )
  VALUES (
    p_room_id,
    requester_id,
    left(btrim(p_body), 1200)
  )
  RETURNING *
  INTO row_out;

  RETURN NEXT row_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_watch_party_room_messages(
  p_room_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  room_id uuid,
  sender_id uuid,
  body text,
  created_at timestamptz,
  profile jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    message.id,
    message.room_id,
    message.sender_id,
    message.body,
    message.created_at,
    jsonb_build_object(
      'id', profile.id,
      'username', profile.username,
      'avatar_url', profile.avatar_url,
      'created_at', profile.created_at
    ) AS profile
  FROM public.watch_party_room_messages AS message
  JOIN public.profiles AS profile
    ON profile.id = message.sender_id
  WHERE message.room_id = p_room_id
    AND EXISTS (
      SELECT 1
      FROM public.watch_party_room_members AS requester
      WHERE requester.room_id = p_room_id
        AND requester.user_id = auth.uid()
        AND requester.state <> 'left'
    )
  ORDER BY message.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
$$;

REVOKE ALL ON FUNCTION public.upsert_watch_party_source_candidate(uuid, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_watch_party_source_candidate(uuid, text, text, text, text, text, text, text, text, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.list_watch_party_source_candidates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_watch_party_source_candidates(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.send_watch_party_room_message(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_watch_party_room_message(uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.list_watch_party_room_messages(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_watch_party_room_messages(uuid, integer) TO authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'watch_party_source_candidates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_party_source_candidates;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'watch_party_room_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_party_room_messages;
  END IF;
END
$$;
