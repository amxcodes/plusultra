CREATE OR REPLACE FUNCTION public.delete_direct_message(
  p_message_id uuid
)
RETURNS TABLE (
  conversation_id uuid,
  deleted_message_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  message_record public.direct_messages%ROWTYPE;
  replacement_message record;
  replacement_preview text;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO message_record
  FROM public.direct_messages
  WHERE id = p_message_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  IF message_record.sender_id <> requester_id THEN
    RAISE EXCEPTION 'Only the sender can unsend this message';
  END IF;

  DELETE FROM public.direct_messages
  WHERE id = p_message_id;

  DELETE FROM public.notifications
  WHERE type = 'direct_message'
    AND data ->> 'message_id' = p_message_id::text;

  SELECT
    message.id,
    message.sender_id,
    message.message_type,
    message.body,
    message.created_at
  INTO replacement_message
  FROM public.direct_messages AS message
  WHERE message.conversation_id = message_record.conversation_id
  ORDER BY message.created_at DESC
  LIMIT 1;

  replacement_preview := CASE
    WHEN replacement_message.id IS NULL THEN NULL
    WHEN replacement_message.message_type = 'movie_share' AND replacement_message.body IS NOT NULL THEN LEFT(replacement_message.body, 120)
    WHEN replacement_message.message_type = 'movie_share' THEN 'Shared a title'
    ELSE LEFT(replacement_message.body, 120)
  END;

  UPDATE public.direct_conversations
  SET
    updated_at = COALESCE(replacement_message.created_at, now()),
    last_message_at = COALESCE(replacement_message.created_at, direct_conversations.created_at),
    last_message_preview = replacement_preview,
    last_message_sender_id = replacement_message.sender_id
  WHERE id = message_record.conversation_id;

  RETURN QUERY
  SELECT message_record.conversation_id, p_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_direct_message(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_direct_message(uuid) TO authenticated, service_role;
