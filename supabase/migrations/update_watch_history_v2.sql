-- VERSION 2: update_watch_history_v2
-- This RPC now stores lightweight recent/opened history only.
-- Wrapped and stats are tracked via session heartbeats instead.

CREATE OR REPLACE FUNCTION update_watch_history_v2(
  p_user_id uuid,
  p_tmdb_id text,
  p_data jsonb,
  p_idempotency_key text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  current_history JSONB;
  current_entry JSONB;
  existing_key TEXT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized to update watch history for this user.';
  END IF;

  SELECT watch_history
  INTO current_history
  FROM public.profiles
  WHERE id = p_user_id;

  IF current_history IS NULL THEN
    current_history := '{}'::jsonb;
  END IF;

  current_entry := COALESCE(current_history->p_tmdb_id, '{}'::jsonb);

  IF p_idempotency_key IS NOT NULL THEN
    existing_key := current_entry->>'idempotencyKey';
    IF existing_key = p_idempotency_key THEN
      RETURN;
    END IF;

    p_data := p_data || jsonb_build_object('idempotencyKey', p_idempotency_key);
  END IF;

  current_history := jsonb_set(current_history, array[p_tmdb_id], p_data, true);

  UPDATE public.profiles
  SET
    watch_history = current_history,
    last_seen_activity = now()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION update_watch_history_v2(uuid, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_watch_history_v2(uuid, text, jsonb, text) TO service_role;
