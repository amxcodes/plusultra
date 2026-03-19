-- ONE-TIME REPAIR: Reset polluted wrapped stats state in profiles.stats
--
-- This clears wrapped-specific aggregates that were previously inflated by
-- progress pings and reseeds only the data we can trust from watch_history.
--
-- Important:
-- - total_movies / total_shows / genre_counts are rebuilt conservatively from
--   currently completed history entries.
-- - rewatch_count, monthly_watches, binge_days, title_rewatch_counts, and
--   first_watch_of_year are reset because denormalized watch_history cannot
--   reconstruct them accurately after the old bug.

CREATE OR REPLACE FUNCTION reset_wrapped_stats_state()
RETURNS void AS $$
DECLARE
  user_record RECORD;
  history_item RECORD;
  existing_stats JSONB;
  new_stats JSONB;
  counted_titles JSONB;
  completed_units JSONB;
  genre_counts JSONB;
  latest_last_watched TIMESTAMPTZ;
  item_timestamp TIMESTAMPTZ;
  total_movies INT;
  total_shows INT;
  current_year INT := extract(year from now());
  media_type TEXT;
  title_key TEXT;
  unit_key TEXT;
  genres JSONB;
  genre_name TEXT;
  qualified BOOLEAN;
  item_time NUMERIC;
  item_duration NUMERIC;
BEGIN
  FOR user_record IN
    SELECT id, watch_history, stats
    FROM public.profiles
  LOOP
    existing_stats := COALESCE(user_record.stats, '{}'::jsonb);
    counted_titles := '{}'::jsonb;
    completed_units := '{}'::jsonb;
    genre_counts := '{}'::jsonb;
    latest_last_watched := NULL;
    total_movies := 0;
    total_shows := 0;

    IF user_record.watch_history IS NOT NULL AND user_record.watch_history <> '{}'::jsonb THEN
      FOR history_item IN
        SELECT key, value
        FROM jsonb_each(user_record.watch_history)
      LOOP
        media_type := COALESCE(history_item.value->>'type', 'movie');
        title_key := COALESCE(
          history_item.value->>'wrappedTitleKey',
          format('%s:%s', media_type, history_item.key)
        );
        unit_key := COALESCE(
          history_item.value->>'wrappedUnitKey',
          CASE
            WHEN media_type = 'tv'
              AND history_item.value->>'season' IS NOT NULL
              AND history_item.value->>'episode' IS NOT NULL
            THEN format(
              '%s:%s:s%s:e%s',
              media_type,
              history_item.key,
              history_item.value->>'season',
              history_item.value->>'episode'
            )
            ELSE title_key
          END
        );

        item_time := COALESCE(NULLIF(history_item.value->>'time', '')::numeric, 0);
        item_duration := COALESCE(NULLIF(history_item.value->>'duration', '')::numeric, 0);

        qualified := COALESCE(
          (history_item.value->>'wrappedQualified')::boolean,
          CASE
            WHEN item_duration > 0 THEN item_time >= CEIL(item_duration * 0.8)
            WHEN media_type = 'movie' THEN item_time >= 2700
            ELSE item_time >= 1200
          END
        );

        IF history_item.value->>'lastUpdated' ~ '^[0-9]+$' THEN
          item_timestamp := to_timestamp((history_item.value->>'lastUpdated')::double precision / 1000);
          IF latest_last_watched IS NULL OR item_timestamp > latest_last_watched THEN
            latest_last_watched := item_timestamp;
          END IF;
        END IF;

        IF qualified THEN
          completed_units := jsonb_set(completed_units, array[unit_key], 'true'::jsonb, true);

          IF NOT (counted_titles ? title_key) THEN
            counted_titles := jsonb_set(counted_titles, array[title_key], 'true'::jsonb, true);

            IF media_type = 'movie' THEN
              total_movies := total_movies + 1;
            ELSIF media_type = 'tv' THEN
              total_shows := total_shows + 1;
            END IF;

            genres := COALESCE(history_item.value->'genres', '[]'::jsonb);
            IF jsonb_typeof(genres) = 'array' THEN
              FOR genre_name IN
                SELECT jsonb_array_elements_text(genres)
              LOOP
                genre_counts := jsonb_set(
                  genre_counts,
                  array[genre_name],
                  (COALESCE((genre_counts->>genre_name)::int, 0) + 1)::text::jsonb,
                  true
                );
              END LOOP;
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;

    new_stats := existing_stats;
    new_stats := jsonb_set(new_stats, '{total_movies}', to_jsonb(total_movies), true);
    new_stats := jsonb_set(new_stats, '{total_shows}', to_jsonb(total_shows), true);
    new_stats := jsonb_set(
      new_stats,
      '{streak_days}',
      to_jsonb(COALESCE((existing_stats->>'streak_days')::int, 0)),
      true
    );
    new_stats := jsonb_set(
      new_stats,
      '{last_watched}',
      COALESCE(existing_stats->'last_watched', to_jsonb(latest_last_watched), 'null'::jsonb),
      true
    );
    new_stats := jsonb_set(
      new_stats,
      '{max_streak}',
      to_jsonb(
        GREATEST(
          COALESCE((existing_stats->>'max_streak')::int, 0),
          COALESCE((existing_stats->>'streak_days')::int, 0)
        )
      ),
      true
    );
    new_stats := jsonb_set(new_stats, '{genre_counts}', genre_counts, true);
    new_stats := jsonb_set(new_stats, '{monthly_watches}', '{}'::jsonb, true);
    new_stats := jsonb_set(new_stats, '{first_watch_of_year}', 'null'::jsonb, true);
    new_stats := jsonb_set(new_stats, '{year}', to_jsonb(current_year), true);
    new_stats := jsonb_set(new_stats, '{rewatch_count}', '0'::jsonb, true);
    new_stats := jsonb_set(new_stats, '{binge_days}', '0'::jsonb, true);
    new_stats := jsonb_set(new_stats, '{daily_watch_count}', '{}'::jsonb, true);
    new_stats := jsonb_set(new_stats, '{title_rewatch_counts}', '{}'::jsonb, true);
    new_stats := jsonb_set(new_stats, '{wrapped_counted_titles}', counted_titles, true);
    new_stats := jsonb_set(new_stats, '{wrapped_completed_units}', completed_units, true);
    new_stats := jsonb_set(
      new_stats,
      '{past_years}',
      COALESCE(existing_stats->'past_years', '{}'::jsonb),
      true
    );

    UPDATE public.profiles
    SET stats = new_stats
    WHERE id = user_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT reset_wrapped_stats_state();
DROP FUNCTION reset_wrapped_stats_state();
