ALTER TABLE public.direct_messages
ADD COLUMN IF NOT EXISTS reply_to_message_id uuid
REFERENCES public.direct_messages(id) ON DELETE SET NULL;

DROP FUNCTION IF EXISTS public.list_direct_messages(uuid, integer);
DROP FUNCTION IF EXISTS public.send_direct_message(uuid, text, text, jsonb);
DROP FUNCTION IF EXISTS public.send_direct_message(uuid, text, text, jsonb, uuid);

CREATE INDEX IF NOT EXISTS idx_direct_messages_reply_to_message
ON public.direct_messages(reply_to_message_id)
WHERE reply_to_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.direct_message_reactions (
  message_id uuid NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.direct_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (char_length(btrim(emoji)) BETWEEN 1 AND 16),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_direct_message_reactions_conversation
ON public.direct_message_reactions(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_direct_message_reactions_message
ON public.direct_message_reactions(message_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.direct_message_typing_presence (
  conversation_id uuid NOT NULL REFERENCES public.direct_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_direct_message_typing_presence_updated_at
ON public.direct_message_typing_presence(conversation_id, updated_at DESC);

ALTER TABLE public.direct_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_message_typing_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view direct message reactions" ON public.direct_message_reactions;
DROP POLICY IF EXISTS "Block direct message reaction inserts" ON public.direct_message_reactions;
DROP POLICY IF EXISTS "Block direct message reaction updates" ON public.direct_message_reactions;
DROP POLICY IF EXISTS "Block direct message reaction deletes" ON public.direct_message_reactions;

CREATE POLICY "Participants can view direct message reactions"
ON public.direct_message_reactions FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.direct_conversations conversation
    WHERE conversation.id = direct_message_reactions.conversation_id
      AND (auth.uid() = conversation.user_a OR auth.uid() = conversation.user_b)
  )
);

CREATE POLICY "Block direct message reaction inserts"
ON public.direct_message_reactions FOR INSERT
WITH CHECK (false);

CREATE POLICY "Block direct message reaction updates"
ON public.direct_message_reactions FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "Block direct message reaction deletes"
ON public.direct_message_reactions FOR DELETE
USING (false);

DROP POLICY IF EXISTS "Participants can view direct message typing" ON public.direct_message_typing_presence;
DROP POLICY IF EXISTS "Block direct message typing inserts" ON public.direct_message_typing_presence;
DROP POLICY IF EXISTS "Block direct message typing updates" ON public.direct_message_typing_presence;
DROP POLICY IF EXISTS "Block direct message typing deletes" ON public.direct_message_typing_presence;

CREATE POLICY "Participants can view direct message typing"
ON public.direct_message_typing_presence FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.direct_conversations conversation
    WHERE conversation.id = direct_message_typing_presence.conversation_id
      AND (auth.uid() = conversation.user_a OR auth.uid() = conversation.user_b)
  )
);

CREATE POLICY "Block direct message typing inserts"
ON public.direct_message_typing_presence FOR INSERT
WITH CHECK (false);

CREATE POLICY "Block direct message typing updates"
ON public.direct_message_typing_presence FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "Block direct message typing deletes"
ON public.direct_message_typing_presence FOR DELETE
USING (false);

