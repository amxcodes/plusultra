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
  existing_emoji text;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF safe_emoji IS NULL OR char_length(safe_emoji) > 16 THEN
    RAISE EXCEPTION 'Invalid reaction';
  END IF;

  SELECT
    dm.id,
    dm.conversation_id
  INTO message_record
  FROM public.direct_messages AS dm
  JOIN public.direct_conversations AS conversation
    ON conversation.id = dm.conversation_id
  WHERE dm.id = p_message_id
    AND (conversation.user_a = requester_id OR conversation.user_b = requester_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  SELECT reaction.emoji
  INTO existing_emoji
  FROM public.direct_message_reactions AS reaction
  WHERE reaction.message_id = p_message_id
    AND reaction.user_id = requester_id
  ORDER BY reaction.created_at DESC
  LIMIT 1;

  IF existing_emoji = safe_emoji THEN
    DELETE FROM public.direct_message_reactions AS reaction
    WHERE reaction.message_id = p_message_id
      AND reaction.user_id = requester_id
      AND reaction.emoji = safe_emoji;

    RETURN QUERY
    SELECT p_message_id, safe_emoji, false;
    RETURN;
  END IF;

  DELETE FROM public.direct_message_reactions AS reaction
  WHERE reaction.message_id = p_message_id
    AND reaction.user_id = requester_id;

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

REVOKE ALL ON FUNCTION public.toggle_direct_message_reaction(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_direct_message_reaction(uuid, text) TO authenticated, service_role;
