ALTER TABLE public.watch_party_source_candidates
ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE OR REPLACE FUNCTION public.upsert_watch_party_source_candidate(
  p_room_id uuid,
  p_candidate_id text,
  p_provider_id text,
  p_provider_label text DEFAULT NULL,
  p_server_id text DEFAULT NULL,
  p_server_label text DEFAULT NULL,
  p_resolved_url text DEFAULT NULL,
  p_source_type text DEFAULT 'unknown',
  p_quality_label text DEFAULT NULL,
  p_required_headers jsonb DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL,
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
    quality_label,
    required_headers,
    expires_at,
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
    NULLIF(btrim(COALESCE(p_quality_label, '')), ''),
    p_required_headers,
    p_expires_at,
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
    quality_label = EXCLUDED.quality_label,
    required_headers = EXCLUDED.required_headers,
    expires_at = EXCLUDED.expires_at,
    portability = EXCLUDED.portability,
    status = EXCLUDED.status,
    note = EXCLUDED.note,
    discovered_by = EXCLUDED.discovered_by
  RETURNING *
  INTO row_out;

  RETURN NEXT row_out;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_watch_party_source_candidate(uuid, text, text, text, text, text, text, text, text, jsonb, timestamptz, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_watch_party_source_candidate(uuid, text, text, text, text, text, text, text, text, jsonb, timestamptz, text, text, text) TO authenticated, service_role;
