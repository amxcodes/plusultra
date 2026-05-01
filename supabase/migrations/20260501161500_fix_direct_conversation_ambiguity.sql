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
  ON CONFLICT ON CONSTRAINT direct_conversations_unique_pair DO NOTHING
  RETURNING direct_conversations.id INTO conversation_id;

  IF conversation_id IS NULL THEN
    SELECT conversation.id
    INTO conversation_id
    FROM public.direct_conversations AS conversation
    WHERE conversation.user_a = sorted_user_a
      AND conversation.user_b = sorted_user_b;
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
      FROM public.direct_messages AS message
      WHERE message.conversation_id = conversation.id
        AND message.recipient_id = requester_id
        AND message.read_at IS NULL
    ), 0)::integer AS unread_count,
    jsonb_build_object(
      'id', other_profile_row.id,
      'username', other_profile_row.username,
      'avatar_url', other_profile_row.avatar_url,
      'created_at', other_profile_row.created_at
    ) AS other_profile
  FROM public.direct_conversations AS conversation
  JOIN public.profiles AS other_profile_row
    ON other_profile_row.id = CASE
      WHEN conversation.user_a = requester_id THEN conversation.user_b
      ELSE conversation.user_a
    END
  WHERE conversation.id = conversation_id;
END;
$$;
