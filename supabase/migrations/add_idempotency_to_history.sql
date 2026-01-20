-- Add idempotency key support to update_watch_history
CREATE OR REPLACE FUNCTION update_watch_history(
  p_user_id uuid,
  p_tmdb_id text,
  p_data jsonb,
  p_idempotency_key text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  current_stats JSONB;
  current_history JSONB;
  is_new_item BOOLEAN;
  media_type TEXT;
  previous_last_watched TIMESTAMPTZ;
  days_since_last_watch INT;
  current_streak INT;
  existing_key TEXT;
  msg TEXT;
BEGIN
  -- 1. Fetch current data in ONE query
  SELECT watch_history, stats INTO current_history, current_stats 
  FROM public.profiles WHERE id = p_user_id;

  -- 2. Initialize defaults
  IF current_history IS NULL THEN current_history := '{}'::jsonb; END IF;
  IF current_stats IS NULL THEN 
    current_stats := '{"total_movies": 0, "total_shows": 0, "streak_days": 0, "genre_counts": {}}'::jsonb; 
  END IF;

  -- 3. IDEMPOTENCY CHECK
  -- If we have an idempotency key, check if this specific update was already processed
  IF p_idempotency_key IS NOT NULL THEN
    existing_key := current_history->p_tmdb_id->>'idempotencyKey';
    IF existing_key = p_idempotency_key THEN
      -- Already processed, return success silently
      RETURN;
    END IF;
    
    -- Inject key into data to be saved
    p_data := p_data || jsonb_build_object('idempotencyKey', p_idempotency_key);
  END IF;

  -- 4. Extract media type from the data being saved
  media_type := p_data->>'type';

  -- 5. Check if new item
  is_new_item := NOT (current_history ? p_tmdb_id);

  -- 6. Update watch history
  current_history := jsonb_set(current_history, array[p_tmdb_id], p_data);

  -- 7. Update stats ONLY if new item
  IF is_new_item THEN
    IF media_type = 'movie' THEN
      current_stats := jsonb_set(current_stats, '{total_movies}', 
        ((current_stats->>'total_movies')::int + 1)::text::jsonb);
    ELSIF media_type = 'tv' THEN
      current_stats := jsonb_set(current_stats, '{total_shows}', 
        ((current_stats->>'total_shows')::int + 1)::text::jsonb);
    END IF;
  END IF;

  -- 8. Calculate streak (inlined for performance)
  previous_last_watched := (current_stats->>'last_watched')::timestamptz;
  current_streak := COALESCE((current_stats->>'streak_days')::int, 0);
  
  IF previous_last_watched IS NULL THEN
    current_streak := 1;
  ELSE
    days_since_last_watch := EXTRACT(DAY FROM (CURRENT_DATE - DATE(previous_last_watched)));
    
    IF days_since_last_watch = 0 THEN
      current_streak := current_streak; -- Same day, no change
    ELSIF days_since_last_watch = 1 THEN
      current_streak := current_streak + 1; -- Consecutive
    ELSE
      current_streak := 1; -- Reset
    END IF;
  END IF;
  
  current_stats := jsonb_set(current_stats, '{streak_days}', current_streak::text::jsonb);
  current_stats := jsonb_set(current_stats, '{last_watched}', to_jsonb(now()));

  -- 9. SINGLE ATOMIC UPDATE
  UPDATE public.profiles
  SET 
    watch_history = current_history,
    stats = current_stats,
    last_seen_activity = now()
  WHERE id = p_user_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
