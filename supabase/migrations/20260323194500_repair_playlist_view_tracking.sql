-- Repair playlist analytics pollution and harden track_playlist_view.

CREATE OR REPLACE FUNCTION public.track_playlist_view(p_playlist_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_analytics jsonb;
  current_week text;
  current_month text;
  stored_week text;
  stored_month text;
  new_analytics jsonb;
  requester_id uuid := auth.uid();
  last_viewer jsonb;
  last_timestamp bigint := 0;
  six_hours_ago bigint := extract(epoch from (now() - interval '6 hours'))::bigint;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT analytics
  INTO current_analytics
  FROM public.playlists
  WHERE id = p_playlist_id
  FOR UPDATE;

  IF current_analytics IS NULL THEN
    RETURN;
  END IF;

  SELECT viewer
  INTO last_viewer
  FROM jsonb_array_elements(COALESCE(current_analytics->'last_viewers', '[]'::jsonb)) viewer
  WHERE viewer->>'user_id' = requester_id::text
  ORDER BY COALESCE((viewer->>'timestamp')::bigint, 0) DESC
  LIMIT 1;

  IF last_viewer IS NOT NULL THEN
    last_timestamp := COALESCE((last_viewer->>'timestamp')::bigint, 0);
    IF last_timestamp >= six_hours_ago THEN
      RETURN;
    END IF;
  END IF;

  current_week := to_char(now(), 'IYYY-IW');
  current_month := to_char(now(), 'YYYY-MM');
  stored_week := current_analytics->>'week_start';
  stored_month := current_analytics->>'month_start';

  new_analytics := jsonb_build_object(
    'total_views', COALESCE((current_analytics->>'total_views')::int, 0) + 1,
    'weekly_views', CASE WHEN stored_week = current_week THEN COALESCE((current_analytics->>'weekly_views')::int, 0) + 1 ELSE 1 END,
    'monthly_views', CASE WHEN stored_month = current_month THEN COALESCE((current_analytics->>'monthly_views')::int, 0) + 1 ELSE 1 END,
    'week_start', current_week,
    'month_start', current_month,
    'last_viewers', (
      SELECT jsonb_agg(viewer ORDER BY (viewer->>'timestamp')::bigint DESC)
      FROM (
        SELECT viewer
        FROM jsonb_array_elements(COALESCE(current_analytics->'last_viewers', '[]'::jsonb)) viewer
        WHERE viewer->>'user_id' <> requester_id::text
        UNION ALL
        SELECT jsonb_build_object('user_id', requester_id::text, 'timestamp', extract(epoch from now())::bigint)
        LIMIT 10
      ) viewers
    )
  );

  UPDATE public.playlists
  SET analytics = new_analytics
  WHERE id = p_playlist_id;
END;
$$;

WITH normalized AS (
  SELECT
    p.id,
    jsonb_build_object(
      'total_views', GREATEST(COALESCE((p.analytics->>'total_views')::int, 0), 0),
      'weekly_views',
        CASE
          WHEN p.analytics->>'week_start' = to_char(now(), 'IYYY-IW')
            THEN GREATEST(COALESCE((p.analytics->>'weekly_views')::int, 0), 0)
          ELSE 0
        END,
      'monthly_views',
        CASE
          WHEN p.analytics->>'month_start' = to_char(now(), 'YYYY-MM')
            THEN GREATEST(COALESCE((p.analytics->>'monthly_views')::int, 0), 0)
          ELSE 0
        END,
      'week_start', to_char(now(), 'IYYY-IW'),
      'month_start', to_char(now(), 'YYYY-MM'),
      'last_viewers',
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'user_id', dedup.user_id,
                'timestamp', dedup.last_timestamp
              )
              ORDER BY dedup.last_timestamp DESC
            )
            FROM (
              SELECT
                viewer->>'user_id' AS user_id,
                MAX(COALESCE((viewer->>'timestamp')::bigint, 0)) AS last_timestamp
              FROM jsonb_array_elements(COALESCE(p.analytics->'last_viewers', '[]'::jsonb)) viewer
              WHERE viewer ? 'user_id'
                AND COALESCE(viewer->>'user_id', '') <> ''
              GROUP BY viewer->>'user_id'
              ORDER BY MAX(COALESCE((viewer->>'timestamp')::bigint, 0)) DESC
              LIMIT 10
            ) dedup
          ),
          '[]'::jsonb
        )
    ) AS analytics
  FROM public.playlists p
)
UPDATE public.playlists p
SET analytics = normalized.analytics
FROM normalized
WHERE p.id = normalized.id;