CREATE OR REPLACE FUNCTION public.list_direct_messages(
  p_conversation_id uuid,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  recipient_id uuid,
  message_type text,
  body text,
  shared_movie jsonb,
  created_at timestamptz,
  read_at timestamptz,
  reply_to_message_id uuid,
  reply_preview jsonb,
  reactions jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM (
    SELECT
      message.id,
      message.conversation_id,
      message.sender_id,
      message.recipient_id,
      message.message_type,
      message.body,
      message.shared_movie,
      message.created_at,
      message.read_at,
      message.reply_to_message_id,
      CASE
        WHEN replied.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', replied.id,
          'sender_id', replied.sender_id,
          'body', replied.body,
          'message_type', replied.message_type,
          'shared_movie_title', COALESCE(replied.shared_movie ->> 'title', NULL)
        )
      END AS reply_preview,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'message_id', reaction.message_id,
            'conversation_id', reaction.conversation_id,
            'user_id', reaction.user_id,
            'emoji', reaction.emoji,
            'created_at', reaction.created_at
          )
          ORDER BY reaction.created_at ASC
        )
        FROM public.direct_message_reactions reaction
        WHERE reaction.message_id = message.id
      ), '[]'::jsonb) AS reactions
    FROM public.direct_messages message
    JOIN public.direct_conversations conversation
      ON conversation.id = message.conversation_id
    LEFT JOIN public.direct_messages replied
      ON replied.id = message.reply_to_message_id
    WHERE auth.uid() IS NOT NULL
      AND message.conversation_id = p_conversation_id
      AND (conversation.user_a = auth.uid() OR conversation.user_b = auth.uid())
    ORDER BY message.created_at DESC
    LIMIT GREATEST(COALESCE(p_limit, 100), 1)
  ) recent_messages
  ORDER BY recent_messages.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.send_direct_message(
  p_other_user_id uuid,
  p_body text DEFAULT NULL,
  p_message_type text DEFAULT 'text',
  p_shared_movie jsonb DEFAULT NULL,
  p_reply_to_message_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  recipient_id uuid,
  message_type text,
  body text,
  shared_movie jsonb,
  created_at timestamptz,
  read_at timestamptz,
  reply_to_message_id uuid,
  reply_preview jsonb,
  reactions jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  safe_message_type text := LOWER(NULLIF(btrim(COALESCE(p_message_type, 'text')), ''));
  safe_body text := NULLIF(btrim(COALESCE(p_body, '')), '');
  conversation_record record;
  reply_record record;
  next_preview text;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF safe_message_type NOT IN ('text', 'movie_share') THEN
    RAISE EXCEPTION 'Invalid message type';
  END IF;

  IF NOT public.are_mutual_followers(requester_id, p_other_user_id) THEN
    RAISE EXCEPTION 'Only mutual followers can message each other';
  END IF;

  IF safe_message_type = 'text' AND safe_body IS NULL THEN
    RAISE EXCEPTION 'Message body is required';
  END IF;

  IF safe_message_type = 'movie_share' AND p_shared_movie IS NULL THEN
    RAISE EXCEPTION 'A shared movie payload is required';
  END IF;

  SELECT *
  INTO conversation_record
  FROM public.get_or_create_direct_conversation(p_other_user_id)
  LIMIT 1;

  IF p_reply_to_message_id IS NOT NULL THEN
    SELECT
      message.id,
      message.sender_id,
      message.body,
      message.message_type,
      COALESCE(message.shared_movie ->> 'title', NULL) AS shared_movie_title
    INTO reply_record
    FROM public.direct_messages message
    WHERE message.id = p_reply_to_message_id
      AND message.conversation_id = conversation_record.id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Reply target not found in this conversation';
    END IF;
  END IF;

  next_preview := CASE
    WHEN safe_message_type = 'movie_share' AND safe_body IS NOT NULL THEN LEFT(safe_body, 120)
    WHEN safe_message_type = 'movie_share' THEN 'Shared a title'
    ELSE LEFT(safe_body, 120)
  END;

  UPDATE public.direct_conversations
  SET
    updated_at = now(),
    last_message_at = now(),
    last_message_preview = next_preview,
    last_message_sender_id = requester_id
  WHERE direct_conversations.id = conversation_record.id;

  RETURN QUERY
  WITH inserted AS (
    INSERT INTO public.direct_messages (
      conversation_id,
      sender_id,
      recipient_id,
      message_type,
      body,
      shared_movie,
      reply_to_message_id
    )
    VALUES (
      conversation_record.id,
      requester_id,
      p_other_user_id,
      safe_message_type,
      safe_body,
      p_shared_movie,
      p_reply_to_message_id
    )
    RETURNING
      direct_messages.id,
      direct_messages.conversation_id,
      direct_messages.sender_id,
      direct_messages.recipient_id,
      direct_messages.message_type,
      direct_messages.body,
      direct_messages.shared_movie,
      direct_messages.created_at,
      direct_messages.read_at,
      direct_messages.reply_to_message_id
  )
  SELECT
    inserted.id,
    inserted.conversation_id,
    inserted.sender_id,
    inserted.recipient_id,
    inserted.message_type,
    inserted.body,
    inserted.shared_movie,
    inserted.created_at,
    inserted.read_at,
    inserted.reply_to_message_id,
    CASE
      WHEN reply_record.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', reply_record.id,
        'sender_id', reply_record.sender_id,
        'body', reply_record.body,
        'message_type', reply_record.message_type,
        'shared_movie_title', reply_record.shared_movie_title
      )
    END AS reply_preview,
    '[]'::jsonb AS reactions
  FROM inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_direct_message_reaction(
  p_message_id uuid,
  p_emoji text
)
RETURNS TABLE (
  message_id uuid,
  emoji text,
  active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  safe_emoji text := NULLIF(btrim(COALESCE(p_emoji, '')), '');
  message_record record;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF safe_emoji IS NULL OR char_length(safe_emoji) > 16 THEN
    RAISE EXCEPTION 'Invalid reaction';
  END IF;

  SELECT
    message.id,
    message.conversation_id
  INTO message_record
  FROM public.direct_messages message
  JOIN public.direct_conversations conversation
    ON conversation.id = message.conversation_id
  WHERE message.id = p_message_id
    AND (conversation.user_a = requester_id OR conversation.user_b = requester_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.direct_message_reactions reaction
    WHERE reaction.message_id = p_message_id
      AND reaction.user_id = requester_id
      AND reaction.emoji = safe_emoji
  ) THEN
    DELETE FROM public.direct_message_reactions
    WHERE message_id = p_message_id
      AND user_id = requester_id
      AND emoji = safe_emoji;

    RETURN QUERY
    SELECT p_message_id, safe_emoji, false;
    RETURN;
  END IF;

  INSERT INTO public.direct_message_reactions (
    message_id,
    conversation_id,
    user_id,
    emoji
  )
  VALUES (
    p_message_id,
    message_record.conversation_id,
    requester_id,
    safe_emoji
  );

  RETURN QUERY
  SELECT p_message_id, safe_emoji, true;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_direct_message_typing(
  p_conversation_id uuid,
  p_is_typing boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.direct_conversations conversation
    WHERE conversation.id = p_conversation_id
      AND (conversation.user_a = requester_id OR conversation.user_b = requester_id)
  ) THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;

  IF COALESCE(p_is_typing, true) = false THEN
    DELETE FROM public.direct_message_typing_presence
    WHERE conversation_id = p_conversation_id
      AND user_id = requester_id;
    RETURN;
  END IF;

  INSERT INTO public.direct_message_typing_presence (
    conversation_id,
    user_id,
    started_at,
    updated_at
  )
  VALUES (
    p_conversation_id,
    requester_id,
    now(),
    now()
  )
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.list_direct_messages(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_direct_messages(uuid, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.send_direct_message(uuid, text, text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_direct_message(uuid, text, text, jsonb, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.toggle_direct_message_reaction(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_direct_message_reaction(uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.set_direct_message_typing(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_direct_message_typing(uuid, boolean) TO authenticated, service_role;
