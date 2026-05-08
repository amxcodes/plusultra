DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'direct_message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_message_reactions;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'direct_message_typing_presence'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_message_typing_presence;
  END IF;
END;
$$;
