CREATE TABLE IF NOT EXISTS public.direct_conversations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_a uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  last_message_sender_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT direct_conversations_distinct_users CHECK (user_a <> user_b),
  CONSTRAINT direct_conversations_canonical_order CHECK ((user_a::text) < (user_b::text)),
  CONSTRAINT direct_conversations_unique_pair UNIQUE (user_a, user_b)
);

CREATE INDEX IF NOT EXISTS idx_direct_conversations_user_a_last_message
  ON public.direct_conversations(user_a, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_direct_conversations_user_b_last_message
  ON public.direct_conversations(user_b, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid NOT NULL REFERENCES public.direct_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_type text NOT NULL CHECK (message_type IN ('text', 'movie_share')),
  body text,
  shared_movie jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CONSTRAINT direct_messages_payload_check CHECK (
    (
      message_type = 'text'
      AND NULLIF(btrim(COALESCE(body, '')), '') IS NOT NULL
      AND shared_movie IS NULL
    )
    OR (
      message_type = 'movie_share'
      AND shared_movie IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_created_at
  ON public.direct_messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient_unread
  ON public.direct_messages(recipient_id, read_at, created_at DESC);

ALTER TABLE public.direct_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view conversations" ON public.direct_conversations;
DROP POLICY IF EXISTS "Block direct conversation inserts" ON public.direct_conversations;
DROP POLICY IF EXISTS "Block direct conversation updates" ON public.direct_conversations;
DROP POLICY IF EXISTS "Block direct conversation deletes" ON public.direct_conversations;

CREATE POLICY "Participants can view conversations"
ON public.direct_conversations FOR SELECT
USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "Block direct conversation inserts"
ON public.direct_conversations FOR INSERT
WITH CHECK (false);

CREATE POLICY "Block direct conversation updates"
ON public.direct_conversations FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "Block direct conversation deletes"
ON public.direct_conversations FOR DELETE
USING (false);

DROP POLICY IF EXISTS "Participants can view direct messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Block direct message inserts" ON public.direct_messages;
DROP POLICY IF EXISTS "Block direct message updates" ON public.direct_messages;
DROP POLICY IF EXISTS "Block direct message deletes" ON public.direct_messages;

CREATE POLICY "Participants can view direct messages"
ON public.direct_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.direct_conversations conversation
    WHERE conversation.id = direct_messages.conversation_id
      AND (auth.uid() = conversation.user_a OR auth.uid() = conversation.user_b)
  )
);

CREATE POLICY "Block direct message inserts"
ON public.direct_messages FOR INSERT
WITH CHECK (false);

CREATE POLICY "Block direct message updates"
ON public.direct_messages FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "Block direct message deletes"
ON public.direct_messages FOR DELETE
USING (false);

CREATE OR REPLACE FUNCTION public.are_mutual_followers(
  p_user_a uuid,
  p_user_b uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    p_user_a IS NOT NULL
    AND p_user_b IS NOT NULL
    AND p_user_a <> p_user_b
    AND EXISTS (
      SELECT 1
      FROM public.follows
      WHERE follower_id = p_user_a
        AND following_id = p_user_b
    )
    AND EXISTS (
      SELECT 1
      FROM public.follows
      WHERE follower_id = p_user_b
        AND following_id = p_user_a
    );
$$;

CREATE OR REPLACE FUNCTION public.list_messageable_profiles()
RETURNS TABLE (
  id uuid,
  username text,
  avatar_url text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    profile.id,
    profile.username,
    profile.avatar_url,
    profile.created_at
  FROM public.profiles profile
  WHERE profile.id <> auth.uid()
    AND public.are_mutual_followers(auth.uid(), profile.id)
  ORDER BY lower(profile.username) ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(
  p_other_user_id uuid
)
RETURNS TABLE (
  id uuid,
  user_a uuid,
  user_b uuid,
  created_at timestamptz,
  updated_at timestamptz,
  last_message_at timestamptz,
  last_message_preview text,
  last_message_sender_id uuid,
  unread_count integer,
  other_profile jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  sorted_user_a uuid;
  sorted_user_b uuid;
  conversation_id uuid;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_other_user_id IS NULL OR requester_id = p_other_user_id THEN
    RAISE EXCEPTION 'Invalid conversation target';
  END IF;

  IF NOT public.are_mutual_followers(requester_id, p_other_user_id) THEN
    RAISE EXCEPTION 'Only mutual followers can message each other';
  END IF;

  IF requester_id::text < p_other_user_id::text THEN
    sorted_user_a := requester_id;
    sorted_user_b := p_other_user_id;
  ELSE
    sorted_user_a := p_other_user_id;
    sorted_user_b := requester_id;
  END IF;

  INSERT INTO public.direct_conversations (
    user_a,
    user_b,
    updated_at,
    last_message_at
  )
  VALUES (
    sorted_user_a,
    sorted_user_b,
    now(),
    now()
  )
  ON CONFLICT (user_a, user_b) DO NOTHING
  RETURNING direct_conversations.id INTO conversation_id;

  IF conversation_id IS NULL THEN
    SELECT direct_conversations.id
    INTO conversation_id
    FROM public.direct_conversations
    WHERE direct_conversations.user_a = sorted_user_a
      AND direct_conversations.user_b = sorted_user_b;
  END IF;

  RETURN QUERY
  SELECT
    conversation.id,
    conversation.user_a,
    conversation.user_b,
    conversation.created_at,
    conversation.updated_at,
    conversation.last_message_at,
    conversation.last_message_preview,
    conversation.last_message_sender_id,
    COALESCE((
      SELECT count(*)
      FROM public.direct_messages message
      WHERE message.conversation_id = conversation.id
        AND message.recipient_id = requester_id
        AND message.read_at IS NULL
    ), 0)::integer AS unread_count,
    jsonb_build_object(
      'id', other_profile.id,
      'username', other_profile.username,
      'avatar_url', other_profile.avatar_url,
      'created_at', other_profile.created_at
    ) AS other_profile
  FROM public.direct_conversations conversation
  JOIN public.profiles other_profile
    ON other_profile.id = CASE
      WHEN conversation.user_a = requester_id THEN conversation.user_b
      ELSE conversation.user_a
    END
  WHERE conversation.id = conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_direct_conversations()
RETURNS TABLE (
  id uuid,
  user_a uuid,
  user_b uuid,
  created_at timestamptz,
  updated_at timestamptz,
  last_message_at timestamptz,
  last_message_preview text,
  last_message_sender_id uuid,
  unread_count integer,
  other_profile jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    conversation.id,
    conversation.user_a,
    conversation.user_b,
    conversation.created_at,
    conversation.updated_at,
    conversation.last_message_at,
    conversation.last_message_preview,
    conversation.last_message_sender_id,
    COALESCE((
      SELECT count(*)
      FROM public.direct_messages message
      WHERE message.conversation_id = conversation.id
        AND message.recipient_id = auth.uid()
        AND message.read_at IS NULL
    ), 0)::integer AS unread_count,
    jsonb_build_object(
      'id', other_profile.id,
      'username', other_profile.username,
      'avatar_url', other_profile.avatar_url,
      'created_at', other_profile.created_at
    ) AS other_profile
  FROM public.direct_conversations conversation
  JOIN public.profiles other_profile
    ON other_profile.id = CASE
      WHEN conversation.user_a = auth.uid() THEN conversation.user_b
      ELSE conversation.user_a
    END
  WHERE auth.uid() IS NOT NULL
    AND (conversation.user_a = auth.uid() OR conversation.user_b = auth.uid())
  ORDER BY conversation.last_message_at DESC, conversation.updated_at DESC;
$$;

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
  read_at timestamptz
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
      message.read_at
    FROM public.direct_messages message
    JOIN public.direct_conversations conversation
      ON conversation.id = message.conversation_id
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
  p_shared_movie jsonb DEFAULT NULL
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
  read_at timestamptz
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
  INSERT INTO public.direct_messages (
    conversation_id,
    sender_id,
    recipient_id,
    message_type,
    body,
    shared_movie
  )
  VALUES (
    conversation_record.id,
    requester_id,
    p_other_user_id,
    safe_message_type,
    safe_body,
    p_shared_movie
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
    direct_messages.read_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_direct_conversation_read(
  p_conversation_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  updated_count integer := 0;
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

  UPDATE public.direct_messages
  SET read_at = now()
  WHERE conversation_id = p_conversation_id
    AND recipient_id = requester_id
    AND read_at IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.are_mutual_followers(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.are_mutual_followers(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.list_messageable_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_messageable_profiles() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_or_create_direct_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.list_direct_conversations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_direct_conversations() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.list_direct_messages(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_direct_messages(uuid, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.send_direct_message(uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_direct_message(uuid, text, text, jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.mark_direct_conversation_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_direct_conversation_read(uuid) TO authenticated, service_role;
