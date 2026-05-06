CREATE OR REPLACE FUNCTION public.prune_expired_direct_message_notifications(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := COALESCE(p_user_id, auth.uid());
  deleted_count integer := 0;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  DELETE FROM public.notifications
  WHERE user_id = requester_id
    AND type = 'direct_message'
    AND created_at < (now() - interval '1 day');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_expired_direct_message_notifications(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prune_expired_direct_message_notifications(uuid) TO authenticated, service_role;

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
  PERFORM public.prune_expired_direct_message_notifications(NEW.recipient_id);

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
