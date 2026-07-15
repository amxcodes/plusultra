-- BUFFERED CLIENT ANALYTICS EVENTS
-- Low-volume append-only event pipe for player/search/download funnels.
-- High-frequency playback heartbeats remain in view_sessions/provider_attempts.

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id text NOT NULL,
  event_name text NOT NULL,
  event_category text NOT NULL DEFAULT 'general',
  session_id text,
  attempt_id text,
  tmdb_id text,
  media_type text CHECK (media_type IS NULL OR media_type IN ('movie', 'tv', 'sports')),
  season integer,
  episode integer,
  provider_id text,
  page_path text,
  client_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_recent
  ON public.analytics_events(user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_category_recent
  ON public.analytics_events(event_category, event_name, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_provider_recent
  ON public.analytics_events(provider_id, occurred_at DESC)
  WHERE provider_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_events_content_recent
  ON public.analytics_events(tmdb_id, media_type, occurred_at DESC)
  WHERE tmdb_id IS NOT NULL;

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own analytics events" ON public.analytics_events;
CREATE POLICY "Users can view their own analytics events"
  ON public.analytics_events FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.record_analytics_events(
  p_events jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  inserted_count integer := 0;
  event_item jsonb;
  safe_payload jsonb;
  safe_context jsonb;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF jsonb_typeof(p_events) <> 'array' THEN
    RAISE EXCEPTION 'Events payload must be an array';
  END IF;

  FOR event_item IN
    SELECT value
    FROM jsonb_array_elements(p_events)
    LIMIT 50
  LOOP
    IF COALESCE(event_item->>'eventId', '') = '' OR COALESCE(event_item->>'eventName', '') = '' THEN
      CONTINUE;
    END IF;

    safe_payload := COALESCE(event_item->'payload', '{}'::jsonb);
    safe_context := COALESCE(event_item->'clientContext', '{}'::jsonb);

    INSERT INTO public.analytics_events (
      user_id,
      event_id,
      event_name,
      event_category,
      session_id,
      attempt_id,
      tmdb_id,
      media_type,
      season,
      episode,
      provider_id,
      page_path,
      client_context,
      payload,
      occurred_at
    )
    VALUES (
      current_user_id,
      left(event_item->>'eventId', 160),
      left(event_item->>'eventName', 120),
      left(COALESCE(NULLIF(event_item->>'eventCategory', ''), 'general'), 80),
      NULLIF(left(COALESCE(event_item->>'sessionId', ''), 160), ''),
      NULLIF(left(COALESCE(event_item->>'attemptId', ''), 160), ''),
      NULLIF(left(COALESCE(event_item->>'tmdbId', ''), 80), ''),
      NULLIF(left(COALESCE(event_item->>'mediaType', ''), 20), ''),
      CASE WHEN event_item ? 'season' THEN NULLIF(event_item->>'season', '')::integer ELSE NULL END,
      CASE WHEN event_item ? 'episode' THEN NULLIF(event_item->>'episode', '')::integer ELSE NULL END,
      NULLIF(left(COALESCE(event_item->>'providerId', ''), 120), ''),
      NULLIF(left(COALESCE(event_item->>'pagePath', ''), 240), ''),
      safe_context,
      safe_payload,
      COALESCE(NULLIF(event_item->>'occurredAt', '')::timestamptz, now())
    )
    ON CONFLICT (user_id, event_id) DO NOTHING;

    IF FOUND THEN
      inserted_count := inserted_count + 1;
    END IF;
  END LOOP;

  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.record_analytics_events(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.record_analytics_events(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_analytics_events(jsonb) TO service_role;
