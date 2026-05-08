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
  resolved_reply_preview jsonb := NULL;
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
    FROM public.direct_messages AS message
    WHERE message.id = p_reply_to_message_id
      AND message.conversation_id = conversation_record.id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Reply target not found in this conversation';
    END IF;

    resolved_reply_preview := jsonb_build_object(
      'id', reply_record.id,
      'sender_id', reply_record.sender_id,
      'body', reply_record.body,
      'message_type', reply_record.message_type,
      'shared_movie_title', reply_record.shared_movie_title
    );
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
    resolved_reply_preview,
    '[]'::jsonb AS reactions
  FROM inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.send_direct_message(uuid, text, text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_direct_message(uuid, text, text, jsonb, uuid) TO authenticated, service_role;
