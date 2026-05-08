CREATE OR REPLACE FUNCTION public.list_watch_party_host_presence(
  p_user_ids uuid[]
)
RETURNS TABLE (
  host_id uuid,
  room_id uuid,
  room_code text,
  title text,
  media_type text,
  season integer,
  episode integer,
  status text,
  started_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH target_hosts AS (
    SELECT DISTINCT unnest(p_user_ids) AS user_id
  ),
  ranked_rooms AS (
    SELECT
      room.host_id,
      room.id AS room_id,
      room.room_code,
      room.title,
      room.media_type,
      room.season,
      room.episode,
      room.status,
      COALESCE(room.countdown_started_at, room.playback_updated_at, room.updated_at, room.created_at) AS started_at,
      row_number() OVER (
        PARTITION BY room.host_id
        ORDER BY
          CASE room.status
            WHEN 'live' THEN 0
            WHEN 'ready' THEN 1
            WHEN 'setup' THEN 2
            ELSE 3
          END,
          COALESCE(room.countdown_started_at, room.playback_updated_at, room.updated_at, room.created_at) DESC
      ) AS room_rank
    FROM public.watch_party_rooms AS room
    JOIN target_hosts AS target
      ON target.user_id = room.host_id
    WHERE room.status IN ('setup', 'ready', 'live')
      AND room.expires_at > now()
  )
  SELECT
    ranked.host_id,
    ranked.room_id,
    ranked.room_code,
    ranked.title,
    ranked.media_type,
    ranked.season,
    ranked.episode,
    ranked.status,
    ranked.started_at
  FROM ranked_rooms AS ranked
  WHERE ranked.room_rank = 1;
$$;

REVOKE ALL ON FUNCTION public.list_watch_party_host_presence(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_watch_party_host_presence(uuid[]) TO authenticated, service_role;
