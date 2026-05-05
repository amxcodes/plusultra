ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check
CHECK (
  type IN (
    'playlist_invite',
    'system',
    'follow',
    'playlist_liked',
    'follower_new_playlist',
    'direct_message'
  )
);

CREATE OR REPLACE FUNCTION public.notify_direct_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name text;
  notification_title text := 'New message';
  notification_message text;
BEGIN
  SELECT split_part(profile.username, '@', 1)
  INTO sender_name
  FROM public.profiles AS profile
  WHERE profile.id = NEW.sender_id;

  notification_message := CASE
    WHEN NEW.message_type = 'movie_share' AND NEW.body IS NOT NULL THEN
      COALESCE(sender_name, 'Someone') || ' shared a title: ' || LEFT(NEW.body, 120)
    WHEN NEW.message_type = 'movie_share' THEN
      COALESCE(sender_name, 'Someone') || ' shared a title with you'
    WHEN NEW.body IS NOT NULL THEN
      COALESCE(sender_name, 'Someone') || ': ' || LEFT(NEW.body, 120)
    ELSE
      COALESCE(sender_name, 'Someone') || ' sent you a message'
  END;

  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    NEW.recipient_id,
    'direct_message',
    notification_title,
    notification_message,
    jsonb_build_object(
      'conversation_id', NEW.conversation_id,
      'message_id', NEW.id,
      'actor_id', NEW.sender_id,
      'actor_username', sender_name,
      'message_type', NEW.message_type,
      'shared_title', COALESCE(NEW.shared_movie ->> 'title', null)
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_direct_message_notification ON public.direct_messages;
CREATE TRIGGER on_direct_message_notification
AFTER INSERT ON public.direct_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_direct_message();

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

  UPDATE public.notifications
  SET is_read = true
  WHERE user_id = requester_id
    AND type = 'direct_message'
    AND is_read = false
    AND data ->> 'conversation_id' = p_conversation_id::text;

  RETURN updated_count;
END;
$$;
